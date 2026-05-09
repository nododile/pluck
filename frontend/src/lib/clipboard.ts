/**
 * Read the system clipboard, if the browser allows it.
 *
 * The Clipboard API requires:
 *   - A secure context (https or localhost)
 *   - User permission (granted or prompted on first use)
 *   - Some browsers (Safari) require a recent user gesture
 *
 * Returns null on any failure — caller falls back to manual paste.
 */
export async function readClipboard(): Promise<string | null> {
  if (typeof navigator === "undefined") return null;
  if (!navigator.clipboard?.readText) return null;
  try {
    return await navigator.clipboard.readText();
  } catch {
    return null;
  }
}

/** True if the browser exposes a clipboard read API at all. */
export function clipboardReadSupported(): boolean {
  if (typeof navigator === "undefined") return false;
  return Boolean(navigator.clipboard?.readText);
}
