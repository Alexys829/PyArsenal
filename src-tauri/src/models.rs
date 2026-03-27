use std::collections::HashMap;

use serde::{Deserialize, Serialize};

// ── Catalog ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Catalog {
    pub schema_version: u32,
    pub updated_at: String,
    pub tools: Vec<CatalogEntry>,
    #[serde(default)]
    pub links: Vec<LinkEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinkEntry {
    pub id: String,
    pub name: String,
    pub description: String,
    pub url: String,
    pub icon: String,
    pub filename: String,
    #[serde(default)]
    pub category: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub added_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CatalogEntry {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String,
    pub icon: String,
    pub repo: String,
    #[serde(default)]
    pub author: String,
    pub platforms: Vec<String>,
    pub asset_patterns: HashMap<String, String>,
    pub binary_name: HashMap<String, String>,
    #[serde(default = "default_install_type")]
    pub install_type: HashMap<String, String>,
    #[serde(default)]
    pub tags: Vec<String>,
}

fn default_install_type() -> HashMap<String, String> {
    HashMap::new()
}

// ── Installed tools DB ──

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct InstalledDb {
    pub format_version: u32,
    pub tools: HashMap<String, InstalledTool>,
    #[serde(default)]
    pub favorites: Vec<String>,
    #[serde(default)]
    pub launch_counts: HashMap<String, u32>,
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
    #[serde(default)]
    pub size_bytes: u64,
}

// ── GitHub API responses ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubRelease {
    pub tag_name: String,
    pub name: Option<String>,
    pub body: Option<String>,
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
    pub release_date: String,
    pub release_notes: String,
}

// ── Download progress event ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub tool_id: String,
    pub downloaded: u64,
    pub total: u64,
    pub speed_bps: u64,
}

// ── Statistics ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppStats {
    pub total_tools: u32,
    pub installed_tools: u32,
    pub total_size_bytes: u64,
    pub most_launched: Vec<(String, u32)>,
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
