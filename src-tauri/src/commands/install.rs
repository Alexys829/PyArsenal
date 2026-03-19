use std::io::Cursor;
use std::path::Path;

use tauri::{Emitter, State, AppHandle};

use crate::commands::library::{read_installed_db, write_installed_db};
use crate::error::{AppError, AppResult};
use crate::github::GitHubClient;
use crate::models::{
    current_platform, CatalogEntry, DownloadProgress, InstalledTool,
};
use crate::paths::tools_dir;

fn find_asset_url(entry: &CatalogEntry, release: &crate::models::GitHubRelease) -> AppResult<(String, String)> {
    let platform = current_platform();
    let version = release.tag_name.trim_start_matches('v');

    let pattern = entry
        .asset_patterns
        .get(platform)
        .ok_or_else(|| AppError::NoPlatformBinary {
            platform: platform.to_string(),
            version: version.to_string(),
        })?;

    let expected_name = pattern.replace("{version}", version);

    for asset in &release.assets {
        if asset.name == expected_name {
            return Ok((asset.browser_download_url.clone(), version.to_string()));
        }
    }

    // Fallback: try matching without exact version (pattern-based)
    for asset in &release.assets {
        if asset.name.contains(platform) {
            return Ok((asset.browser_download_url.clone(), version.to_string()));
        }
    }

    Err(AppError::NoPlatformBinary {
        platform: platform.to_string(),
        version: version.to_string(),
    })
}

fn extract_archive(data: &[u8], dest: &Path, filename: &str) -> AppResult<()> {
    if filename.ends_with(".tar.gz") || filename.ends_with(".tgz") {
        let decoder = flate2::read::GzDecoder::new(Cursor::new(data));
        let mut archive = tar::Archive::new(decoder);
        archive.unpack(dest).map_err(|e| AppError::Extraction(e.to_string()))?;
    } else if filename.ends_with(".zip") {
        let mut archive =
            zip::ZipArchive::new(Cursor::new(data)).map_err(|e| AppError::Extraction(e.to_string()))?;
        archive.extract(dest).map_err(|e| AppError::Extraction(e.to_string()))?;
    } else {
        // Single binary (.AppImage, .exe, or unknown) — save with original filename
        let bin_path = dest.join(filename);
        std::fs::write(&bin_path, data)?;
    }
    Ok(())
}

#[cfg(unix)]
fn set_executable(path: &Path) -> AppResult<()> {
    use std::os::unix::fs::PermissionsExt;
    for entry in std::fs::read_dir(path)? {
        let entry = entry?;
        let ft = entry.file_type()?;
        if ft.is_file() {
            let mut perms = entry.metadata()?.permissions();
            perms.set_mode(0o755);
            std::fs::set_permissions(entry.path(), perms)?;
        }
    }
    Ok(())
}

#[cfg(not(unix))]
fn set_executable(_path: &Path) -> AppResult<()> {
    Ok(())
}

#[tauri::command]
pub async fn install_tool(
    tool_id: String,
    catalog_entry: CatalogEntry,
    app: AppHandle,
    github: State<'_, GitHubClient>,
) -> AppResult<InstalledTool> {
    let release = github.get_latest_release(&catalog_entry.repo).await?;
    let (download_url, version) = find_asset_url(&catalog_entry, &release)?;

    // Emit start progress
    app.emit(
        "download-progress",
        DownloadProgress {
            tool_id: tool_id.clone(),
            downloaded: 0,
            total: 0,
        },
    )
    .ok();

    // Download
    let data: bytes::Bytes = github.download_bytes(&download_url).await?;
    let total = data.len() as u64;

    app.emit(
        "download-progress",
        DownloadProgress {
            tool_id: tool_id.clone(),
            downloaded: total,
            total,
        },
    )
    .ok();

    // Extract to temp dir first, then move atomically
    let tool_dir = tools_dir().join(&tool_id);
    let temp_dir = tools_dir().join(format!("{}_temp", tool_id));
    if temp_dir.exists() {
        std::fs::remove_dir_all(&temp_dir)?;
    }
    std::fs::create_dir_all(&temp_dir)?;

    let asset_filename = download_url.split('/').last().unwrap_or("binary");
    extract_archive(&data, &temp_dir, asset_filename)?;

    // Determine the stable binary name from catalog
    let platform = current_platform();
    let binary_name = catalog_entry
        .binary_name
        .get(platform)
        .cloned()
        .unwrap_or_else(|| tool_id.clone());

    // Rename downloaded file to the stable binary name (strips version from filename)
    let downloaded_path = temp_dir.join(asset_filename);
    let stable_path = temp_dir.join(&binary_name);
    if downloaded_path.exists() && downloaded_path != stable_path {
        std::fs::rename(&downloaded_path, &stable_path)?;
    }

    // Set executable permissions on Linux
    set_executable(&temp_dir)?;

    // Atomic swap
    if tool_dir.exists() {
        let backup = tools_dir().join(format!("{}_old", tool_id));
        if backup.exists() {
            std::fs::remove_dir_all(&backup)?;
        }
        std::fs::rename(&tool_dir, &backup)?;
        std::fs::rename(&temp_dir, &tool_dir)?;
        std::fs::remove_dir_all(&backup).ok();
    } else {
        std::fs::rename(&temp_dir, &tool_dir)?;
    }

    let binary_path = tool_dir.join(&binary_name);

    // Register in installed DB
    let now = chrono::Utc::now().to_rfc3339();
    let installed = InstalledTool {
        id: tool_id.clone(),
        name: catalog_entry.name.clone(),
        installed_version: version.clone(),
        installed_at: now.clone(),
        updated_at: now,
        install_path: tool_dir.to_string_lossy().to_string(),
        binary_path: binary_path.to_string_lossy().to_string(),
        repo: catalog_entry.repo.clone(),
    };

    let mut db = read_installed_db()?;
    db.tools.insert(tool_id, installed.clone());
    write_installed_db(&db)?;

    Ok(installed)
}

#[tauri::command]
pub async fn uninstall_tool(tool_id: String) -> AppResult<()> {
    let mut db = read_installed_db()?;
    if db.tools.remove(&tool_id).is_none() {
        return Err(AppError::ToolNotInstalled(tool_id));
    }
    write_installed_db(&db)?;

    let tool_dir = tools_dir().join(&tool_id);
    if tool_dir.exists() {
        std::fs::remove_dir_all(tool_dir)?;
    }

    Ok(())
}
