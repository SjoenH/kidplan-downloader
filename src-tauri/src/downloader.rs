use crate::{Album, AppState, Credentials, DownloadProgress, DownloadResult, DownloadSettings, Kindergarten};
use scraper::{Html, Selector};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};
use urlencoding::encode;

const LOGIN_URL: &str = "https://app.kidplan.com/LogOn";
const KINDERGARTEN_IDS_URL: &str = "https://app.kidplan.com/Account/GetKinderGartenIds";

pub async fn fetch_kindergarten_ids(
    client: &reqwest::Client,
    creds: &Credentials,
) -> Result<Vec<Kindergarten>, String> {
    let url = format!(
        "{}?username={}&password={}",
        KINDERGARTEN_IDS_URL,
        encode(&creds.email),
        encode(&creds.password)
    );
    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("Kindergarten lookup failed: {}", resp.status()));
    }
    let kids: Vec<Kindergarten> = resp.json().await.map_err(|e| e.to_string())?;
    if kids.is_empty() {
        return Err("Login failed: no kindergarten IDs returned. Check credentials.".to_string());
    }
    Ok(kids)
}

pub async fn login(
    client: &reqwest::Client,
    creds: &Credentials,
    kid_id: i64,
) -> Result<(), String> {
    let url = format!("{}?kid={}", LOGIN_URL, kid_id);
    let params = [
        ("UserName", creds.email.as_str()),
        ("Password", creds.password.as_str()),
        ("RememberMe", "true"),
    ];
    let resp = client
        .post(&url)
        .form(&params)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("Login failed: {}", resp.status()));
    }
    Ok(())
}

#[derive(serde::Deserialize)]
struct AlbumJson {
    #[serde(alias = "AlbumId")]
    album_id: Option<String>,
    #[serde(alias = "Title")]
    title: Option<String>,
    #[serde(alias = "AlbumUrl")]
    album_url: Option<String>,
    #[serde(alias = "NumberOfImages")]
    number_of_images: Option<usize>,
}

pub async fn fetch_albums(client: &reqwest::Client) -> Result<Vec<Album>, String> {
    let base = "https://app.kidplan.com/bilder/album";
    let json_url = "https://app.kidplan.com/bilder/GetAlbumsAsJson";
    let mut albums = Vec::new();
    let mut seen_ids = HashSet::new();
    let mut skip = 0;
    let page_size = 50;

    loop {
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        let url = format!(
            "{}?take={}&skip={}&noCache={}",
            json_url, page_size, skip, ts
        );
        let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
        if !resp.status().is_success() {
            return Err(format!("Album JSON fetch failed: {}", resp.status()));
        }
        let data: Vec<AlbumJson> = resp.json().await.map_err(|e| e.to_string())?;
        if data.is_empty() {
            break;
        }
        let mut new_items = 0;
        for item in &data {
            let id = item.album_id.clone().unwrap_or_default();
            if id.is_empty() || seen_ids.contains(&id) {
                continue;
            }
            seen_ids.insert(id.clone());
            let raw_url = item.album_url.clone().unwrap_or_default();
            let album_url = if raw_url.starts_with("http") {
                raw_url
            } else {
                format!("{}{}", base.trim_end_matches("/album"), &raw_url)
            };
            albums.push(Album {
                id,
                title: item.title.clone().unwrap_or_else(|| "Untitled".to_string()),
                url: album_url,
                image_count: item.number_of_images,
            });
            new_items += 1;
        }
        if new_items == 0 || data.len() < page_size {
            break;
        }
        skip += data.len();
    }
    Ok(albums)
}

fn is_album_image_url(url: &str) -> bool {
    if let Ok(parsed) = url::Url::parse(url) {
        if let Some(host) = parsed.host_str() {
            return host.ends_with("img.kidplan.com")
                && parsed.path().starts_with("/albumpicture/");
        }
    }
    false
}

fn upgrade_image_url(url: &str) -> String {
    let decoded = html_escape::decode_html_entities(url).to_string();
    if let Ok(mut parsed) = url::Url::parse(&decoded) {
        if let Some(host) = parsed.host_str() {
            if host.ends_with("img.kidplan.com")
                && parsed.path().starts_with("/albumpicture/")
            {
                // Remove size parameter to get full resolution
                let pairs: Vec<(String, String)> = parsed
                    .query_pairs()
                    .filter(|(k, _)| k != "size")
                    .map(|(k, v)| (k.to_string(), v.to_string()))
                    .collect();
                parsed.query_pairs_mut().clear();
                for (k, v) in &pairs {
                    parsed.query_pairs_mut().append_pair(k, v);
                }
                if parsed.query() == Some("") {
                    parsed.set_query(None);
                }
                return parsed.to_string();
            }
        }
    }
    decoded
}

fn extract_image_id(url: &str) -> Option<String> {
    if let Ok(parsed) = url::Url::parse(url) {
        if let Some(host) = parsed.host_str() {
            if host.ends_with("img.kidplan.com")
                && parsed.path().starts_with("/albumpicture/")
            {
                for (k, v) in parsed.query_pairs() {
                    if k == "id" {
                        return Some(v.to_string());
                    }
                }
            }
        }
    }
    None
}

