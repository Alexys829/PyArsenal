use tauri::State;

use crate::error::AppResult;
use crate::github::GitHubClient;
use crate::models::{Catalog, CatalogEntry, current_platform};
use crate::paths::{catalog_cache_path, icons_dir};

const CATALOG_URL: &str =
    "https://raw.githubusercontent.com/Alexys829/pyarsenal-catalog/main/catalog.json";

// Embedded fallback catalog for when remote + cache both fail
const BUNDLED_CATALOG: &str = include_str!("../../../catalog/catalog.json");

fn filter_by_platform(catalog: Catalog) -> Vec<CatalogEntry> {
    let platform = current_platform();
    catalog
        .tools
        .into_iter()
        .filter(|t| t.platforms.contains(&platform.to_string()))
        .collect()
}

#[tauri::command]
pub async fn fetch_catalog(github: State<'_, GitHubClient>) -> AppResult<Vec<CatalogEntry>> {
    // Try fetching from remote
    let result: Result<bytes::Bytes, _> = github.download_bytes(CATALOG_URL).await;
    if let Ok(bytes) = result {
        if let Ok(catalog) = serde_json::from_slice::<Catalog>(&bytes) {
            // Cache it locally
            if let Ok(text) = std::str::from_utf8(&bytes) {
                std::fs::write(catalog_cache_path(), text).ok();
            }
            return Ok(filter_by_platform(catalog));
        }
    }

    // Fallback to cached catalog
    let cache = catalog_cache_path();
    if cache.exists() {
        if let Ok(data) = std::fs::read_to_string(&cache) {
            if let Ok(catalog) = serde_json::from_str::<Catalog>(&data) {
                return Ok(filter_by_platform(catalog));
            }
        }
    }

    // Fallback to bundled catalog
    let catalog: Catalog = serde_json::from_str(BUNDLED_CATALOG)?;
    Ok(filter_by_platform(catalog))
}

/// Returns the icon as a base64 data URL, downloading from the tool's repo if needed
/// Standard path: {repo}/assets/icon.png (on the main or master branch)
#[tauri::command]
pub async fn get_tool_icon(repo: String, tool_id: String, github: State<'_, GitHubClient>) -> AppResult<String> {
    use base64::Engine;

    let cache_name = format!("{}.png", tool_id);
    let local_path = icons_dir().join(&cache_name);

    // Return cached icon if valid
    if local_path.exists() {
        if let Ok(data) = std::fs::read(&local_path) {
            if data.len() > 100 && data.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
                let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
                return Ok(format!("data:image/png;base64,{}", b64));
            }
            std::fs::remove_file(&local_path).ok();
        }
    }

    // Try main branch first, then master
    for branch in &["main", "master"] {
        let url = format!(
            "https://raw.githubusercontent.com/{}/{}/assets/icon.png",
            repo, branch
        );
        if let Ok(data) = github.download_bytes(&url).await {
            if data.len() > 100 && data.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
                std::fs::write(&local_path, &data)?;
                let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
                return Ok(format!("data:image/png;base64,{}", b64));
            }
        }
    }

    Ok(String::new())
}
