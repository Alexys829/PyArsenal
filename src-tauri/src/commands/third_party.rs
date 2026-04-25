use tauri::{AppHandle, Emitter, State};

use crate::error::{AppError, AppResult};
use crate::github::GitHubClient;
use crate::models::{Catalog, CommandOutput, DownloadProgress, ThirdPartyEntry};
use crate::paths::icons_dir;
use tokio::io::{AsyncBufReadExt, BufReader};

use serde::{Deserialize, Serialize};

const CATALOG_REPO: &str = "Alexys829/pyarsenal-catalog";
const CATALOG_PATH: &str = "catalog.json";

// ── Re-use the same catalog read/write helpers as admin.rs ──

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

    let sha = file_info["sha"]
        .as_str()
        .ok_or_else(|| AppError::Generic("Could not get catalog SHA".to_string()))?
        .to_string();
    let content_b64 = file_info["content"]
        .as_str()
        .ok_or_else(|| AppError::Generic("Could not get catalog content".to_string()))?;

    let clean_b64: String = content_b64.chars().filter(|c| !c.is_whitespace()).collect();
    use base64::Engine;
    let decoded = base64::engine::general_purpose::STANDARD
        .decode(&clean_b64)
        .map_err(|e| AppError::Generic(format!("Base64 decode error: {}", e)))?;
    let catalog_str = String::from_utf8(decoded)
        .map_err(|e| AppError::Generic(format!("UTF-8 error: {}", e)))?;

    let catalog: Catalog = serde_json::from_str(&catalog_str)?;
    Ok(CatalogFile { catalog, sha })
}

async fn push_catalog_file(
    catalog: &Catalog,
    sha: &str,
    message: &str,
    github: &GitHubClient,
) -> AppResult<()> {
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
    let resp = client
        .put(&url)
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

// ── Input sanitization ──

/// Reject app IDs that aren't safe to embed in filesystem paths.
/// Only alphanumerics, `_` and `-` allowed.
fn validate_app_id(id: &str) -> AppResult<()> {
    if id.is_empty() || id.len() > 64 {
        return Err(AppError::Generic("Invalid app id length".to_string()));
    }
    if !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-') {
        return Err(AppError::Generic(format!(
            "Invalid app id '{}': only [A-Za-z0-9_-] allowed",
            id
        )));
    }
    Ok(())
}

/// Strip any path component from a filename and reject traversal attempts.
/// Returns just the basename, or an error for empty / dotfile-only / absolute names.
fn sanitize_filename(name: &str) -> AppResult<String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err(AppError::Generic("Empty filename".to_string()));
    }
    let basename = std::path::Path::new(trimmed)
        .file_name()
        .and_then(|s| s.to_str())
        .ok_or_else(|| AppError::Generic(format!("Invalid filename: {}", name)))?;
    if basename == "." || basename == ".." || basename.contains('\0') {
        return Err(AppError::Generic(format!("Unsafe filename: {}", name)));
    }
    Ok(basename.to_string())
}

// ── URL validation (re-usable) ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThirdPartyUrlValidation {
    pub valid: bool,
    pub final_url: String,
    pub filename: String,
    pub content_type: String,
    pub size: u64,
    pub service: String,
    pub error: String,
}

fn detect_service(url: &str) -> &'static str {
    if url.contains("drive.google.com") { "Google Drive" }
    else if url.contains("dropbox.com") { "Dropbox" }
    else if url.contains("1drv.ms") || url.contains("onedrive.live.com") || url.contains("sharepoint.com") { "OneDrive" }
    else if url.contains("mediafire.com") { "MediaFire" }
    else if url.contains("mega.nz") || url.contains("mega.co.nz") { "MEGA" }
    else if url.contains("github.com") || url.contains("githubusercontent.com") { "GitHub" }
    else { "Direct" }
}

