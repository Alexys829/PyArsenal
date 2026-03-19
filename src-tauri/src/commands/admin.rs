use std::collections::HashMap;
use tauri::State;

use crate::error::{AppError, AppResult};
use crate::github::GitHubClient;
use crate::models::{Catalog, CatalogEntry, GitHubRelease};

use serde::{Deserialize, Serialize};

const CATALOG_REPO: &str = "Alexys829/pyarsenal-catalog";
const CATALOG_PATH: &str = "catalog.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoScanResult {
    pub repo: String,
    pub name: String,
    pub description: String,
    pub author: String,
    pub has_releases: bool,
    pub latest_version: String,
    pub linux_assets: Vec<String>,
    pub windows_assets: Vec<String>,
    pub has_icon: bool,
    pub suggested_entry: CatalogEntry,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct GitHubRepoInfo {
    name: String,
    description: Option<String>,
    owner: GitHubOwner,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct GitHubOwner {
    login: String,
}

// ── Catalog read/write helpers ──

struct CatalogFile {
    catalog: Catalog,
    sha: String,
}

async fn fetch_catalog_file(github: &GitHubClient) -> AppResult<CatalogFile> {
    let url = format!(
        "https://api.github.com/repos/{}/contents/{}",
        CATALOG_REPO, CATALOG_PATH
    );
    let bytes = github.download_bytes(&url).await?;
    let file_info: serde_json::Value = serde_json::from_slice(&bytes)?;

    let sha = file_info["sha"].as_str()
        .ok_or_else(|| AppError::Generic("Could not get catalog SHA".to_string()))?
        .to_string();
    let content_b64 = file_info["content"].as_str()
        .ok_or_else(|| AppError::Generic("Could not get catalog content".to_string()))?;

    let clean_b64: String = content_b64.chars().filter(|c| !c.is_whitespace()).collect();
    use base64::Engine;
    let decoded = base64::engine::general_purpose::STANDARD.decode(&clean_b64)
        .map_err(|e| AppError::Generic(format!("Base64 decode error: {}", e)))?;
    let catalog_str = String::from_utf8(decoded)
        .map_err(|e| AppError::Generic(format!("UTF-8 error: {}", e)))?;

    let catalog: Catalog = serde_json::from_str(&catalog_str)?;
    Ok(CatalogFile { catalog, sha })
}

async fn push_catalog_file(catalog: &Catalog, sha: &str, message: &str, github: &GitHubClient) -> AppResult<()> {
    use base64::Engine;

    let url = format!(
        "https://api.github.com/repos/{}/contents/{}",
        CATALOG_REPO, CATALOG_PATH
    );

    let new_content = serde_json::to_string_pretty(catalog)?;
    let new_b64 = base64::engine::general_purpose::STANDARD.encode(new_content.as_bytes());

    let update_body = serde_json::json!({
        "message": message,
        "content": new_b64,
        "sha": sha
    });

    let pat = get_pat_or_error(github).await?;
    let client = reqwest::Client::new();
    let resp = client.put(&url)
        .header("User-Agent", "PyArsenal")
        .header("Accept", "application/vnd.github.v3+json")
        .header("Authorization", format!("Bearer {}", pat))
        .json(&update_body)
        .send()
        .await
        .map_err(|e| AppError::Generic(format!("Failed to update catalog: {}", e)))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::Generic(format!(
            "GitHub API error {}: {}. Make sure your PAT has repo write permissions.",
            status, body
        )));
    }

    Ok(())
}

// ── Commands ──

