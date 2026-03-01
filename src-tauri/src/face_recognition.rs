use anyhow::{Context, Result};
use image::{imageops::FilterType, DynamicImage, GenericImageView};
use ndarray::Array4;
use ort::{session::Session, value::Value};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

use crate::database::{BoundingBox, Database, Face, FaceCluster};

/// Face detection result
#[derive(Debug, Clone)]
pub struct FaceDetection {
    pub bounding_box: BoundingBox,
    pub confidence: f64,
}

/// Cached ONNX sessions
struct ModelCache {
    detection_session: Option<Session>,
    recognition_session: Option<Session>,
}

/// Face recognition processor
pub struct FaceRecognizer {
    db_path: PathBuf,
    thumbnails_dir: PathBuf,
    models_dir: PathBuf,
    model_cache: Arc<Mutex<ModelCache>>,
}

impl FaceRecognizer {
    pub fn new(data_dir: PathBuf) -> Result<Self> {
        let db_path = data_dir.join("faces.db");
        let thumbnails_dir = data_dir.join("face_thumbnails");
        
        // Find models directory - try multiple locations
        let models_dir = Self::find_models_dir()?;
        
        eprintln!("[DEBUG] Using models directory: {:?}", models_dir);
        
        // Create thumbnails directory
        std::fs::create_dir_all(&thumbnails_dir)
            .context("Failed to create thumbnails directory")?;

        Ok(Self {
            db_path,
            thumbnails_dir,
            models_dir,
            model_cache: Arc::new(Mutex::new(ModelCache {
                detection_session: None,
                recognition_session: None,
            })),
        })
    }

    /// Find the models directory in various possible locations
    fn find_models_dir() -> Result<PathBuf> {
        // Try multiple possible locations
        let current_dir = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
        
        let possible_paths = vec![
            // Development mode: src-tauri/models (from project root)
            current_dir.join("src-tauri").join("models"),
            // Development mode: models (from src-tauri directory)
            current_dir.join("models"),
            // Working directory models
            PathBuf::from("models"),
            // Parent directory (in case we're in src-tauri)
            current_dir.parent().map(|p| p.join("src-tauri").join("models")).unwrap_or_else(|| PathBuf::from("models")),
            // Production mode (macOS app bundle): .app/Contents/Resources/models
            std::env::current_exe()
                .ok()
                .and_then(|exe| exe.parent().map(|p| p.to_path_buf()))
                .and_then(|p| p.parent().map(|p| p.to_path_buf()))
                .map(|p| p.join("Resources").join("models"))
                .unwrap_or_else(|| PathBuf::from("models")),
        ];

        // Find the first path that exists and contains the model files
        for path in possible_paths {
            eprintln!("[DEBUG] Checking models path: {:?}", path);
            if path.exists() {
                eprintln!("[DEBUG]   - Path exists");
                let detection_model = path.join("version-RFB-320.onnx");
                eprintln!("[DEBUG]   - Looking for: {:?}", detection_model);
                if detection_model.exists() {
                    eprintln!("[DEBUG] ✓ Found models at: {:?}", path);
                    return Ok(path);
                } else {
                    eprintln!("[DEBUG]   - Detection model not found");
                }
            } else {
                eprintln!("[DEBUG]   - Path does not exist");
            }
        }

        anyhow::bail!(
            "Could not find models directory. Please ensure the ONNX model files (version-RFB-320.onnx, mobilefacenet.onnx) \
            are present in src-tauri/models/. Current directory: {:?}",
            current_dir
        )
    }

    /// Get or load detection model and run inference
    fn run_detection(&self, input_data: Array4<f32>) -> Result<(Vec<f32>, Vec<f32>, Vec<i64>)> {
        let mut cache = self.model_cache.lock().unwrap();
        
        if cache.detection_session.is_none() {
            let model_path = self.models_dir.join("version-RFB-320.onnx");
            if !model_path.exists() {
                anyhow::bail!("Face detection model not found at {:?}", model_path);
            }
            
            let session = Session::builder()?
                .commit_from_file(model_path)
                .context("Failed to load face detection model")?;
            
            cache.detection_session = Some(session);
        }
        
        let session = cache.detection_session.as_mut().unwrap();
        let input_value = Value::from_array(input_data)?;
        let outputs = session.run(ort::inputs!["input" => &input_value])?;
        
        // Extract tensors
        let scores_output = outputs["scores"].try_extract_tensor::<f32>()?;
        let boxes_output = outputs["boxes"].try_extract_tensor::<f32>()?;
        
        // Get shape as Vec
        let shape_slice: &[i64] = scores_output.0.as_ref();
        
        Ok((
            scores_output.1.to_vec(),
            boxes_output.1.to_vec(),
            shape_slice.to_vec(),
        ))
    }