fn convert_to_direct(url: &str) -> String {
    if url.contains("drive.google.com/file/d/") {
        if let Some(id_start) = url.find("/d/") {
            let rest = &url[id_start + 3..];
            if let Some(id_end) = rest.find('/') {
                let file_id = &rest[..id_end];
                return format!("https://drive.google.com/uc?export=download&id={}", file_id);
            }
        }
    }
    if url.contains("drive.google.com/open?id=") {
        if let Some(id_start) = url.find("id=") {
            let file_id = &url[id_start + 3..];
            let file_id = file_id.split('&').next().unwrap_or(file_id);
            return format!("https://drive.google.com/uc?export=download&id={}", file_id);
        }
    }
    if url.contains("dropbox.com/") {
        let mut direct = url.to_string();
        if direct.contains("dl=0") {
            direct = direct.replace("dl=0", "dl=1");
        } else if !direct.contains("dl=1") {
            if direct.contains('?') { direct.push_str("&dl=1"); } else { direct.push_str("?dl=1"); }
        }
        return direct;
    }
    if url.contains("1drv.ms/") || url.contains("onedrive.live.com/") || url.contains("sharepoint.com/") {
        let mut direct = url.to_string();
        if !direct.contains("download=1") {
            if direct.contains('?') { direct.push_str("&download=1"); } else { direct.push_str("?download=1"); }
        }
        return direct;
    }
    url.to_string()
}

fn guess_filename(url: &str) -> String {
    url.split('/')
        .last()
        .unwrap_or("download")
        .split('?')
        .next()
        .unwrap_or("download")
        .to_string()
}

