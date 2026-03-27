use tauri::{AppHandle, Emitter, State};

use crate::error::{AppError, AppResult};
use crate::github::GitHubClient;
use crate::models::{DownloadProgress, LinkEntry};
use crate::paths::icons_dir;

use serde::{Deserialize, Serialize};

const CATALOG_REPO: &str = "Alexys829/pyarsenal-catalog";
const CATALOG_PATH: &str = "catalog.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinkValidation {
    pub valid: bool,
    pub final_url: String,
    pub filename: String,
    pub content_type: String,
    pub size: u64,
}

/// Convert Google Drive share links to direct download URLs
fn convert_gdrive_url(url: &str) -> String {
    // https://drive.google.com/file/d/FILE_ID/view?usp=sharing
    if url.contains("drive.google.com/file/d/") {
        if let Some(id_start) = url.find("/d/") {
            let rest = &url[id_start + 3..];
            if let Some(id_end) = rest.find('/') {
                let file_id = &rest[..id_end];
                return format!("https://drive.google.com/uc?export=download&id={}", file_id);
            }
        }
    }
    // https://drive.google.com/open?id=FILE_ID
    if url.contains("drive.google.com/open?id=") {
        if let Some(id_start) = url.find("id=") {
            let file_id = &url[id_start + 3..];
            let file_id = file_id.split('&').next().unwrap_or(file_id);
            return format!("https://drive.google.com/uc?export=download&id={}", file_id);
        }
    }
    // Already a direct link or other URL
    url.to_string()
}

/// Validate a link by making a HEAD request
#[tauri::command]
pub async fn validate_link(url: String, _github: State<'_, GitHubClient>) -> AppResult<LinkValidation> {
    let direct_url = convert_gdrive_url(&url);

    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|e| AppError::Generic(format!("HTTP client error: {}", e)))?;

    let resp = client
        .head(&direct_url)
        .header("User-Agent", "PyArsenal")
        .send()
        .await
        .map_err(|e| AppError::Generic(format!("Link unreachable: {}", e)))?;

    if !resp.status().is_success() && resp.status() != reqwest::StatusCode::METHOD_NOT_ALLOWED {
        // Some servers don't support HEAD, try GET with range
        let resp2 = client
            .get(&direct_url)
            .header("User-Agent", "PyArsenal")
            .header("Range", "bytes=0-0")
            .send()
            .await
            .map_err(|e| AppError::Generic(format!("Link unreachable: {}", e)))?;

        if !resp2.status().is_success() && resp2.status() != reqwest::StatusCode::PARTIAL_CONTENT {
            return Ok(LinkValidation {
                valid: false,
                final_url: direct_url,
                filename: String::new(),
                content_type: String::new(),
                size: 0,
            });
        }

        let content_type = resp2
            .headers()
            .get("content-type")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_string();

        // If it returns HTML, it's likely a confirmation page (Google Drive large files)
        if content_type.contains("text/html") {
            return Ok(LinkValidation {
                valid: true,
                final_url: direct_url,
                filename: guess_filename_from_url(&url),
                content_type: "application/octet-stream".to_string(),
                size: 0,
            });
        }

        let fname = extract_filename(resp2.headers(), &direct_url);
        return Ok(LinkValidation {
            valid: true,
            final_url: direct_url,
            filename: fname,
            content_type,
            size: 0,
        });
    }

    let content_type = resp
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    let size = resp
        .headers()
        .get("content-length")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(0);

    let filename = extract_filename(resp.headers(), &direct_url);

    Ok(LinkValidation {
        valid: true,
        final_url: direct_url,
        filename,
        content_type,
        size,
    })
}

fn extract_filename(headers: &reqwest::header::HeaderMap, url: &str) -> String {
    // Try content-disposition header
    if let Some(cd) = headers.get("content-disposition") {
        if let Ok(cd_str) = cd.to_str() {
            if let Some(pos) = cd_str.find("filename=") {
                let name = &cd_str[pos + 9..];
                let name = name.trim_matches('"').trim_matches('\'');
                if !name.is_empty() {
                    return name.to_string();
                }
            }
        }
    }
    guess_filename_from_url(url)
}

fn guess_filename_from_url(url: &str) -> String {
    url.split('/')
        .last()
        .unwrap_or("download")
        .split('?')
        .next()
        .unwrap_or("download")
        .to_string()
}