    /// Get or load recognition model and run inference
    fn run_recognition(&self, input_data: Array4<f32>) -> Result<Vec<f32>> {
        let mut cache = self.model_cache.lock().unwrap();
        
        if cache.recognition_session.is_none() {
            let model_path = self.models_dir.join("mobilefacenet.onnx");
            if !model_path.exists() {
                anyhow::bail!("Face recognition model not found at {:?}", model_path);
            }
            
            let session = Session::builder()?
                .commit_from_file(model_path)
                .context("Failed to load face recognition model")?;
            
            cache.recognition_session = Some(session);
        }
        
        let session = cache.recognition_session.as_mut().unwrap();
        let input_value = Value::from_array(input_data)?;
        let outputs = session.run(ort::inputs!["data" => &input_value])?;
        
        // Extract embedding
        let embedding_output = outputs["fc1"].try_extract_tensor::<f32>()?;
        let embedding = embedding_output.1.to_vec();
        
        Ok(embedding)
    }

    /// Get database connection
    pub fn get_db(&self) -> Result<Database> {
        Database::new(self.db_path.clone())
    }

    /// Process all images in an album directory for faces
    pub async fn process_album(
        &self,
        album_path: &Path,
        app_handle: &AppHandle,
    ) -> Result<usize> {
        let db = self.get_db()?;
        
        // Find all image files
        let image_files: Vec<PathBuf> = std::fs::read_dir(album_path)?
            .filter_map(|entry| entry.ok())
            .map(|entry| entry.path())
            .filter(|path| {
                path.extension()
                    .and_then(|ext| ext.to_str())
                    .map(|ext| {
                        matches!(ext.to_lowercase().as_str(), "jpg" | "jpeg" | "png" | "webp")
                    })
                    .unwrap_or(false)
            })
            .collect();

        let total_images = image_files.len();
        let mut faces_found = 0;

        // Process images
        for (idx, image_path) in image_files.iter().enumerate() {
            // Emit progress event
            let _ = app_handle.emit("face-processing-progress", serde_json::json!({
                "current": idx + 1,
                "total": total_images,
                "image_path": image_path.to_string_lossy(),
            }));

            // Detect faces in image
            match self.detect_faces(image_path).await {
                Ok(detections) => {
                    for detection in detections {
                        // Generate embedding
                        match self.generate_embedding(image_path, &detection.bounding_box).await {
                            Ok(embedding) => {
                                // Save face thumbnail
                                let thumbnail_path = match self.save_face_thumbnail(
                                    image_path,
                                    &detection.bounding_box,
                                    faces_found,
                                ) {
                                    Ok(path) => path,
                                    Err(e) => {
                                        eprintln!("Failed to save thumbnail: {}", e);
                                        continue;
                                    }
                                };

                                // Save to database
                                match db.insert_face(
                                    &image_path.to_string_lossy(),
                                    &detection.bounding_box,
                                    &embedding,
                                    detection.confidence,
                                    &thumbnail_path.to_string_lossy(),
                                ) {
                                    Ok(_) => faces_found += 1,
                                    Err(e) => eprintln!("Failed to save face to DB: {}", e),
                                }
                            }
                            Err(e) => {
                                eprintln!("Failed to generate embedding: {}", e);
                                continue;
                            }
                        }
                    }
                }
                Err(e) => {
                    eprintln!("Error processing {}: {}", image_path.display(), e);
                    continue;
                }
            }
        }

        Ok(faces_found)
    }