fn get_image_extension(url: &str) -> String {
    if let Ok(parsed) = url::Url::parse(url) {
        let path = parsed.path();
        if let Some(pos) = path.rfind('.') {
            return path[pos..].to_lowercase();
        }
    }
    ".jpg".to_string()
}

pub fn extract_image_urls(html_text: &str, _base_url: &str) -> Vec<String> {
    let document = Html::parse_document(html_text);
    let mut urls = HashSet::new();

    // Extract from img/source src, data-src, etc.
    let img_sel = Selector::parse("img, source").unwrap();
    for el in document.select(&img_sel) {
        for attr in &[
            "src",
            "data-src",
            "data-original",
            "data-full",
            "data-large",
            "data-url",
        ] {
            if let Some(val) = el.value().attr(attr) {
                let decoded = html_escape::decode_html_entities(val).to_string();
                let full = normalize_url(&decoded, _base_url);
                if is_album_image_url(&full) {
                    urls.insert(upgrade_image_url(&full));
                }
            }
        }
        // srcset
        if let Some(srcset) = el.value().attr("srcset") {
            for part in srcset.split(',') {
                let candidate = part.trim().split_whitespace().next().unwrap_or("");
                let full = normalize_url(
                    &html_escape::decode_html_entities(candidate).to_string(),
                    _base_url,
                );
                if is_album_image_url(&full) {
                    urls.insert(upgrade_image_url(&full));
                }
            }
        }
    }

    // Extract from <a> href
    let a_sel = Selector::parse("a").unwrap();
    for el in document.select(&a_sel) {
        if let Some(href) = el.value().attr("href") {
            let decoded = html_escape::decode_html_entities(href).to_string();
            let full = normalize_url(&decoded, _base_url);
            if is_album_image_url(&full) {
                urls.insert(upgrade_image_url(&full));
            }
        }
    }

    // Regex fallback for URLs in raw HTML
    let re = regex::Regex::new(r#"https?://[^"'\s>]+"#).unwrap();
    for m in re.find_iter(html_text) {
        let url = html_escape::decode_html_entities(m.as_str()).to_string();
        if is_album_image_url(&url) {
            urls.insert(upgrade_image_url(&url));
        }
    }

    let mut sorted: Vec<String> = urls.into_iter().collect();
    sorted.sort();
    sorted
}

fn normalize_url(url: &str, base: &str) -> String {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    if trimmed.starts_with("//") {
        return format!("https:{}", trimmed);
    }
    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        return trimmed.to_string();
    }
    // Relative URL
    if let Ok(base_url) = url::Url::parse(base) {
        if let Ok(resolved) = base_url.join(trimmed) {
            return resolved.to_string();
        }
    }
    trimmed.to_string()
}

fn slugify(value: &str) -> String {
    let mut slug = String::new();
    for ch in value.trim().chars() {
        if ch.is_ascii_alphanumeric() {
            slug.push(ch);
        } else {
            slug.push('-');
        }
    }
    // Collapse consecutive dashes
    let collapsed = regex::Regex::new(r"-+")
        .unwrap()
        .replace_all(&slug, "-")
        .to_string();
    collapsed.trim_matches('-').to_string()
}

fn load_manifest(path: &Path) -> HashSet<String> {
    let mut entries = HashSet::new();
    if let Ok(content) = std::fs::read_to_string(path) {
        for line in content.lines() {
            let trimmed = line.trim();
            if !trimmed.is_empty() {
                entries.insert(trimmed.to_string());
            }
        }
    }
    entries
}

fn append_manifest(path: &Path, entry: &str) {
    use std::io::Write;
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(f, "{}", entry);
    }
}