#[tauri::command]
pub async fn scan_repo(repo_url: String, github: State<'_, GitHubClient>) -> AppResult<RepoScanResult> {
    let repo = parse_repo(&repo_url)?;

    // Fetch repo info
    let info_url = format!("https://api.github.com/repos/{}", repo);
    let info_bytes = github.download_bytes(&info_url).await
        .map_err(|_| AppError::RepoUnreachable { repo: repo.clone() })?;
    let repo_info: GitHubRepoInfo = serde_json::from_slice(&info_bytes)
        .map_err(|_| AppError::RepoUnreachable { repo: repo.clone() })?;

    // Fetch latest release
    let release = github.get_latest_release(&repo).await?;
    let version = release.tag_name.trim_start_matches('v').to_string();

    // Categorize assets by platform
    let mut linux_assets = Vec::new();
    let mut windows_assets = Vec::new();
    for asset in &release.assets {
        let name_lower = asset.name.to_lowercase();
        if name_lower.contains("linux") || name_lower.ends_with(".appimage")
            || (name_lower.ends_with(".tar.gz") && !name_lower.contains("windows"))
            || name_lower.ends_with(".deb")
        {
            linux_assets.push(asset.name.clone());
        }
        if name_lower.contains("windows") || name_lower.contains("win")
            || (name_lower.ends_with(".exe") && !name_lower.contains("linux"))
            || name_lower.ends_with(".msi")
        {
            windows_assets.push(asset.name.clone());
        }
    }

    let has_icon = check_icon_exists(&repo, &github).await;

    // Build suggested entry
    let id = repo.split('/').last().unwrap_or("tool").to_lowercase();
    let mut platforms = Vec::new();
    let mut asset_patterns = HashMap::new();
    let mut binary_name = HashMap::new();
    let mut install_type = HashMap::new();

    if let Some(linux_asset) = guess_best_asset(&linux_assets, "linux", &version) {
        platforms.push("linux".to_string());
        let pattern = linux_asset.replace(&version, "{version}");
        asset_patterns.insert("linux".to_string(), pattern);
        binary_name.insert("linux".to_string(), guess_binary_name(&linux_asset, &id));
        let itype = guess_install_type(&linux_asset);
        if itype != "binary" {
            install_type.insert("linux".to_string(), itype);
        }
    }

    if let Some(win_asset) = guess_best_asset(&windows_assets, "windows", &version) {
        platforms.push("windows".to_string());
        let pattern = win_asset.replace(&version, "{version}");
        asset_patterns.insert("windows".to_string(), pattern);
        binary_name.insert("windows".to_string(), guess_binary_name(&win_asset, &id));
        let itype = guess_install_type(&win_asset);
        if itype != "binary" {
            install_type.insert("windows".to_string(), itype);
        }
    }

    let suggested = CatalogEntry {
        id: id.clone(),
        name: repo_info.name.clone(),
        description: repo_info.description.clone().unwrap_or_default(),
        category: "Utilities".to_string(),
        icon: "icon.png".to_string(),
        repo: repo.clone(),
        author: repo_info.owner.login.clone(),
        platforms,
        asset_patterns,
        binary_name,
        install_type,
    };

    Ok(RepoScanResult {
        repo,
        name: repo_info.name,
        description: repo_info.description.unwrap_or_default(),
        author: repo_info.owner.login,
        has_releases: true,
        latest_version: version,
        linux_assets,
        windows_assets,
        has_icon,
        suggested_entry: suggested,
    })
}

#[tauri::command]
pub async fn add_to_catalog(entry: CatalogEntry, github: State<'_, GitHubClient>) -> AppResult<()> {
    let mut cf = fetch_catalog_file(&github).await?;

    if cf.catalog.tools.iter().any(|t| t.id == entry.id) {
        return Err(AppError::Generic(format!("Tool '{}' already exists in catalog", entry.id)));
    }

    let msg = format!("Add {} to catalog", entry.name);
    cf.catalog.tools.push(entry);
    cf.catalog.updated_at = chrono::Utc::now().to_rfc3339();

    push_catalog_file(&cf.catalog, &cf.sha, &msg, &github).await
}

#[tauri::command]
pub async fn remove_from_catalog(tool_id: String, github: State<'_, GitHubClient>) -> AppResult<()> {
    let mut cf = fetch_catalog_file(&github).await?;

    let before = cf.catalog.tools.len();
    cf.catalog.tools.retain(|t| t.id != tool_id);

    if cf.catalog.tools.len() == before {
        return Err(AppError::Generic(format!("Tool '{}' not found in catalog", tool_id)));
    }

    cf.catalog.updated_at = chrono::Utc::now().to_rfc3339();
    let msg = format!("Remove {} from catalog", tool_id);

    push_catalog_file(&cf.catalog, &cf.sha, &msg, &github).await
}

#[tauri::command]
pub async fn update_in_catalog(entry: CatalogEntry, github: State<'_, GitHubClient>) -> AppResult<()> {
    let mut cf = fetch_catalog_file(&github).await?;

    let found = cf.catalog.tools.iter_mut().find(|t| t.id == entry.id);
    match found {
        Some(existing) => {
            *existing = entry.clone();
        }
        None => {
            return Err(AppError::Generic(format!("Tool '{}' not found in catalog", entry.id)));
        }
    }

    cf.catalog.updated_at = chrono::Utc::now().to_rfc3339();
    let msg = format!("Update {} in catalog", entry.name);

    push_catalog_file(&cf.catalog, &cf.sha, &msg, &github).await
}