    /// Process all images in a directory tree (recursively) that haven't been processed yet
    pub async fn process_directory(
        &self,
        base_dir: &Path,
        app_handle: &AppHandle,
    ) -> Result<usize> {
        let db = self.get_db()?;
        
        // Get all processed image paths from database
        let processed_images: std::collections::HashSet<String> = db
            .get_all_faces()?
            .into_iter()
            .map(|face| face.image_path)
            .collect();
        
        // Find all image files recursively
        let mut image_files: Vec<PathBuf> = Vec::new();
        self.find_images_recursive(base_dir, &mut image_files)?;
        
        // Filter out already processed images
        let unprocessed_files: Vec<PathBuf> = image_files
            .into_iter()
            .filter(|path| {
                !processed_images.contains(&path.to_string_lossy().to_string())
            })
            .collect();
        
        eprintln!(
            "[DEBUG] Found {} unprocessed images out of total in {}",
            unprocessed_files.len(),
            base_dir.display()
        );

        let total_images = unprocessed_files.len();
        let mut faces_found = 0;

        // Process images
        for (idx, image_path) in unprocessed_files.iter().enumerate() {
            // Emit progress event
            let _ = app_handle.emit("face-processing-progress", serde_json::json!({
                "current": idx + 1,
                "total": total_images,
                "image_path": image_path.to_string_lossy(),
            }));

            // Detect faces in image
            match self.detect_faces(image_path).await {
                Ok(detections) => {
                    for detection in detections {
                        // Generate embedding
                        match self.generate_embedding(image_path, &detection.bounding_box).await {
                            Ok(embedding) => {
                                // Save face thumbnail
                                let thumbnail_path = match self.save_face_thumbnail(
                                    image_path,
                                    &detection.bounding_box,
                                    faces_found,
                                ) {
                                    Ok(path) => path,
                                    Err(e) => {
                                        eprintln!("Failed to save thumbnail: {}", e);
                                        continue;
                                    }
                                };

                                // Save to database
                                match db.insert_face(
                                    &image_path.to_string_lossy(),
                                    &detection.bounding_box,
                                    &embedding,
                                    detection.confidence,
                                    &thumbnail_path.to_string_lossy(),
                                ) {
                                    Ok(_) => faces_found += 1,
                                    Err(e) => eprintln!("Failed to save face to DB: {}", e),
                                }
                            }
                            Err(e) => {
                                eprintln!("Failed to generate embedding: {}", e);
                                continue;
                            }
                        }
                    }
                }
                Err(e) => {
                    eprintln!("Error processing {}: {}", image_path.display(), e);
                    continue;
                }
            }
        }

        Ok(faces_found)
    }

    /// Recursively find all image files in a directory
    fn find_images_recursive(&self, dir: &Path, results: &mut Vec<PathBuf>) -> Result<()> {
        if !dir.is_dir() {
            return Ok(());
        }

        for entry in std::fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            
            if path.is_dir() {
                self.find_images_recursive(&path, results)?;
            } else if path.is_file() {
                if let Some(ext) = path.extension() {
                    if let Some(ext_str) = ext.to_str() {
                        if matches!(ext_str.to_lowercase().as_str(), "jpg" | "jpeg" | "png" | "webp") {
                            results.push(path);
                        }
                    }
                }
            }
        }

