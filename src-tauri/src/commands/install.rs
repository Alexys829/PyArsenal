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

fn find_asset_url(entry: &CatalogEntry, release: &crate::models::GitHubRelease) -> AppResult<(String, String, u64)> {
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
            return Ok((asset.browser_download_url.clone(), version.to_string(), asset.size));
        }
    }

    // Fallback: try matching without exact version (pattern-based)
    for asset in &release.assets {
        if asset.name.contains(platform) {
            return Ok((asset.browser_download_url.clone(), version.to_string(), asset.size));
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

fn dir_size(path: &Path) -> u64 {
    let mut total = 0u64;
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            let meta = entry.metadata();
            if let Ok(m) = meta {
                if m.is_file() {
                    total += m.len();
                } else if m.is_dir() {
                    total += dir_size(&entry.path());
                }
            }
        }
    }
    total
}

#[tauri::command]
pub async fn install_tool(
    tool_id: String,
    catalog_entry: CatalogEntry,
    app: AppHandle,
    github: State<'_, GitHubClient>,
) -> AppResult<InstalledTool> {
    let release = github.get_latest_release(&catalog_entry.repo).await?;
    let (download_url, version, _asset_size) = find_asset_url(&catalog_entry, &release)?;

    // Download with streaming progress
    let app_clone = app.clone();
    let tid = tool_id.clone();
    let start_time = std::time::Instant::now();

    let data = github
        .download_streaming(&download_url, move |downloaded, total| {
            let elapsed = start_time.elapsed().as_secs_f64();
            let speed_bps = if elapsed > 0.0 {
                (downloaded as f64 / elapsed) as u64
            } else {
                0
            };
            // Throttle events to ~10/sec
            if downloaded == total || downloaded % (256 * 1024) < 65536 {
                app_clone
                    .emit(
                        "download-progress",
                        DownloadProgress {
                            tool_id: tid.clone(),
                            downloaded,
                            total,
                            speed_bps,
                        },
                    )
                    .ok();
            }
        })
        .await?;

    // Emit 100% completion
    app.emit(
        "download-progress",
        DownloadProgress {
            tool_id: tool_id.clone(),
            downloaded: data.len() as u64,
            total: data.len() as u64,
            speed_bps: 0,
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
    let size_bytes = dir_size(&tool_dir);

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
        size_bytes,
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