/// Resolve Google Drive confirmation page to get the real download URL
fn resolve_gdrive_confirm(html: &str, file_id: &str) -> Option<String> {
    // Parse the confirmation form action and parameters
    // The form action is like: https://drive.usercontent.google.com/download
    // with hidden fields: id, export, confirm, uuid
    if html.contains("download-form") && html.contains("confirm") {
        // Extract confirm value
        let confirm = extract_hidden_value(html, "confirm").unwrap_or("t".to_string());
        let uuid = extract_hidden_value(html, "uuid").unwrap_or_default();

        let mut url = format!(
            "https://drive.usercontent.google.com/download?id={}&export=download&confirm={}",
            file_id, confirm
        );
        if !uuid.is_empty() {
            url.push_str(&format!("&uuid={}", uuid));
        }
        return Some(url);
    }
    None
}

fn extract_hidden_value(html: &str, name: &str) -> Option<String> {
    let needle = format!("name=\"{}\"", name);
    if let Some(pos) = html.find(&needle) {
        let before = &html[..pos];
        let after = &html[pos..];
        // Look for value="..." in the same input tag
        if let Some(val_pos) = after.find("value=\"") {
            let val_start = val_pos + 7;
            if let Some(val_end) = after[val_start..].find('"') {
                return Some(after[val_start..val_start + val_end].to_string());
            }
        }
        // Also check before (value might come before name)
        let tag_start = before.rfind('<').unwrap_or(0);
        let tag_html = &html[tag_start..pos + needle.len() + 50];
        if let Some(val_pos) = tag_html.find("value=\"") {
            let val_start = val_pos + 7;
            if let Some(val_end) = tag_html[val_start..].find('"') {
                return Some(tag_html[val_start..val_start + val_end].to_string());
            }
        }
    }
    None
}

fn extract_gdrive_file_id(url: &str) -> Option<String> {
    if url.contains("id=") {
        let id = url.split("id=").nth(1)?;
        return Some(id.split('&').next().unwrap_or(id).to_string());
    }
    if url.contains("/d/") {
        let rest = url.split("/d/").nth(1)?;
        return Some(rest.split('/').next().unwrap_or(rest).to_string());
    }
    None
}

/// Download a link file to a specified directory
#[tauri::command]
pub async fn download_link(
    link_id: String,
    url: String,
    filename: String,
    dest_dir: String,
    app: AppHandle,
    github: State<'_, GitHubClient>,
) -> AppResult<String> {
    let mut download_url = convert_gdrive_url(&url);
    let dest_path = std::path::Path::new(&dest_dir).join(&filename);

    // First attempt — check if we get HTML (Google Drive confirmation page)
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|e| AppError::Generic(e.to_string()))?;

    let probe = client
        .get(&download_url)
        .header("User-Agent", "PyArsenal")
        .send()
        .await
        .map_err(|e| AppError::Generic(format!("Download failed: {}", e)))?;

    let content_type = probe
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    if content_type.contains("text/html") {
        // Google Drive virus scan warning — parse confirmation page
        let html = probe.text().await.unwrap_or_default();
        let file_id = extract_gdrive_file_id(&url).unwrap_or_default();
        if let Some(confirm_url) = resolve_gdrive_confirm(&html, &file_id) {
            download_url = confirm_url;
        }
    }

    // Now do the real download with progress
    let start_time = std::time::Instant::now();
    let app_clone = app.clone();
    let lid = link_id.clone();

    let data = github
        .download_streaming(
            &download_url,
            tokio_util::sync::CancellationToken::new(),
            move |downloaded, total| {
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
                                tool_id: lid.clone(),
                                downloaded,
                                total,
                                speed_bps,
                            },
                        )
                        .ok();
                }
            },
        )
        .await?;

    // Verify we didn't get HTML again
    if data.len() < 1000 && data.starts_with(b"<!DOCTYPE") {
        return Err(AppError::Generic(
            "Google Drive returned a confirmation page. The file may require manual download.".to_string()
        ));
    }

    std::fs::write(&dest_path, &data)?;

    Ok(dest_path.to_string_lossy().to_string())
}