        Ok(())
    }

    /// Detect faces in an image using Ultra-Light Face Detector
    async fn detect_faces(&self, image_path: &Path) -> Result<Vec<FaceDetection>> {
        // Load image
        let img = image::open(image_path)
            .context("Failed to load image")?;
        
        let (orig_width, orig_height) = (img.width(), img.height());
        
        // Resize to model input size (320x240)
        let img_resized = img.resize_exact(320, 240, FilterType::Triangle);
        
        // Convert to RGB and normalize
        let img_rgb = img_resized.to_rgb8();
        let mut input_data = Array4::<f32>::zeros((1, 3, 240, 320));
        
        // Normalize: (pixel - mean) / std
        let mean = [127.0, 127.0, 127.0];
        let std = [128.0, 128.0, 128.0];
        
        for y in 0..240 {
            for x in 0..320 {
                let pixel = img_rgb.get_pixel(x, y);
                for c in 0..3 {
                    input_data[[0, c, y as usize, x as usize]] = 
                        (pixel[c] as f32 - mean[c]) / std[c];
                }
            }
        }
        
        // Run inference
        let (scores_data, boxes_data, scores_shape) = self.run_detection(input_data)?;
        
        let mut detections = Vec::new();
        let confidence_threshold = 0.7;
        
        // Process detections - assuming shape is [1, N, 2] for scores and [1, N, 4] for boxes
        let num_detections = scores_shape[1] as usize;
        for i in 0..num_detections {
            let score_idx = i * 2 + 1; // Class 1 is "face"
            let score = scores_data[score_idx];
            
            if score > confidence_threshold {
                // Extract box coordinates (normalized)
                let box_idx = i * 4;
                let x1 = boxes_data[box_idx];
                let y1 = boxes_data[box_idx + 1];
                let x2 = boxes_data[box_idx + 2];
                let y2 = boxes_data[box_idx + 3];
                
                // Scale back to original image size
                let x = (x1 * orig_width as f32) as i32;
                let y = (y1 * orig_height as f32) as i32;
                let width = ((x2 - x1) * orig_width as f32) as i32;
                let height = ((y2 - y1) * orig_height as f32) as i32;
                
                // Bounds checking
                if x >= 0 && y >= 0 && width > 0 && height > 0 {
                    detections.push(FaceDetection {
                        bounding_box: BoundingBox {
                            x,
                            y,
                            width,
                            height,
                        },
                        confidence: score as f64,
                    });
                }
            }
        }
        
        // Apply NMS (Non-Maximum Suppression) to remove overlapping detections
        let detections = non_maximum_suppression(detections, 0.3);
        
        Ok(detections)
    }

    /// Generate face embedding using ArcFace
    async fn generate_embedding(
        &self,
        image_path: &Path,
        bbox: &BoundingBox,
    ) -> Result<Vec<f32>> {
        // Load image
        let img = image::open(image_path)
            .context("Failed to load image")?;
        
        // Crop face
        let face = crop_face(&img, bbox);
        
        // Resize to 112x112 (ArcFace input size)
        let face_resized = face.resize_exact(112, 112, FilterType::Triangle);
        let face_rgb = face_resized.to_rgb8();
        
        // Convert to tensor and normalize
        let mut input_data = Array4::<f32>::zeros((1, 3, 112, 112));
        
        // MobileFaceNet typically expects:
        // 1. BGR channel order (not RGB) - OpenCV convention
        // 2. Simple 0-1 normalization or mean-std normalization
        // Let's try BGR with 0-1 normalization first
        for y in 0..112 {
            for x in 0..112 {
                let pixel = face_rgb.get_pixel(x, y);
                // BGR order: channel 0 = Blue, 1 = Green, 2 = Red
                input_data[[0, 0, y as usize, x as usize]] = pixel[2] as f32 / 255.0; // B
                input_data[[0, 1, y as usize, x as usize]] = pixel[1] as f32 / 255.0; // G
                input_data[[0, 2, y as usize, x as usize]] = pixel[0] as f32 / 255.0; // R
            }
        }
        
        eprintln!("[EMBEDDING DEBUG] Input stats - min: {}, max: {}, mean: {}", 
            input_data.iter().fold(f32::INFINITY, |a, &b| a.min(b)),
            input_data.iter().fold(f32::NEG_INFINITY, |a, &b| a.max(b)),
            input_data.iter().sum::<f32>() / input_data.len() as f32
        );
        
        // Run inference
        let embedding = self.run_recognition(input_data)?;
        
        eprintln!("[EMBEDDING DEBUG] Raw embedding - min: {}, max: {}, mean: {}, len: {}", 
            embedding.iter().fold(f32::INFINITY, |a, &b| a.min(b)),
            embedding.iter().fold(f32::NEG_INFINITY, |a, &b| a.max(b)),
            embedding.iter().sum::<f32>() / embedding.len() as f32,
            embedding.len()
        );
        
        // L2 normalize the embedding
        let norm: f32 = embedding.iter().map(|x| x * x).sum::<f32>().sqrt();
        let normalized: Vec<f32> = embedding.iter().map(|x| x / norm).collect();
        
        // Verify normalization
        let norm_after: f32 = normalized.iter().map(|x| x * x).sum::<f32>().sqrt();
        
        eprintln!("[EMBEDDING DEBUG] Normalization - before_norm: {:.6}, after_norm: {:.6}, first 5: {:?}", 
            norm,
            norm_after,
            &normalized[..5.min(normalized.len())]
        );
        
        Ok(normalized)
    }

    /// Save cropped face as thumbnail
    fn save_face_thumbnail(
        &self,
        image_path: &Path,
        bbox: &BoundingBox,
        face_id: usize,
    ) -> Result<PathBuf> {
        let img = image::open(image_path)?;
        
        // Crop face
        let face_crop = crop_face(&img, bbox);
        
        // Resize to standard thumbnail size
        let thumbnail = face_crop.resize(150, 150, FilterType::Lanczos3);
        
        // Save thumbnail
        let filename = format!(
            "face_{}_{}.jpg",
            image_path.file_stem().unwrap().to_string_lossy(),
            face_id
        );
        let thumbnail_path = self.thumbnails_dir.join(filename);
        thumbnail.save(&thumbnail_path)?;
        
        Ok(thumbnail_path)
    }

    /// Cluster faces using DBSCAN
    pub async fn cluster_faces(&self, threshold: f32) -> Result<Vec<FaceCluster>> {
        let db = self.get_db()?;
        
        // Clear existing clusters before re-clustering
        eprintln!("[DEBUG] Clearing existing clusters before re-clustering");
        db.clear_clusters()?;
        
        // Get all faces (now unclustered after clearing)
        let faces = db.get_all_faces()?;
        
        eprintln!("[DEBUG] Found {} faces to cluster", faces.len());
        
        if faces.is_empty() {
            return Ok(vec![]);
        }

        // Run DBSCAN clustering
        let clusters = self.dbscan_cluster(&faces, threshold)?;
        
        // Save clusters to database
        for (_cluster_id, face_indices) in clusters.iter().enumerate() {
            if face_indices.is_empty() {
                continue;
            }

            // Create cluster in DB
            let representative_face_id = faces[face_indices[0]].id;
            let cluster_db_id = db.create_cluster(
                representative_face_id,
                face_indices.len() as i64,
            )?;

            // Assign faces to cluster
            for &face_idx in face_indices {
                db.update_face_cluster(faces[face_idx].id, Some(cluster_db_id))?;
            }
        }

        // Return all clusters
        db.get_all_clusters()
    }

    /// DBSCAN clustering algorithm
    fn dbscan_cluster(&self, faces: &[Face], threshold: f32) -> Result<Vec<Vec<usize>>> {
        let n = faces.len();
        let mut labels = vec![-1i32; n];
        let mut cluster_id = 0;
        
        let min_samples = 1; // Minimum faces to form a cluster (changed from 2 to allow single-face clusters)
        
        eprintln!("\n=== CLUSTERING DIAGNOSTICS ===");
        eprintln!("Total faces to cluster: {}", n);
        eprintln!("Similarity threshold: {}", threshold);
        eprintln!("Min samples: {}", min_samples);
        
        // Calculate and log similarity matrix for first 10 faces (to avoid too much output)
        let sample_size = n.min(10);
        if sample_size > 1 {
            eprintln!("\nSimilarity matrix (first {} faces):", sample_size);
            for i in 0..sample_size {
                for j in 0..sample_size {
                    if i == j {
                        print!(" 1.000");
                    } else {
                        let sim = cosine_similarity(&faces[i].embedding, &faces[j].embedding);
                        print!(" {:.3}", sim);
                    }
                }
                println!();
            }
        }
        
        for i in 0..n {
            if labels[i] != -1 {
                continue; // Already processed
            }

            // Find neighbors
            let neighbors = self.find_neighbors(faces, i, threshold);
            
            eprintln!("\nFace {}: {} neighbors found (threshold: {})", i, neighbors.len(), threshold);
            
            if neighbors.len() < min_samples {
                labels[i] = -1; // Mark as noise
                eprintln!("  -> Marked as noise (not enough neighbors)");
                continue;
            }

            // Start new cluster
            labels[i] = cluster_id;
            let mut seed_set = neighbors.clone();
            let mut j = 0;
            
            eprintln!("  -> Starting cluster {} with face {}", cluster_id, i);
            
            while j < seed_set.len() {
                let neighbor = seed_set[j];
                
                if labels[neighbor] == -1 {
                    labels[neighbor] = cluster_id;
                } else if labels[neighbor] != -1 {
                    j += 1;
                    continue;
                }
                
                labels[neighbor] = cluster_id;
                
                // Find neighbors of neighbor
                let neighbor_neighbors = self.find_neighbors(faces, neighbor, threshold);
                if neighbor_neighbors.len() >= min_samples {
                    for &nn in &neighbor_neighbors {
                        if !seed_set.contains(&nn) {
                            seed_set.push(nn);
                        }
                    }
                }
                
                j += 1;
            }
            
            eprintln!("  -> Cluster {} completed with {} faces", cluster_id, seed_set.len() + 1);
            
            cluster_id += 1;
        }

        // Group faces by cluster
        let mut clusters: Vec<Vec<usize>> = vec![Vec::new(); cluster_id as usize];
        let mut noise_count = 0;
        
        for (face_idx, &label) in labels.iter().enumerate() {
            if label >= 0 {
                clusters[label as usize].push(face_idx);
            } else {
                noise_count += 1;
            }
        }
        
        eprintln!("\n=== CLUSTERING RESULTS ===");
        eprintln!("Total clusters formed: {}", cluster_id);
        eprintln!("Noise points (unclustered): {}", noise_count);
        for (i, cluster) in clusters.iter().enumerate() {
            eprintln!("Cluster {}: {} faces", i, cluster.len());
        }
        eprintln!("=============================\n");

        Ok(clusters)
    }

    /// Find neighbors within threshold distance (cosine similarity)
    fn find_neighbors(&self, faces: &[Face], index: usize, threshold: f32) -> Vec<usize> {
        let mut neighbors = Vec::new();
        let embedding1 = &faces[index].embedding;
        
        for (i, face) in faces.iter().enumerate() {
            if i == index {
                continue;
            }
            
            let similarity = cosine_similarity(embedding1, &face.embedding);
            if similarity >= threshold {
                neighbors.push(i);
            }
        }
        
        neighbors
    }

    /// Get all face clusters
    pub async fn get_clusters(&self) -> Result<Vec<FaceCluster>> {
        let db = self.get_db()?;
        db.get_all_clusters()
    }

    /// Get faces for a specific cluster
    pub async fn get_cluster_faces(&self, cluster_id: i64) -> Result<Vec<Face>> {
        let db = self.get_db()?;
        db.get_cluster_faces(cluster_id)
    }

    /// Assign label to a cluster
    pub async fn assign_label(&self, cluster_id: i64, label: &str) -> Result<()> {
        let db = self.get_db()?;
        db.assign_cluster_label(cluster_id, label)
    }

    /// Merge clusters
    pub async fn merge_clusters(&self, cluster_ids: &[i64], label: Option<&str>) -> Result<i64> {
        let db = self.get_db()?;
        db.merge_clusters(cluster_ids, label)
    }

    /// Clear all face data
    pub async fn clear_all(&self) -> Result<()> {
        let db = self.get_db()?;
        db.clear_all()
    }
}