/// Get all tools currently in the remote catalog (for admin page)
#[tauri::command]
pub async fn get_catalog_entries(github: State<'_, GitHubClient>) -> AppResult<Vec<CatalogEntry>> {
    let cf = fetch_catalog_file(&github).await?;
    Ok(cf.catalog.tools)
}

// ── Helpers ──

fn parse_repo(input: &str) -> AppResult<String> {
    let input = input.trim();
    if input.contains("github.com") {
        let parts: Vec<&str> = input.split("github.com/").collect();
        if let Some(path) = parts.get(1) {
            let repo = path.trim_end_matches('/').trim_end_matches(".git");
            let segments: Vec<&str> = repo.split('/').collect();
            if segments.len() >= 2 {
                return Ok(format!("{}/{}", segments[0], segments[1]));
            }
        }
    }
    if input.contains('/') && !input.contains(' ') {
        let segments: Vec<&str> = input.split('/').collect();
        if segments.len() == 2 {
            return Ok(input.to_string());
        }
    }
    Err(AppError::Generic(format!("Invalid repo format: '{}'. Use 'owner/repo' or a GitHub URL.", input)))
}

async fn check_icon_exists(repo: &str, github: &GitHubClient) -> bool {
    for branch in &["main", "master"] {
        let url = format!(
            "https://raw.githubusercontent.com/{}/{}/assets/icon.png",
            repo, branch
        );
        if let Ok(data) = github.download_bytes(&url).await {
            if !data.is_empty() && data.len() > 100 {
                return true;
            }
        }
    }
    false
}

fn guess_best_asset(assets: &[String], platform: &str, version: &str) -> Option<String> {
    let with_version: Vec<_> = assets.iter().filter(|a| a.contains(version)).collect();
    if !with_version.is_empty() {
        if platform == "linux" {
            if let Some(a) = with_version.iter().find(|a| a.ends_with(".AppImage")) {
                return Some((*a).clone());
            }
            if let Some(a) = with_version.iter().find(|a| a.ends_with(".tar.gz")) {
                return Some((*a).clone());
            }
        }
        if platform == "windows" {
            if let Some(a) = with_version.iter().find(|a| a.ends_with(".exe")) {
                return Some((*a).clone());
            }
            if let Some(a) = with_version.iter().find(|a| a.ends_with(".zip")) {
                return Some((*a).clone());
            }
        }
        return Some(with_version[0].clone());
    }
    if platform == "linux" {
        if let Some(a) = assets.iter().find(|a| a.ends_with(".AppImage")) {
            return Some(a.clone());
        }
    }
    if platform == "windows" {
        if let Some(a) = assets.iter().find(|a| a.ends_with(".exe")) {
            return Some(a.clone());
        }
    }
    assets.first().cloned()
}

fn guess_binary_name(asset: &str, tool_id: &str) -> String {
    if asset.ends_with(".AppImage") {
        format!("{}.AppImage", capitalize(tool_id))
    } else if asset.ends_with(".exe") {
        format!("{}.exe", capitalize(tool_id))
    } else if asset.ends_with(".tar.gz") || asset.ends_with(".zip") {
        if cfg!(target_os = "windows") {
            format!("{}.exe", capitalize(tool_id))
        } else {
            capitalize(tool_id)
        }
    } else {
        asset.to_string()
    }
}

fn guess_install_type(asset: &str) -> String {
    if asset.ends_with(".tar.gz") || asset.ends_with(".tgz") || asset.ends_with(".zip") {
        "archive".to_string()
    } else {
        "binary".to_string()
    }
}

fn capitalize(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        None => String::new(),
        Some(c) => c.to_uppercase().to_string() + chars.as_str(),
    }
}

async fn get_pat_or_error(github: &GitHubClient) -> AppResult<String> {
    let entry = keyring::Entry::new("pyarsenal", "github_pat")
        .map_err(|e| AppError::Keychain(e.to_string()))?;
    match entry.get_password() {
        Ok(pat) => Ok(pat),
        _ => Err(AppError::Generic(
            "GitHub PAT required. Click 'Login with GitHub' in Settings first.".to_string()
        )),
    }
}