/// Percent-decode bytes from RFC 5987 `filename*` values.
fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let hi = (bytes[i + 1] as char).to_digit(16);
            let lo = (bytes[i + 2] as char).to_digit(16);
            if let (Some(h), Some(l)) = (hi, lo) {
                out.push((h * 16 + l) as u8);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// Parse Content-Disposition for a filename. Handles:
/// - `filename*=UTF-8''percent%20encoded.bin`  (RFC 5987 — preferred when present)
/// - `filename="quoted name.bin"` / `filename=plain.bin`
fn parse_content_disposition(cd: &str) -> Option<String> {
    // RFC 5987 first
    if let Some(pos) = cd.to_ascii_lowercase().find("filename*=") {
        let raw = &cd[pos + "filename*=".len()..];
        let value = raw.split(';').next().unwrap_or("").trim();
        // value: charset'lang'percent-encoded
        let mut parts = value.splitn(3, '\'');
        let _charset = parts.next();
        let _lang = parts.next();
        if let Some(encoded) = parts.next() {
            let decoded = percent_decode(encoded.trim());
            if !decoded.is_empty() {
                return Some(decoded);
            }
        }
    }
    // Fallback: filename=...
    if let Some(pos) = cd.to_ascii_lowercase().find("filename=") {
        let raw = &cd[pos + "filename=".len()..];
        // take up to the next semicolon (param separator), respecting double quotes
        let mut end = raw.len();
        let mut in_quotes = false;
        for (i, ch) in raw.char_indices() {
            match ch {
                '"' => in_quotes = !in_quotes,
                ';' if !in_quotes => { end = i; break; }
                _ => {}
            }
        }
        let name = raw[..end].trim().trim_matches('"').trim();
        if !name.is_empty() {
            return Some(name.to_string());
        }
    }
    None
}

fn extract_filename_from_headers(headers: &reqwest::header::HeaderMap, url: &str) -> String {
    if let Some(cd) = headers.get("content-disposition") {
        if let Ok(cd_str) = cd.to_str() {
            if let Some(name) = parse_content_disposition(cd_str) {
                return name;
            }
        }
    }
    guess_filename(url)
}

/// Validate a single download URL for a third-party app entry.
/// Returns validation result with detected filename and size.
#[tauri::command]
pub async fn validate_third_party_url(
    url: String,
    _github: State<'_, GitHubClient>,
) -> AppResult<ThirdPartyUrlValidation> {
    let service = detect_service(&url);

    if url.trim().is_empty() {
        return Ok(ThirdPartyUrlValidation {
            valid: false,
            final_url: url,
            filename: String::new(),
            content_type: String::new(),
            size: 0,
            service: service.to_string(),
            error: "URL is empty".to_string(),
        });
    }

    if service == "MEGA" {
        return Ok(ThirdPartyUrlValidation {
            valid: true,
            final_url: url.clone(),
            filename: guess_filename(&url),
            content_type: "application/octet-stream".to_string(),
            size: 0,
            service: service.to_string(),
            error: String::new(),
        });
    }

    let direct_url = convert_to_direct(&url);

    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(10))
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| AppError::Generic(format!("HTTP client error: {}", e)))?;

    // Try HEAD first
    let head_result = client
        .head(&direct_url)
        .header("User-Agent", "PyArsenal/1.0")
        .send()
        .await;

    match head_result {
        Ok(resp) if resp.status().is_success() || resp.status() == 206 => {
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
            let filename = sanitize_filename(&extract_filename_from_headers(resp.headers(), &direct_url))
                .unwrap_or_else(|_| "download".to_string());
            return Ok(ThirdPartyUrlValidation {
                valid: true,
                final_url: direct_url,
                filename,
                content_type,
                size,
                service: service.to_string(),
                error: String::new(),
            });
        }
        _ => {}
    }

    // Fallback: GET with Range: bytes=0-0
    let get_result = client
        .get(&direct_url)
        .header("User-Agent", "PyArsenal/1.0")
        .header("Range", "bytes=0-0")
        .send()
        .await;

    match get_result {
        Ok(resp) if resp.status().is_success() || resp.status() == 206 => {
            let content_type = resp
                .headers()
                .get("content-type")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("")
                .to_string();
            // content-range: bytes 0-0/TOTAL
            let size = resp
                .headers()
                .get("content-range")
                .and_then(|v| v.to_str().ok())
                .and_then(|v| v.split('/').last())
                .and_then(|v| v.parse::<u64>().ok())
                .or_else(|| {
                    resp.headers()
                        .get("content-length")
                        .and_then(|v| v.to_str().ok())
                        .and_then(|v| v.parse::<u64>().ok())
                })
                .unwrap_or(0);
            let filename = sanitize_filename(&extract_filename_from_headers(resp.headers(), &direct_url))
                .unwrap_or_else(|_| "download".to_string());
            // HTML response = redirect/confirmation page, still mark valid
            let ct = if content_type.contains("text/html") {
                "application/octet-stream".to_string()
            } else {
                content_type
            };
            Ok(ThirdPartyUrlValidation {
                valid: true,
                final_url: direct_url,
                filename,
                content_type: ct,
                size,
                service: service.to_string(),
                error: String::new(),
            })
        }
        Ok(resp) => Ok(ThirdPartyUrlValidation {
            valid: false,
            final_url: direct_url,
            filename: String::new(),
            content_type: String::new(),
            size: 0,
            service: service.to_string(),
            error: format!("HTTP {}", resp.status()),
        }),
        Err(e) => Ok(ThirdPartyUrlValidation {
            valid: false,
            final_url: direct_url,
            filename: String::new(),
            content_type: String::new(),
            size: 0,
            service: service.to_string(),
            error: format!("Unreachable: {}", e),
        }),
    }
}

// ── CRUD commands ──

#[tauri::command]
pub async fn get_third_party_apps(
    github: State<'_, GitHubClient>,
) -> AppResult<Vec<ThirdPartyEntry>> {
    let cf = fetch_catalog_file(&github).await?;
    Ok(cf.catalog.third_party)
}

#[tauri::command]
pub async fn add_third_party_app(
    entry: ThirdPartyEntry,
    github: State<'_, GitHubClient>,
) -> AppResult<()> {
    validate_app_id(&entry.id)?;
    let mut cf = fetch_catalog_file(&github).await?;
    if cf.catalog.third_party.iter().any(|e| e.id == entry.id) {
        return Err(AppError::Generic(format!(
            "Third-party app '{}' already exists",
            entry.id
        )));
    }
    let msg = format!("Add third-party app: {}", entry.name);
    cf.catalog.third_party.push(entry);
    cf.catalog.updated_at = chrono::Utc::now().to_rfc3339();
    push_catalog_file(&cf.catalog, &cf.sha, &msg, &github).await
}