/// Get a link icon (from catalog repo icons/links/{id}.png)
#[tauri::command]
pub async fn get_link_icon(link_id: String, github: State<'_, GitHubClient>) -> AppResult<String> {
    use base64::Engine;

    let cache_name = format!("link-{}.png", link_id);
    let local_path = icons_dir().join(&cache_name);

    // Return cached
    if local_path.exists() {
        if let Ok(data) = std::fs::read(&local_path) {
            if data.len() > 100 && data.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
                let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
                return Ok(format!("data:image/png;base64,{}", b64));
            }
            std::fs::remove_file(&local_path).ok();
        }
    }

    // Download from catalog repo
    for branch in &["main", "master"] {
        let url = format!(
            "https://raw.githubusercontent.com/{}/{}/icons/links/{}.png",
            CATALOG_REPO, branch, link_id
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

/// Upload a link icon to the catalog repo
#[tauri::command]
pub async fn upload_link_icon(
    link_id: String,
    icon_base64: String,
    github: State<'_, GitHubClient>,
) -> AppResult<()> {
    use base64::Engine;

    let pat = get_pat_or_error(&github).await?;
    let path = format!("icons/links/{}.png", link_id);
    let url = format!(
        "https://api.github.com/repos/{}/contents/{}",
        CATALOG_REPO, path
    );

    // Check if file already exists (get SHA)
    let client = reqwest::Client::new();
    let existing_sha = {
        let resp = client
            .get(&url)
            .header("User-Agent", "PyArsenal")
            .header("Accept", "application/vnd.github.v3+json")
            .header("Authorization", format!("Bearer {}", pat))
            .send()
            .await;
        if let Ok(r) = resp {
            if r.status().is_success() {
                let body: serde_json::Value = r.json().await.unwrap_or_default();
                body["sha"].as_str().map(|s| s.to_string())
            } else {
                None
            }
        } else {
            None
        }
    };

    let mut body = serde_json::json!({
        "message": format!("Add icon for link {}", link_id),
        "content": icon_base64
    });

    if let Some(sha) = existing_sha {
        body["sha"] = serde_json::Value::String(sha);
    }

    let resp = client
        .put(&url)
        .header("User-Agent", "PyArsenal")
        .header("Accept", "application/vnd.github.v3+json")
        .header("Authorization", format!("Bearer {}", pat))
        .json(&body)
        .send()
        .await
        .map_err(|e| AppError::Generic(format!("Failed to upload icon: {}", e)))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(AppError::Generic(format!("GitHub API error {}: {}", status, text)));
    }

    Ok(())
}

/// Open a file with the system's default application
#[tauri::command]
pub async fn open_file(path: String) -> AppResult<()> {
    #[cfg(unix)]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
            .map_err(|e| AppError::Generic(format!("Failed to open file: {}", e)))?;
    }
    #[cfg(windows)]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| AppError::Generic(format!("Failed to open file: {}", e)))?;
    }
    Ok(())
}

/// Open the folder containing a file
#[tauri::command]
pub async fn open_file_folder(path: String) -> AppResult<()> {
    let folder = std::path::Path::new(&path)
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or(path.clone());

    #[cfg(unix)]
    {
        std::process::Command::new("xdg-open")
            .arg(&folder)
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
            .map_err(|e| AppError::Generic(format!("Failed to open folder: {}", e)))?;
    }
    #[cfg(windows)]
    {
        std::process::Command::new("explorer")
            .arg(&folder)
            .spawn()
            .map_err(|e| AppError::Generic(format!("Failed to open folder: {}", e)))?;
    }
    Ok(())
}

/// Get default download directory (Desktop)
#[tauri::command]
pub async fn get_default_download_dir() -> AppResult<String> {
    let desktop = dirs::desktop_dir()
        .or_else(|| dirs::download_dir())
        .unwrap_or_else(|| dirs::home_dir().unwrap_or_default());
    Ok(desktop.to_string_lossy().to_string())
}

async fn get_pat_or_error(github: &GitHubClient) -> AppResult<String> {
    let entry = keyring::Entry::new("pyarsenal", "github_pat")
        .map_err(|e| AppError::Keychain(e.to_string()))?;
    match entry.get_password() {
        Ok(pat) => Ok(pat),
        _ => Err(AppError::Generic(
            "GitHub PAT required.".to_string()
        )),
    }
}
