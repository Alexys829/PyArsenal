use std::collections::HashMap;

use serde::{Deserialize, Serialize};

// ── Catalog ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Catalog {
    pub schema_version: u32,
    pub updated_at: String,
    pub tools: Vec<CatalogEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CatalogEntry {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String,
    pub icon: String,
    pub repo: String,
    pub platforms: Vec<String>,
    pub asset_patterns: HashMap<String, String>,
    pub binary_name: HashMap<String, String>,
}

// ── Installed tools DB ──

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct InstalledDb {
    pub format_version: u32,
    pub tools: HashMap<String, InstalledTool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledTool {
    pub id: String,
    pub name: String,
    pub installed_version: String,
    pub installed_at: String,
    pub updated_at: String,
    pub install_path: String,
    pub binary_path: String,
    pub repo: String,
}

// ── GitHub API responses ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubRelease {
    pub tag_name: String,
    pub name: Option<String>,
    pub assets: Vec<GitHubAsset>,
    pub published_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubAsset {
    pub name: String,
    pub browser_download_url: String,
    pub size: u64,
}

// ── Update info ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub tool_id: String,
    pub current_version: String,
    pub latest_version: String,
}

// ── Download progress event ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub tool_id: String,
    pub downloaded: u64,
    pub total: u64,
}

// ── Platform detection ──

pub fn current_platform() -> &'static str {
    if cfg!(target_os = "linux") {
        "linux"
    } else if cfg!(target_os = "windows") {
        "windows"
    } else {
        "unknown"
    }
}
