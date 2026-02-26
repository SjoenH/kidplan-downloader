use kidplan_downloader_lib::{
    downloader, Album, AppState, Credentials, DownloadResult, DownloadSettings, Kindergarten,
};
use reqwest::header::{HeaderMap, HeaderValue, USER_AGENT};

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

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            get_kindergartens,
            login,
            fetch_albums,
            start_download,
            cancel_download,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
