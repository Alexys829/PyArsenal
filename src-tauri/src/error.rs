use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),

    #[error("GitHub API rate limited. Retry after {retry_after} seconds.")]
    RateLimited { retry_after: u64 },

    #[error("No binary available for platform '{platform}' in release {version}")]
    NoPlatformBinary { platform: String, version: String },

    #[error("Repository unreachable: {repo}")]
    RepoUnreachable { repo: String },

    #[error("Tool not found: {0}")]
    ToolNotFound(String),

    #[error("Tool not installed: {0}")]
    ToolNotInstalled(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Keychain error: {0}")]
    Keychain(String),

    #[error("Version parse error: {0}")]
    SemVer(#[from] semver::Error),

    #[error("Archive extraction failed: {0}")]
    Extraction(String),

    #[error("{0}")]
    Generic(String),
}

impl Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
