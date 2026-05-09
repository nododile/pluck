// Shape of API responses from the backend.
// Keep in sync with backend/app/schemas.py.

export type Platform =
  | "tiktok"
  | "youtube"
  | "instagram"
  | "facebook"
  | "x"
  | "twitter"
  | "unknown";

export type MediaKind = "video" | "audio" | "image";

export interface DownloadOption {
  label: string;
  kind: MediaKind;
  url: string;
  ext: string;
  width?: number | null;
  height?: number | null;
  filesize?: number | null;
  needs_proxy: boolean;
}

export interface ExtractResponse {
  platform: Platform;
  title: string;
  author?: string | null;
  duration?: number | null;
  thumbnail?: string | null;
  options: DownloadOption[];
}

export interface ApiError {
  error: string;
  detail?: string;
}