#[tauri::command]
pub async fn update_third_party_app(
    entry: ThirdPartyEntry,
    github: State<'_, GitHubClient>,
) -> AppResult<()> {
    validate_app_id(&entry.id)?;
    let mut cf = fetch_catalog_file(&github).await?;
    match cf.catalog.third_party.iter_mut().find(|e| e.id == entry.id) {
        Some(existing) => *existing = entry.clone(),
        None => {
            return Err(AppError::Generic(format!(
                "Third-party app '{}' not found",
                entry.id
            )))
        }
    }
    cf.catalog.updated_at = chrono::Utc::now().to_rfc3339();
    let msg = format!("Update third-party app: {}", entry.name);
    push_catalog_file(&cf.catalog, &cf.sha, &msg, &github).await
}

#[tauri::command]
pub async fn remove_third_party_app(
    app_id: String,
    github: State<'_, GitHubClient>,
) -> AppResult<()> {
    validate_app_id(&app_id)?;
    let mut cf = fetch_catalog_file(&github).await?;
    let before = cf.catalog.third_party.len();
    cf.catalog.third_party.retain(|e| e.id != app_id);
    if cf.catalog.third_party.len() == before {
        return Err(AppError::Generic(format!(
            "Third-party app '{}' not found",
            app_id
        )));
    }
    cf.catalog.updated_at = chrono::Utc::now().to_rfc3339();
    let msg = format!("Remove third-party app: {}", app_id);
    push_catalog_file(&cf.catalog, &cf.sha, &msg, &github).await
}

// ── Download command ──

/// Download a third-party app.
///
/// - `app_id`       : used as the `tool_id` in progress events
/// - `url`          : direct download URL (already selected for platform by frontend)
/// - `filename`     : expected filename
/// - `download_type`: `"installer"` or `"archive"`
/// - `dest_dir`     : destination directory
///   - for `installer`: temp dir; file is launched then deleted
///   - for `archive`  : the user-chosen directory where the file is saved
///
/// Returns the final file path (for `archive`) or empty string (for `installer`).
#[tauri::command]
pub async fn download_third_party_app(
    app_id: String,
    url: String,
    filename: String,
    download_type: String,
    dest_dir: String,
    app: AppHandle,
    github: State<'_, GitHubClient>,
) -> AppResult<String> {
    validate_app_id(&app_id)?;
    let safe_filename = sanitize_filename(&filename)?;

    if download_type != "installer" && download_type != "archive" {
        return Err(AppError::Generic(format!(
            "Invalid download_type '{}': expected 'installer' or 'archive'",
            download_type
        )));
    }

    let start_time = std::time::Instant::now();
    let app_clone = app.clone();
    let aid = app_id.clone();

    // Emit initial progress
    app.emit(
        "download-progress",
        DownloadProgress {
            tool_id: app_id.clone(),
            downloaded: 0,
            total: 0,
            speed_bps: 0,
        },
    )
    .ok();

    // Determine actual download URL
    let direct_url = convert_to_direct(&url);

    // Download with progress
    let data = github
        .download_streaming(
            &direct_url,
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
                                tool_id: aid.clone(),
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

    // Detect HTML payloads disguised as binaries (e.g. Google Drive's
    // "file too large for virus scan" confirmation page, expired links,
    // captcha walls). Sniff the first non-whitespace bytes.
    let head: Vec<u8> = data.iter().take(512).copied()
        .skip_while(|b| b.is_ascii_whitespace()).take(64).collect();
    let head_lower = head.iter().map(|b| b.to_ascii_lowercase()).collect::<Vec<u8>>();
    let looks_html = head_lower.starts_with(b"<!doctype html")
        || head_lower.starts_with(b"<html")
        || head_lower.starts_with(b"<head")
        || head_lower.starts_with(b"<?xml") && head_lower.windows(5).any(|w| w == b"<html");
    let ext_is_html = std::path::Path::new(&safe_filename)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| matches!(e.to_ascii_lowercase().as_str(), "html" | "htm"))
        .unwrap_or(false);
    if looks_html && !ext_is_html {
        return Err(AppError::Generic(
            "Server returned an HTML page instead of the expected file. \
             Common causes: expired/private link, Google Drive size-warning page, \
             or captcha wall. Try a direct link.".to_string()
        ));
    }

    std::fs::create_dir_all(&dest_dir)?;
    let dest_path = std::path::Path::new(&dest_dir).join(&safe_filename);
    std::fs::write(&dest_path, &data)?;

    if download_type == "installer" {
        // Launch the installer and wait for it to finish
        launch_file_and_wait(&dest_path.to_string_lossy()).await?;

        // Setup has finished, now clean up
        std::fs::remove_file(&dest_path).ok();

        Ok(String::new())
    } else {
        // "archive" — file saved to dest_dir, return path so frontend can show "Open folder"
        Ok(dest_path.to_string_lossy().to_string())
    }
}

