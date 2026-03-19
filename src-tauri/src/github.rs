use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, USER_AGENT};
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::error::{AppError, AppResult};
use crate::models::GitHubRelease;

pub struct GitHubClient {
    client: reqwest::Client,
    pat: Arc<RwLock<Option<String>>>,
}

impl GitHubClient {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .build()
            .expect("Failed to create HTTP client");
        Self {
            client,
            pat: Arc::new(RwLock::new(None)),
        }
    }

    pub async fn set_pat(&self, pat: Option<String>) {
        *self.pat.write().await = pat;
    }

    async fn headers(&self) -> HeaderMap {
        let mut headers = HeaderMap::new();
        headers.insert(USER_AGENT, HeaderValue::from_static("PyArsenal"));
        headers.insert(
            "Accept",
            HeaderValue::from_static("application/vnd.github.v3+json"),
        );
        if let Some(ref pat) = *self.pat.read().await {
            if let Ok(val) = HeaderValue::from_str(&format!("Bearer {}", pat)) {
                headers.insert(AUTHORIZATION, val);
            }
        }
        headers
    }

    pub async fn get_latest_release(&self, repo: &str) -> AppResult<GitHubRelease> {
        let url = format!("https://api.github.com/repos/{}/releases/latest", repo);
        let resp = self
            .client
            .get(&url)
            .headers(self.headers().await)
            .send()
            .await
            .map_err(|_| AppError::RepoUnreachable {
                repo: repo.to_string(),
            })?;

        if resp.status() == reqwest::StatusCode::FORBIDDEN
            || resp.status() == reqwest::StatusCode::TOO_MANY_REQUESTS
        {
            let retry_after = resp
                .headers()
                .get("x-ratelimit-reset")
                .and_then(|v| v.to_str().ok())
                .and_then(|v| v.parse::<u64>().ok())
                .map(|reset| {
                    reset.saturating_sub(
                        std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_secs(),
                    )
                })
                .unwrap_or(60);
            return Err(AppError::RateLimited { retry_after });
        }

        if resp.status() == reqwest::StatusCode::NOT_FOUND {
            return Err(AppError::RepoUnreachable {
                repo: repo.to_string(),
            });
        }

        let release: GitHubRelease = resp.json().await?;
        Ok(release)
    }

    pub async fn download_bytes(&self, url: &str) -> AppResult<bytes::Bytes> {
        let resp = self
            .client
            .get(url)
            .headers(self.headers().await)
            .send()
            .await?;
        Ok(resp.bytes().await?)
    }

    /// Download with streaming progress callback
    pub async fn download_streaming(
        &self,
        url: &str,
        mut on_progress: impl FnMut(u64, u64),
    ) -> AppResult<Vec<u8>> {
        use futures_util::StreamExt;

        let resp = self
            .client
            .get(url)
            .headers(self.headers().await)
            .send()
            .await?;

        let total = resp.content_length().unwrap_or(0);
        let mut downloaded: u64 = 0;
        let mut data = Vec::with_capacity(total as usize);
        let mut stream = resp.bytes_stream();

        while let Some(chunk) = stream.next().await {
            let chunk = chunk?;
            downloaded += chunk.len() as u64;
            data.extend_from_slice(&chunk);
            on_progress(downloaded, total);
        }

        Ok(data)
    }

    pub async fn get_rate_limit(&self) -> AppResult<(u32, u32)> {
        let url = "https://api.github.com/rate_limit";
        let resp = self
            .client
            .get(url)
            .headers(self.headers().await)
            .send()
            .await?;
        let body: serde_json::Value = resp.json().await?;
        let remaining = body["resources"]["core"]["remaining"]
            .as_u64()
            .unwrap_or(0) as u32;
        let limit = body["resources"]["core"]["limit"].as_u64().unwrap_or(0) as u32;
        Ok((remaining, limit))
    }
}