pub async fn download_albums(
    app: &AppHandle,
    state: &AppState,
    albums: Vec<Album>,
    settings: DownloadSettings,
) -> Result<DownloadResult, String> {
    let client_guard = state.client.lock().await;
    let client = client_guard
        .as_ref()
        .ok_or("Not logged in")?
        .clone();
    drop(client_guard);

    let manifest_path = state.manifest_path.lock().await.clone();
    let mut manifest = load_manifest(&manifest_path);
    let mut seen_urls: HashSet<String> = HashSet::new();
    let mut total_downloaded = 0usize;
    let mut total_skipped = 0usize;
    let mut total_failed = 0usize;

    // Ensure output directory
    let out_dir = PathBuf::from(&settings.out_dir);
    std::fs::create_dir_all(&out_dir).map_err(|e| e.to_string())?;

    // Ensure manifest file exists
    if !manifest_path.exists() {
        let _ = std::fs::File::create(&manifest_path);
    }

    for (album_idx, album) in albums.iter().enumerate() {
        // Check cancel flag
        {
            let cancel = state.cancel_flag.lock().await;
            if *cancel {
                break;
            }
        }

        // Fetch album page
        let resp = client
            .get(&album.url)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        let album_html = resp.text().await.map_err(|e| e.to_string())?;
        let image_urls = extract_image_urls(&album_html, &album.url);

        let limited = if settings.limit_per_album > 0 && image_urls.len() > settings.limit_per_album {
            &image_urls[..settings.limit_per_album]
        } else {
            &image_urls[..]
        };

        let album_dir = out_dir.join(slugify(&album.title));
        std::fs::create_dir_all(&album_dir).map_err(|e| e.to_string())?;

        for (img_idx, image_url) in limited.iter().enumerate() {
            // Check cancel flag
            {
                let cancel = state.cancel_flag.lock().await;
                if *cancel {
                    break;
                }
            }

            // Dedupe
            if seen_urls.contains(image_url) {
                total_skipped += 1;
                continue;
            }
            seen_urls.insert(image_url.clone());

            // Manifest check
            let image_id = extract_image_id(image_url);
            if let Some(ref id) = image_id {
                if manifest.contains(id) {
                    total_skipped += 1;
                    continue;
                }
            }

            // Build filename
            let filename = if let Some(ref id) = image_id {
                format!("id-{}{}", id, get_image_extension(image_url))
            } else {
                let digest = format!("{:x}", md5_hash(image_url));
                format!("image-{:04}-{}.jpg", img_idx + 1, &digest[..10])
            };

            let dest_path = album_dir.join(&filename);

            // Skip if exists
            if dest_path.exists() {
                if let Some(ref id) = image_id {
                    if !manifest.contains(id) {
                        append_manifest(&manifest_path, id);
                        manifest.insert(id.clone());
                    }
                }
                total_skipped += 1;
                let _ = app.emit("download-progress", DownloadProgress {
                    album_title: album.title.clone(),
                    album_index: album_idx + 1,
                    album_total: albums.len(),
                    image_index: img_idx + 1,
                    image_total: limited.len(),
                    filename: filename.clone(),
                    status: "skipped".to_string(),
                });
                continue;
            }

            // Delay
            if settings.delay_ms > 0 {
                tokio::time::sleep(tokio::time::Duration::from_millis(settings.delay_ms)).await;
            }

            // Download
            match client.get(image_url).send().await {
                Ok(resp) => {
                    if resp.status().is_success() {
                        match resp.bytes().await {
                            Ok(bytes) => {
                                if let Err(e) = std::fs::write(&dest_path, &bytes) {
                                    total_failed += 1;
                                    let _ = app.emit("download-progress", DownloadProgress {
                                        album_title: album.title.clone(),
                                        album_index: album_idx + 1,
                                        album_total: albums.len(),
                                        image_index: img_idx + 1,
                                        image_total: limited.len(),
                                        filename: filename.clone(),
                                        status: format!("failed: {}", e),
                                    });
                                    continue;
                                }
                                total_downloaded += 1;
                                if let Some(ref id) = image_id {
                                    append_manifest(&manifest_path, id);
                                    manifest.insert(id.clone());
                                }
                                let _ = app.emit("download-progress", DownloadProgress {
                                    album_title: album.title.clone(),
                                    album_index: album_idx + 1,
                                    album_total: albums.len(),
                                    image_index: img_idx + 1,
                                    image_total: limited.len(),
                                    filename: filename.clone(),
                                    status: "downloaded".to_string(),
                                });
                            }
                            Err(e) => {
                                total_failed += 1;
                                let _ = app.emit("download-progress", DownloadProgress {
                                    album_title: album.title.clone(),
                                    album_index: album_idx + 1,
                                    album_total: albums.len(),
                                    image_index: img_idx + 1,
                                    image_total: limited.len(),
                                    filename: filename.clone(),
                                    status: format!("failed: {}", e),
                                });
                            }
                        }
                    } else {
                        total_failed += 1;
                        let _ = app.emit("download-progress", DownloadProgress {
                            album_title: album.title.clone(),
                            album_index: album_idx + 1,
                            album_total: albums.len(),
                            image_index: img_idx + 1,
                            image_total: limited.len(),
                            filename: filename.clone(),
                            status: format!("failed: HTTP {}", resp.status()),
                        });
                    }
                }
                Err(e) => {
                    total_failed += 1;
                    let _ = app.emit("download-progress", DownloadProgress {
                        album_title: album.title.clone(),
                        album_index: album_idx + 1,
                        album_total: albums.len(),
                        image_index: img_idx + 1,
                        image_total: limited.len(),
                        filename: filename.clone(),
                        status: format!("failed: {}", e),
                    });
                }
            }
        }
    }

    // Update state manifest
    *state.manifest.lock().await = manifest;

    Ok(DownloadResult {
        total_albums: albums.len(),
        total_images: total_downloaded,
        skipped: total_skipped,
        failed: total_failed,
    })
}

fn md5_hash(input: &str) -> u128 {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    input.hash(&mut hasher);
    hasher.finish() as u128
}
