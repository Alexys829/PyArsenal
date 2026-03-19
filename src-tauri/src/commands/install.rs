use std::collections::HashMap;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use tauri::{Emitter, State, AppHandle};
use tokio_util::sync::CancellationToken;

use crate::commands::library::{read_installed_db, write_installed_db};
use crate::error::{AppError, AppResult};
use crate::github::GitHubClient;
use crate::models::{
    current_platform, CatalogEntry, DownloadProgress, InstalledTool,
};
use crate::paths::tools_dir;

/// Tracks active download cancellation tokens
pub struct DownloadManager {
    pub tokens: Mutex<HashMap<String, CancellationToken>>,
}

impl DownloadManager {
    pub fn new() -> Self {
        Self {
            tokens: Mutex::new(HashMap::new()),
        }
    }
}

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

/// Detect install type from catalog entry or infer from filename
fn get_install_type(entry: &CatalogEntry, filename: &str) -> String {
    let platform = current_platform();
    // Explicit from catalog
    if let Some(t) = entry.install_type.get(platform) {
        return t.clone();
    }
    // Infer from filename
    if filename.ends_with(".tar.gz") || filename.ends_with(".tgz") || filename.ends_with(".zip") {
        "archive".to_string()
    } else {
        "binary".to_string()
    }
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
        return Err(AppError::Extraction(format!("Unknown archive format: {}", filename)));
    }
    Ok(())
}

/// Run an Inno Setup installer silently, installing into dest_dir (Windows only)
fn run_innosetup(installer_path: &Path, dest_dir: &Path) -> AppResult<()> {
    let status = std::process::Command::new(installer_path)
        .args([
            "/VERYSILENT",
            "/SUPPRESSMSGBOXES",
            "/NORESTART",
            "/NOICONS",
            &format!("/DIR={}", dest_dir.to_string_lossy()),
        ])
        .status()
        .map_err(|e| AppError::Generic(format!("Failed to run installer: {}", e)))?;

    if !status.success() {
        return Err(AppError::Generic(format!(
            "Installer exited with code: {}",
            status.code().unwrap_or(-1)
        )));
    }
    Ok(())
}

/// Find the binary inside a directory, searching recursively if needed
fn find_binary(dir: &Path, binary_name: &str) -> Option<PathBuf> {
    // Check root first
    let root_path = dir.join(binary_name);
    if root_path.exists() {
        return Some(root_path);
    }
    // Search one level deep (common for zip archives)
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                let nested = entry.path().join(binary_name);
                if nested.exists() {
                    return Some(nested);
                }
            }
        }
    }
    None
}

