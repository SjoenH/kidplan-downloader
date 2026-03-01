export interface Credentials {
  email: string;
  password: string;
}

export interface Kindergarten {
  id: number;
  name: string;
}

export interface Album {
  id: string;
  title: string;
  url: string;
  image_count: number | null;
}

export interface DownloadSettings {
  out_dir: string;
  delay_ms: number;
  limit_per_album: number;
  process_faces?: boolean;
  clustering_threshold?: number;
}

export interface DownloadProgress {
  album_title: string;
  album_index: number;
  album_total: number;
  image_index: number;
  image_total: number;
  filename: string;
  status: string;
  error_type?: string;
}

export interface DownloadResult {
  total_albums: number;
  total_images: number;
  skipped: number;
  failed: number;
}

// Face Recognition Types
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Face {
  id: number;
  image_path: string;
  bounding_box: BoundingBox;
  embedding: number[];
  confidence: number;
  cluster_id?: number;
  label?: string;
  thumbnail_path: string;
  created_at: number;
}

export interface FaceCluster {
  id: number;
  label?: string;
  representative_face_id: number;
  face_count: number;
  sample_thumbnail_path?: string;
  updated_at: number;
}

export interface PhotoWithFace {
  image_path: string;
  faces: Face[];
}

export interface FaceProcessingProgress {
  current: number;
  total: number;
  image_path: string;
}
