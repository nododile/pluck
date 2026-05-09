import type { ApiError, ExtractResponse } from "@/types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

export class ExtractError extends Error {
  readonly code: string;
  readonly userMessage: string;

  constructor(code: string, userMessage: string) {
    super(userMessage);
    this.name = "ExtractError";
    this.code = code;
    this.userMessage = userMessage;
  }
}

/**
 * Extract metadata for a media URL.
 *
 * Throws ExtractError on failure. The caller should display
 * `error.userMessage` directly — it's already user-facing.
 */
export async function extractMetadata(
  url: string,
  signal?: AbortSignal,
): Promise<ExtractResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw err;
    }
    throw new ExtractError(
      "network",
      "Couldn't reach the server. Check your connection and try again.",
    );
  }

  if (response.ok) {
    return (await response.json()) as ExtractResponse;
  }

  if (response.status === 429) {
    throw new ExtractError(
      "rate_limited",
      "You're going a bit fast — give it a minute and try again.",
    );
  }

  // Try to parse the structured error from the backend.
  try {
    const body = (await response.json()) as ApiError;
    throw new ExtractError(
      body.error || "unknown",
      body.detail || "Something went wrong.",
    );
  } catch (err) {
    if (err instanceof ExtractError) throw err;
    throw new ExtractError("unknown", "Something went wrong. Try again.");
  }
}

/**
 * Build the URL the browser should hit to download an option.
 *   - When direct download works: just the option's CDN URL.
 *   - When we need to proxy: route through the backend's /proxy endpoint.
 */
export function buildDownloadUrl(
  option: { url: string; needs_proxy: boolean; ext: string },
  filename: string,
  platform?: string,
): string {
  if (!option.needs_proxy) {
    return option.url;
  }
  const params = new URLSearchParams({
    url: option.url,
    filename,
  });
  if (platform) params.set("platform", platform);
  return `${API_BASE}/proxy?${params.toString()}`;
}

export interface PlatformStats {
  tiktok: number;
  youtube: number;
  instagram: number;
  facebook: number;
  x: number;
}

export async function fetchStats(signal?: AbortSignal): Promise<PlatformStats> {
  const response = await fetch(`${API_BASE}/stats`, { signal });
  if (!response.ok) throw new Error(`stats ${response.status}`);
  return (await response.json()) as PlatformStats;
}
