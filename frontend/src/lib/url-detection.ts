import type { Platform } from "@/types";

/**
 * Recognize supported platforms from a URL.
 *
 * Used in two places:
 *   1. Optimistic prefetch — fire metadata request the moment a valid URL
 *      appears in the input, before the user clicks Download.
 *   2. Friendly empty-state and error messaging.
 */

const PATTERNS: { platform: Platform; pattern: RegExp }[] = [
  { platform: "tiktok", pattern: /^(https?:\/\/)?(www\.)?(vm\.|vt\.|m\.)?tiktok\.com\// },
  { platform: "youtube", pattern: /^(https?:\/\/)?(www\.|m\.)?(youtube\.com|youtu\.be)\// },
  { platform: "instagram", pattern: /^(https?:\/\/)?(www\.)?instagram\.com\// },
  { platform: "facebook", pattern: /^(https?:\/\/)?(www\.|m\.)?(facebook\.com|fb\.watch)\// },
  { platform: "x", pattern: /^(https?:\/\/)?(www\.|mobile\.)?(twitter\.com|x\.com)\// },
];

export function detectPlatform(input: string): Platform {
  const trimmed = input.trim();
  for (const { platform, pattern } of PATTERNS) {
    if (pattern.test(trimmed)) return platform;
  }
  return "unknown";
}

/** Looks vaguely like a URL we might be able to handle. Cheap to compute. */
export function isLikelyMediaUrl(input: string): boolean {
  return detectPlatform(input) !== "unknown";
}

/**
 * Light validation that the string is a parseable http(s) URL. We don't
 * call new URL() in the hot path — this regex is enough for input changes.
 */
export function isHttpUrl(input: string): boolean {
  return /^https?:\/\/\S+$/i.test(input.trim());
}