#[cfg(unix)]
fn set_executable(path: &Path) -> AppResult<()> {
    use std::os::unix::fs::PermissionsExt;
    if path.is_dir() {
        for entry in std::fs::read_dir(path)? {
            let entry = entry?;
            let ft = entry.file_type()?;
            if ft.is_file() {
                let mut perms = entry.metadata()?.permissions();
                perms.set_mode(0o755);
                std::fs::set_permissions(entry.path(), perms)?;
            } else if ft.is_dir() {
                set_executable(&entry.path())?;
            }
        }
    } else if path.is_file() {
        let mut perms = std::fs::metadata(path)?.permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(path, perms)?;
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
    download_mgr: State<'_, DownloadManager>,
) -> AppResult<InstalledTool> {
    let release = github.get_latest_release(&catalog_entry.repo).await?;
    let (download_url, version, _asset_size) = find_asset_url(&catalog_entry, &release)?;

    // Create cancellation token for this download
    let cancel = CancellationToken::new();
    {
        let mut tokens = download_mgr.tokens.lock().unwrap();
        tokens.insert(tool_id.clone(), cancel.clone());
    }

    // Download with streaming progress
    let app_clone = app.clone();
    let tid = tool_id.clone();
    let tid2 = tool_id.clone();
    let start_time = std::time::Instant::now();

    let result = github
        .download_streaming(&download_url, cancel, move |downloaded, total| {
            let elapsed = start_time.elapsed().as_secs_f64();
            let speed_bps = if elapsed > 0.0 {
                (downloaded as f64 / elapsed) as u64
            } else {
                0
            };
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
        .await;

    // Remove cancellation token
    {
        let mut tokens = download_mgr.tokens.lock().unwrap();
        tokens.remove(&tid2);
    }

    let data = result?;

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

    let tool_dir = tools_dir().join(&tool_id);
    let temp_dir = tools_dir().join(format!("{}_temp", tool_id));
    if temp_dir.exists() {
        std::fs::remove_dir_all(&temp_dir)?;
    }
    std::fs::create_dir_all(&temp_dir)?;

    let asset_filename = download_url.split('/').last().unwrap_or("binary");
    let install_type = get_install_type(&catalog_entry, asset_filename);
    let platform = current_platform();
    let binary_name = catalog_entry
        .binary_name
        .get(platform)
        .cloned()
        .unwrap_or_else(|| tool_id.clone());

    match install_type.as_str() {
        "innosetup" => {
            // Save installer to temp, run it pointing to tool_dir
            let installer_path = temp_dir.join(asset_filename);
            std::fs::write(&installer_path, &data)?;

            // Inno Setup installs directly into tool_dir
            if tool_dir.exists() {
                std::fs::remove_dir_all(&tool_dir)?;
            }
            std::fs::create_dir_all(&tool_dir)?;

            run_innosetup(&installer_path, &tool_dir)?;

            // Cleanup temp
            std::fs::remove_dir_all(&temp_dir).ok();
        }
        "archive" => {
            // Extract archive
            extract_archive(&data, &temp_dir, asset_filename)?;

            // If the binary is nested in a subfolder, move contents up
            // or just do atomic swap as before
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
        }
        _ => {
            // "binary" — single file (.AppImage, .exe, etc.)
            let bin_path = temp_dir.join(asset_filename);
            std::fs::write(&bin_path, &data)?;

            // Rename to stable name
            let stable_path = temp_dir.join(&binary_name);
            if bin_path != stable_path {
                std::fs::rename(&bin_path, &stable_path)?;
            }

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
        }
    }

    // Find the actual binary path
    let binary_path = find_binary(&tool_dir, &binary_name)
        .unwrap_or_else(|| tool_dir.join(&binary_name));

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
pub async fn cancel_install(tool_id: String, download_mgr: State<'_, DownloadManager>) -> AppResult<()> {
    let mut tokens = download_mgr.tokens.lock().unwrap();
    if let Some(token) = tokens.remove(&tool_id) {
        token.cancel();
    }
    // Clean up temp dir if it exists
    let temp_dir = tools_dir().join(format!("{}_temp", tool_id));
    if temp_dir.exists() {
        std::fs::remove_dir_all(temp_dir).ok();
    }
    Ok(())
}

#[tauri::command]
pub async fn uninstall_tool(tool_id: String) -> AppResult<()> {
    let mut db = read_installed_db()?;
    let tool = db.tools.remove(&tool_id)
        .ok_or_else(|| AppError::ToolNotInstalled(tool_id.clone()))?;
    write_installed_db(&db)?;

    // Check if it was installed via Inno Setup (has uninstaller)
    let tool_dir = tools_dir().join(&tool_id);
    let uninstaller = tool_dir.join("unins000.exe");
    if uninstaller.exists() {
        // Run Inno Setup uninstaller silently
        std::process::Command::new(&uninstaller)
            .args(["/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART"])
            .status()
            .ok();
        // Wait a bit for uninstaller to finish, then clean up
        std::thread::sleep(std::time::Duration::from_secs(2));
    }

    if tool_dir.exists() {
        std::fs::remove_dir_all(&tool_dir)?;
    }

    // Also remove desktop shortcut if it exists
    let tool_name = tool.name.clone();
    let _ = super::desktop::remove_tool_shortcut(tool_id, tool_name).await;

    Ok(())
}
