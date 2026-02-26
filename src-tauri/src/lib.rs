use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::PathBuf;

pub mod downloader;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Credentials {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Kindergarten {
    #[serde(alias = "Id")]
    pub id: i64,
    #[serde(alias = "Name")]
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Album {
    pub id: String,
    pub title: String,
    pub url: String,
    pub image_count: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadSettings {
    pub out_dir: String,
    pub delay_ms: u64,
    pub limit_per_album: usize,
}

impl Default for DownloadSettings {
    fn default() -> Self {
        Self {
            out_dir: "kidplan-albums".to_string(),
            delay_ms: 200,
            limit_per_album: 0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub album_title: String,
    pub album_index: usize,
    pub album_total: usize,
    pub image_index: usize,
    pub image_total: usize,
    pub filename: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadResult {
    pub total_albums: usize,
    pub total_images: usize,
    pub skipped: usize,
    pub failed: usize,
}

/// Shared app state holding the authenticated HTTP client session.
pub struct AppState {
    pub client: tokio::sync::Mutex<Option<reqwest::Client>>,
    pub cookie_jar: std::sync::Arc<reqwest::cookie::Jar>,
    pub manifest: tokio::sync::Mutex<HashSet<String>>,
    pub manifest_path: tokio::sync::Mutex<PathBuf>,
    pub cancel_flag: tokio::sync::Mutex<bool>,
}

impl AppState {
    pub fn new() -> Self {
        let jar = std::sync::Arc::new(reqwest::cookie::Jar::default());
        Self {
            client: tokio::sync::Mutex::new(None),
            cookie_jar: jar,
            manifest: tokio::sync::Mutex::new(HashSet::new()),
            manifest_path: tokio::sync::Mutex::new(PathBuf::from("kidplan-manifest.txt")),
            cancel_flag: tokio::sync::Mutex::new(false),
        }
    }
}
