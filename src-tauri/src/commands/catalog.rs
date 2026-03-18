use tauri::State;

use crate::error::AppResult;
use crate::github::GitHubClient;
use crate::models::{Catalog, CatalogEntry, current_platform};
use crate::paths::catalog_cache_path;

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
