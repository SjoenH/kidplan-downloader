use kidplan_downloader_lib::{
    database::{Face, FaceCluster},
    downloader, face_recognition::FaceRecognizer, Album, AppState, Credentials, DownloadResult,
    DownloadSettings, Kindergarten,
};
use reqwest::header::{HeaderMap, HeaderValue, USER_AGENT};
use std::path::PathBuf;

const UA: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36";

fn build_client(jar: std::sync::Arc<reqwest::cookie::Jar>) -> reqwest::Client {
    let mut headers = HeaderMap::new();
    headers.insert(USER_AGENT, HeaderValue::from_static(UA));
    reqwest::Client::builder()
        .default_headers(headers)
        .cookie_provider(jar)
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .expect("Failed to build HTTP client")
}

#[tauri::command]
async fn get_kindergartens(
    state: tauri::State<'_, AppState>,
    credentials: Credentials,
) -> Result<Vec<Kindergarten>, String> {
    eprintln!("[DEBUG] get_kindergartens called for user: {}", credentials.email);
    let jar = state.cookie_jar.clone();
    let client = build_client(jar);
    let kids = downloader::fetch_kindergarten_ids(&client, &credentials).await?;
    eprintln!("[DEBUG] Got {} kindergartens", kids.len());
    // Store client for later use
    *state.client.lock().await = Some(client);
    Ok(kids)
}

#[tauri::command]
async fn login(
    state: tauri::State<'_, AppState>,
    credentials: Credentials,
    kid_id: i64,
) -> Result<(), String> {
    eprintln!("[DEBUG] login called for kid_id={}", kid_id);
    let jar = state.cookie_jar.clone();
    let needs_client = {
        let guard = state.client.lock().await;
        guard.is_none()
    };
    if needs_client {
        let c = build_client(jar);
        *state.client.lock().await = Some(c);
    }
    let client = {
        let guard = state.client.lock().await;
        guard.as_ref().unwrap().clone()
    };
    let result = downloader::login(&client, &credentials, kid_id).await;
    eprintln!("[DEBUG] login result: {:?}", result);
    result
}

#[tauri::command]
async fn fetch_albums(state: tauri::State<'_, AppState>) -> Result<Vec<Album>, String> {
    eprintln!("[DEBUG] fetch_albums called");
    let client = {
        let guard = state.client.lock().await;
        guard.as_ref().ok_or("Not logged in")?.clone()
    };
    let albums = downloader::fetch_albums(&client).await;
    eprintln!("[DEBUG] fetch_albums result: {} albums", albums.as_ref().map(|a| a.len()).unwrap_or(0));
    albums
}

#[tauri::command]
async fn start_download(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    albums: Vec<Album>,
    settings: DownloadSettings,
) -> Result<DownloadResult, String> {
    eprintln!("[DEBUG] start_download command invoked: {} albums", albums.len());
    for a in &albums {
        eprintln!("[DEBUG]   album: id={}, title={}, url={}", a.id, a.title, a.url);
    }
    eprintln!("[DEBUG]   settings: out_dir={}, delay_ms={}, limit={}", settings.out_dir, settings.delay_ms, settings.limit_per_album);
    // Reset cancel flag
    *state.cancel_flag.lock().await = false;
    let result = downloader::download_albums(&app, &state, albums, settings).await;
    eprintln!("[DEBUG] start_download result: {:?}", result);
    result
}

#[tauri::command]
async fn cancel_download(state: tauri::State<'_, AppState>) -> Result<(), String> {
    *state.cancel_flag.lock().await = true;
    Ok(())
}

/// Get the face recognizer instance
fn get_face_recognizer() -> Result<FaceRecognizer, String> {
    let data_dir = dirs::data_local_dir()
        .ok_or("Failed to get local data directory")?
        .join("kidplan-downloader")
        .join("faces");
    
    std::fs::create_dir_all(&data_dir)
        .map_err(|e| format!("Failed to create data directory: {}", e))?;
    
    FaceRecognizer::new(data_dir).map_err(|e| e.to_string())
}

