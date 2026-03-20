use std::collections::HashMap;

use tauri::State;

use crate::error::{AppError, AppResult};
use crate::github::GitHubClient;
use crate::models::{AppStats, InstalledDb, InstalledTool};
use crate::paths::{installed_db_path, tools_dir};

pub fn read_installed_db() -> AppResult<InstalledDb> {
    let path = installed_db_path();
    if !path.exists() {
        let db = InstalledDb {
            format_version: 1,
            tools: HashMap::new(),
            favorites: Vec::new(),
            launch_counts: HashMap::new(),
        };
        let json = serde_json::to_string_pretty(&db)?;
        std::fs::write(&path, json)?;
        return Ok(db);
    }

    let data = std::fs::read_to_string(&path)?;
    match serde_json::from_str::<InstalledDb>(&data) {
        Ok(db) => Ok(db),
        Err(_) => {
            let backup = path.with_extension("json.bak");
            std::fs::copy(&path, backup).ok();
            let db = InstalledDb {
                format_version: 1,
                tools: HashMap::new(),
                favorites: Vec::new(),
                launch_counts: HashMap::new(),
            };
            let json = serde_json::to_string_pretty(&db)?;
            std::fs::write(&path, json)?;
            Ok(db)
        }
    }
}

pub fn write_installed_db(db: &InstalledDb) -> AppResult<()> {
    let path = installed_db_path();
    let json = serde_json::to_string_pretty(db)?;
    std::fs::write(path, json)?;
    Ok(())
}

#[tauri::command]
pub async fn get_installed_tools() -> AppResult<HashMap<String, InstalledTool>> {
    let db = read_installed_db()?;
    Ok(db.tools)
}

// ── Favorites ──

#[tauri::command]
pub async fn toggle_favorite(tool_id: String) -> AppResult<bool> {
    let mut db = read_installed_db()?;
    let is_fav = if db.favorites.contains(&tool_id) {
        db.favorites.retain(|f| f != &tool_id);
        false
    } else {
        db.favorites.push(tool_id);
        true
    };
    write_installed_db(&db)?;
    Ok(is_fav)
}

#[tauri::command]
pub async fn get_favorites() -> AppResult<Vec<String>> {
    let db = read_installed_db()?;
    Ok(db.favorites)
}

// ── Launch counter ──

pub fn increment_launch_count(tool_id: &str) -> AppResult<()> {
    let mut db = read_installed_db()?;
    let count = db.launch_counts.entry(tool_id.to_string()).or_insert(0);
    *count += 1;
    write_installed_db(&db)?;
    Ok(())
}

#[tauri::command]
pub async fn get_launch_counts() -> AppResult<HashMap<String, u32>> {
    let db = read_installed_db()?;
    Ok(db.launch_counts)
}

// ── Statistics ──

fn dir_size_recursive(path: &std::path::Path) -> u64 {
    let mut total = 0u64;
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Ok(m) = entry.metadata() {
                if m.is_file() {
                    total += m.len();
                } else if m.is_dir() {
                    total += dir_size_recursive(&entry.path());
                }
            }
        }
    }
    total
}

#[tauri::command]
pub async fn get_stats() -> AppResult<AppStats> {
    let db = read_installed_db()?;
    let total_size = dir_size_recursive(&tools_dir());

    let mut launches: Vec<(String, u32)> = db.launch_counts.into_iter().collect();
    launches.sort_by(|a, b| b.1.cmp(&a.1));
    launches.truncate(10);

    Ok(AppStats {
        total_tools: 0, // Will be filled by frontend from catalog
        installed_tools: db.tools.len() as u32,
        total_size_bytes: total_size,
        most_launched: launches,
    })
}

// ── Changelog ──

#[tauri::command]
pub async fn get_tool_changelog(repo: String, github: State<'_, GitHubClient>) -> AppResult<Vec<ReleaseInfo>> {
    let url = format!("https://api.github.com/repos/{}/releases?per_page=10", repo);
    let bytes = github.download_bytes(&url).await?;
    let releases: Vec<crate::models::GitHubRelease> = serde_json::from_slice(&bytes)?;

    Ok(releases
        .into_iter()
        .map(|r| ReleaseInfo {
            version: r.tag_name,
            name: r.name.unwrap_or_default(),
            body: r.body.unwrap_or_default(),
            published_at: r.published_at.unwrap_or_default(),
        })
        .collect())
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ReleaseInfo {
    pub version: String,
    pub name: String,
    pub body: String,
    pub published_at: String,
}

// ── Export / Import profile ──

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ExportProfile {
    pub exported_at: String,
    pub tools: Vec<ExportedTool>,
    pub favorites: Vec<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ExportedTool {
    pub id: String,
    pub name: String,
    pub version: String,
    pub repo: String,
}

#[tauri::command]
pub async fn export_profile() -> AppResult<String> {
    let db = read_installed_db()?;
    let profile = ExportProfile {
        exported_at: chrono::Utc::now().to_rfc3339(),
        tools: db
            .tools
            .values()
            .map(|t| ExportedTool {
                id: t.id.clone(),
                name: t.name.clone(),
                version: t.installed_version.clone(),
                repo: t.repo.clone(),
            })
            .collect(),
        favorites: db.favorites,
    };
    Ok(serde_json::to_string_pretty(&profile)?)
}

#[tauri::command]
pub async fn import_profile(json: String) -> AppResult<ExportProfile> {
    let profile: ExportProfile = serde_json::from_str(&json)
        .map_err(|e| AppError::Generic(format!("Invalid profile: {}", e)))?;
    // Restore favorites
    let mut db = read_installed_db()?;
    db.favorites = profile.favorites.clone();
    write_installed_db(&db)?;
    Ok(profile)
}