async fn launch_file_and_wait(path: &str) -> AppResult<()> {
    #[cfg(unix)]
    {
        // Make executable if it's a Linux installer/AppImage
        use std::os::unix::fs::PermissionsExt;
        if let Ok(meta) = std::fs::metadata(path) {
            let mut perms = meta.permissions();
            perms.set_mode(0o755);
            let _ = std::fs::set_permissions(path, perms);
        }

        let mut child = tokio::process::Command::new(path)
            .spawn()
            .map_err(|e| AppError::Generic(format!("Failed to launch file: {}", e)))?;
            
        child.wait().await.map_err(|e| AppError::Generic(format!("Failed waiting for installer: {}", e)))?;
    }
    #[cfg(windows)]
    {
        // `cmd /C` interprets the rest of the line as a single command string, so
        // we hand-build it and pass it as one argument. Strip any embedded `"`
        // from the path to prevent breaking out of the quoted token.
        let safe_path = path.replace('"', "");
        let cmdline = format!("start /wait \"\" \"{}\"", safe_path);
        let mut child = tokio::process::Command::new("cmd")
            .arg("/C")
            .arg(&cmdline)
            .spawn()
            .map_err(|e| AppError::Generic(format!("Failed to launch file: {}", e)))?;

        child.wait().await.map_err(|e| AppError::Generic(format!("Failed waiting for installer: {}", e)))?;
    }
    Ok(())
}

// ── Icon commands ──

