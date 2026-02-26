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
}

export interface DownloadProgress {
  album_title: string;
  album_index: number;
  album_total: number;
  image_index: number;
  image_total: number;
  filename: string;
  status: string;
}

export interface DownloadResult {
  total_albums: number;
  total_images: number;
  skipped: number;
  failed: number;
}

export type AppPage = "login" | "albums" | "download" | "settings" | "done";