#[tauri::command]
async fn process_album_faces(
    app: tauri::AppHandle,
    album_path: String,
) -> Result<usize, String> {
    let recognizer = get_face_recognizer()?;
    let path = PathBuf::from(album_path);
    recognizer
        .process_album(&path, &app)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn process_directory_faces(
    app: tauri::AppHandle,
    directory_path: String,
) -> Result<usize, String> {
    let recognizer = get_face_recognizer()?;
    let path = PathBuf::from(directory_path);
    recognizer
        .process_directory(&path, &app)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn cluster_faces(threshold: f32) -> Result<Vec<FaceCluster>, String> {
    eprintln!("[DEBUG] cluster_faces called with threshold: {}", threshold);
    let recognizer = get_face_recognizer()?;
    let result = recognizer
        .cluster_faces(threshold)
        .await
        .map_err(|e| e.to_string())?;
    eprintln!("[DEBUG] Clustering complete, created {} clusters", result.len());
    Ok(result)
}

#[tauri::command]
async fn get_face_clusters() -> Result<Vec<FaceCluster>, String> {
    let recognizer = get_face_recognizer()?;
    let clusters = recognizer.get_clusters().await.map_err(|e| e.to_string())?;
    
    // Debug: log thumbnail paths
    for cluster in &clusters {
        eprintln!("[DEBUG] Cluster {}: thumbnail_path = {:?}", cluster.id, cluster.sample_thumbnail_path);
    }
    
    Ok(clusters)
}

#[tauri::command]
async fn get_cluster_faces(cluster_id: i64) -> Result<Vec<Face>, String> {
    let recognizer = get_face_recognizer()?;
    recognizer
        .get_cluster_faces(cluster_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn assign_face_label(cluster_id: i64, label: String) -> Result<(), String> {
    let recognizer = get_face_recognizer()?;
    recognizer
        .assign_label(cluster_id, &label)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn merge_face_clusters(
    cluster_ids: Vec<i64>,
    label: Option<String>,
) -> Result<i64, String> {
    let recognizer = get_face_recognizer()?;
    recognizer
        .merge_clusters(&cluster_ids, label.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn clear_face_data() -> Result<(), String> {
    let recognizer = get_face_recognizer()?;
    recognizer.clear_all().await.map_err(|e| e.to_string())
}

#[tauri::command]
fn log_frontend_message(message: String) -> Result<(), String> {
    use std::fs::OpenOptions;
    use std::io::Write;
    
    // Log to stdout/stderr for tauri dev
    eprintln!("[FRONTEND] {}", message);
    
    // Also write to a log file
    let log_path = dirs::data_local_dir()
        .ok_or("Failed to get local data directory")?
        .join("kidplan-downloader")
        .join("frontend.log");
    
    if let Some(parent) = log_path.parent() {
        std::fs::create_dir_all(parent).ok();
    }
    
    let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
    let log_line = format!("[{}] {}\n", timestamp, message);
    
    OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .and_then(|mut file| file.write_all(log_line.as_bytes()))
        .map_err(|e| format!("Failed to write to log: {}", e))?;
    
    Ok(())
}

#[tauri::command]
fn read_thumbnail(path: String) -> Result<Vec<u8>, String> {
    eprintln!("[DEBUG] read_thumbnail called for: {}", path);
    std::fs::read(&path).map_err(|e| format!("Failed to read thumbnail {}: {}", path, e))
}

#[tauri::command]
async fn debug_embeddings() -> Result<String, String> {
    eprintln!("[DEBUG] debug_embeddings command called");
    
    let recognizer = get_face_recognizer()?;
    let db = recognizer.get_db().map_err(|e| e.to_string())?;
    let faces = db.get_all_faces().map_err(|e| e.to_string())?;
    
    let mut output = String::new();
    output.push_str(&format!("Total faces in database: {}\n\n", faces.len()));
    
    // Analyze first 5 embeddings
    for (i, face) in faces.iter().take(5).enumerate() {
        let emb = &face.embedding;
        let min = emb.iter().fold(f32::INFINITY, |a, &b| a.min(b));
        let max = emb.iter().fold(f32::NEG_INFINITY, |a, &b| a.max(b));
        let mean = emb.iter().sum::<f32>() / emb.len() as f32;
        let norm: f32 = emb.iter().map(|x| x * x).sum::<f32>().sqrt();
        
        output.push_str(&format!("Face {}: len={}, min={:.6}, max={:.6}, mean={:.6}, L2norm={:.6}\n",
            i, emb.len(), min, max, mean, norm));
        output.push_str(&format!("  First 10: {:?}\n\n", &emb[..10.min(emb.len())]));
    }
    
    // Compare similarities
    if faces.len() >= 2 {
        output.push_str("Pairwise similarities (first 5 faces):\n");
        for i in 0..5.min(faces.len()) {
            for j in (i+1)..5.min(faces.len()) {
                let dot: f32 = faces[i].embedding.iter()
                    .zip(&faces[j].embedding)
                    .map(|(a, b)| a * b)
                    .sum();
                let norm_a: f32 = faces[i].embedding.iter().map(|x| x * x).sum::<f32>().sqrt();
                let norm_b: f32 = faces[j].embedding.iter().map(|x| x * x).sum::<f32>().sqrt();
                let sim = dot / (norm_a * norm_b);
                
                output.push_str(&format!("  Face {} <-> Face {}: {:.6}\n", i, j, sim));
            }
        }
    }
    
    eprintln!("{}", output);
    Ok(output)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            get_kindergartens,
            login,
            fetch_albums,
            start_download,
            cancel_download,
            process_album_faces,
            process_directory_faces,
            cluster_faces,
            get_face_clusters,
            get_cluster_faces,
            assign_face_label,
            merge_face_clusters,
            clear_face_data,
            log_frontend_message,
            read_thumbnail,
            debug_embeddings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