/// Get icon for a third-party app (base64 PNG).
/// Checks local cache first, then catalog repo at icons/third_party/{id}.png
#[tauri::command]
pub async fn get_third_party_icon(
    app_id: String,
    github: State<'_, GitHubClient>,
) -> AppResult<String> {
    use base64::Engine;

    validate_app_id(&app_id)?;
    let cache_name = format!("third-party-{}.png", app_id);
    let local_path = icons_dir().join(&cache_name);

    if local_path.exists() {
        if let Ok(data) = std::fs::read(&local_path) {
            if data.len() > 100 && data.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
                let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
                return Ok(format!("data:image/png;base64,{}", b64));
            }
            std::fs::remove_file(&local_path).ok();
        }
    }

    for branch in &["main", "master"] {
        let url = format!(
            "https://raw.githubusercontent.com/{}/{}/icons/third_party/{}.png",
            CATALOG_REPO, branch, app_id
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

/// Upload a third-party app icon to the catalog repo at icons/third_party/{id}.png
#[tauri::command]
pub async fn upload_third_party_icon(
    app_id: String,
    icon_base64: String,
    github: State<'_, GitHubClient>,
) -> AppResult<()> {
    use base64::Engine;

    validate_app_id(&app_id)?;
    let pat = get_pat_or_error(&github).await?;
    let path = format!("icons/third_party/{}.png", app_id);
    let url = format!(
        "https://api.github.com/repos/{}/contents/{}",
        CATALOG_REPO, path
    );

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
        "message": format!("Add icon for third-party app {}", app_id),
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
        return Err(AppError::Generic(format!(
            "GitHub API error {}: {}",
            status, text
        )));
    }

    // Also save to local cache
    if let Ok(data) = base64::engine::general_purpose::STANDARD.decode(&icon_base64) {
        let cache_name = format!("third-party-{}.png", app_id);
        let local_path = icons_dir().join(&cache_name);
        std::fs::write(&local_path, &data).ok();
    }

    Ok(())
}

// ── Command Execution ──

#[tauri::command]
pub async fn execute_third_party_commands(
    app_id: String,
    commands: Vec<String>,
    sudo_password: Option<String>,
    app: AppHandle,
) -> AppResult<()> {
    validate_app_id(&app_id)?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;

        // Script body never contains the password — sudo wrapper reads it from $SUDO_ASKPASS_PWD
        // which is set as an env var on the child process (visible only to the same uid via /proc).
        let has_pwd = sudo_password.is_some();
        let script_content = if has_pwd {
            format!(
                "#!/bin/bash\nset -e\nsudo() {{\n    command sudo -S -p '' \"$@\" <<< \"$SUDO_ASKPASS_PWD\"\n}}\n{}",
                commands.join("\n")
            )
        } else {
            format!("#!/bin/bash\nset -e\n{}", commands.join("\n"))
        };

        // Random suffix + 0o700 to avoid TOCTOU and prevent other local users from reading.
        let nonce: u64 = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos() as u64)
            .unwrap_or(0)
            ^ (std::process::id() as u64).wrapping_mul(0x9E3779B97F4A7C15);
        let temp_dir = std::env::temp_dir();
        let script_path = temp_dir.join(format!("pyarsenal_tp_{}_{:x}.sh", app_id, nonce));

        {
            use std::io::Write;
            let mut f = std::fs::OpenOptions::new()
                .create_new(true)
                .write(true)
                .mode(0o700)
                .open(&script_path)
                .map_err(|e| AppError::Generic(format!("Failed to create script: {}", e)))?;
            f.write_all(script_content.as_bytes())?;
        }

        let mut cmd = tokio::process::Command::new(&script_path);
        cmd.stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .env_remove("SUDO_ASKPASS_PWD");
        if let Some(pwd) = sudo_password {
            cmd.env("SUDO_ASKPASS_PWD", pwd);
        }
        let mut child = cmd
            .spawn()
            .map_err(|e| AppError::Generic(format!("Failed to spawn script: {}", e)))?;

        let stdout = child.stdout.take().unwrap();
        let stderr = child.stderr.take().unwrap();
        let aid_out = app_id.clone();
        let app_out = app.clone();
        
        let mut stdout_reader = BufReader::new(stdout).lines();
        tokio::spawn(async move {
            while let Ok(Some(line)) = stdout_reader.next_line().await {
                app_out.emit("command-output", CommandOutput {
                    tool_id: aid_out.clone(),
                    line,
                    is_error: false,
                }).ok();
            }
        });

        let aid_err = app_id.clone();
        let app_err = app.clone();
        let mut stderr_reader = BufReader::new(stderr).lines();
        tokio::spawn(async move {
            while let Ok(Some(line)) = stderr_reader.next_line().await {
                app_err.emit("command-output", CommandOutput {
                    tool_id: aid_err.clone(),
                    line,
                    is_error: true,
                }).ok();
            }
        });

        let status = child.wait().await
            .map_err(|e| AppError::Generic(format!("Script failed: {}", e)))?;
            
        std::fs::remove_file(script_path).ok();
            
        if !status.success() {
             app.emit("command-output", CommandOutput {
                    tool_id: app_id,
                    line: format!("Script exited with status: {}", status),
                    is_error: true,
                }).ok();
             return Err(AppError::Generic(format!("Script exited with error.")));
        }
    }
    Ok(())
}

// ── Helper ──

async fn get_pat_or_error(github: &GitHubClient) -> AppResult<String> {
    let entry = keyring::Entry::new("pyarsenal", "github_pat")
        .map_err(|e| AppError::Keychain(e.to_string()))?;
    match entry.get_password() {
        Ok(pat) => Ok(pat),
        _ => Err(AppError::Generic(
            "GitHub PAT required. Click 'Login with GitHub' in Settings first.".to_string(),
        )),
    }
}