/// Crop face from image with padding
fn crop_face(img: &DynamicImage, bbox: &BoundingBox) -> DynamicImage {
    let (img_width, img_height) = img.dimensions();
    
    // Add 20% padding
    let padding = 0.2;
    let pad_w = (bbox.width as f32 * padding) as i32;
    let pad_h = (bbox.height as f32 * padding) as i32;
    
    let x = (bbox.x - pad_w).max(0) as u32;
    let y = (bbox.y - pad_h).max(0) as u32;
    let width = (bbox.width + 2 * pad_w).min(img_width as i32 - x as i32) as u32;
    let height = (bbox.height + 2 * pad_h).min(img_height as i32 - y as i32) as u32;
    
    img.crop_imm(x, y, width, height)
}

/// Calculate cosine similarity between two vectors
fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() {
        return 0.0;
    }

    let dot_product: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();

    if norm_a == 0.0 || norm_b == 0.0 {
        return 0.0;
    }

    dot_product / (norm_a * norm_b)
}

/// Non-Maximum Suppression to remove overlapping detections
fn non_maximum_suppression(mut detections: Vec<FaceDetection>, iou_threshold: f32) -> Vec<FaceDetection> {
    if detections.is_empty() {
        return detections;
    }

    // Sort by confidence (descending)
    detections.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap());
    
    let mut keep = Vec::new();
    let mut suppressed = vec![false; detections.len()];
    
    for i in 0..detections.len() {
        if suppressed[i] {
            continue;
        }
        
        keep.push(detections[i].clone());
        
        // Suppress overlapping boxes
        for j in (i + 1)..detections.len() {
            if suppressed[j] {
                continue;
            }
            
            let iou = calculate_iou(&detections[i].bounding_box, &detections[j].bounding_box);
            if iou > iou_threshold {
                suppressed[j] = true;
            }
        }
    }
    
    keep
}

/// Calculate Intersection over Union (IoU) for two bounding boxes
fn calculate_iou(box1: &BoundingBox, box2: &BoundingBox) -> f32 {
    let x1_inter = box1.x.max(box2.x);
    let y1_inter = box1.y.max(box2.y);
    let x2_inter = (box1.x + box1.width).min(box2.x + box2.width);
    let y2_inter = (box1.y + box1.height).min(box2.y + box2.height);
    
    let inter_width = (x2_inter - x1_inter).max(0);
    let inter_height = (y2_inter - y1_inter).max(0);
    let intersection = (inter_width * inter_height) as f32;
    
    let area1 = (box1.width * box1.height) as f32;
    let area2 = (box2.width * box2.height) as f32;
    let union = area1 + area2 - intersection;
    
    if union == 0.0 {
        0.0
    } else {
        intersection / union
    }
}
