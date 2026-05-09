"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ExtractError, buildDownloadUrl, extractMetadata } from "@/lib/api";
import { clipboardReadSupported, readClipboard } from "@/lib/clipboard";
import { buildFilename } from "@/lib/format-utils";
import { detectPlatform, isHttpUrl, isLikelyMediaUrl } from "@/lib/url-detection";
import type { ExtractResponse } from "@/types";

import { IconBolt, IconClipboard, IconLoader } from "./icons";
import { PreviewResult } from "./PreviewResult";

/**
 * The crown jewel — the input row + result card.
 *
 * State machine:
 *   idle      → empty or unrecognized input
 *   fetching  → valid URL detected, extracting metadata
 *   ready     → metadata extracted, options shown
 *   error     → extraction failed; show friendly message
 *
 * Optimistic prefetch:
 *   The instant a recognized URL appears in the input — pasted, typed,
 *   or auto-filled — we kick off extraction. The user doesn't have to
 *   click the Download button for the first step. By the time they
 *   reach for it, the result is already there.
 *
 *   We debounce by 250ms to avoid hammering on fast typing, and use
 *   AbortController to cancel in-flight requests when the URL changes.
 */

type Status = "idle" | "fetching" | "ready" | "error";

interface State {
  status: Status;
  input: string;
  result: ExtractResponse | null;
  error: string | null;
  downloaded: boolean;
  filename: string | null;
}

const initialState: State = {
  status: "idle",
  input: "",
  result: null,
  error: null,
  downloaded: false,
  filename: null,
};

function triggerBrowserDownload(result: ExtractResponse): string | null {
  const opt = result.options[0];
  if (!opt) return null;
  const filename = buildFilename(result.title, opt.ext);
  const href = buildDownloadUrl(opt, filename, result.platform);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  return filename;
}

export function DownloadCard() {
  const [state, setState] = useState<State>(initialState);
  const [canReadClipboard, setCanReadClipboard] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDownloadRef = useRef(false);

  // Detect clipboard capability after mount (server-side render safe).
  useEffect(() => {
    setCanReadClipboard(clipboardReadSupported());
  }, []);

  // Handle PWA share_target — if the user shared a link to us, ?url=... is set.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const sharedUrl = params.get("url") || params.get("text");
    if (sharedUrl && isHttpUrl(sharedUrl)) {
      // Strip the param so reloads don't re-trigger.
      window.history.replaceState({}, "", window.location.pathname);
      setInputAndFetch(sharedUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cancel in-flight requests on unmount.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const fetchMetadata = useCallback(async (url: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((s) => ({ ...s, status: "fetching", error: null, result: null, downloaded: false, filename: null }));

    try {
      const result = await extractMetadata(url, controller.signal);
      if (controller.signal.aborted) return;
      let downloaded = false;
      let filename: string | null = null;
      if (pendingDownloadRef.current) {
        pendingDownloadRef.current = false;
        filename = triggerBrowserDownload(result);
        downloaded = filename != null;
      }
      setState((s) => ({ ...s, status: "ready", result, error: null, downloaded, filename }));
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      pendingDownloadRef.current = false;
      const message =
        err instanceof ExtractError
          ? err.userMessage
          : "Something went wrong. Try again.";
      setState((s) => ({ ...s, status: "error", error: message, result: null, downloaded: false, filename: null }));
    }
  }, []);

  const setInputAndFetch = useCallback(
    (value: string) => {
      setState((s) => ({ ...s, input: value, downloaded: false, filename: null }));
      if (debounceRef.current) clearTimeout(debounceRef.current);

      const trimmed = value.trim();
      if (!trimmed) {
        abortRef.current?.abort();
        pendingDownloadRef.current = false;
        setState({ ...initialState, input: value });
        return;
      }

      if (isLikelyMediaUrl(trimmed)) {
        debounceRef.current = setTimeout(() => {
          fetchMetadata(trimmed);
        }, 250);
      }
    },
    [fetchMetadata],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputAndFetch(e.target.value);
    },
    [setInputAndFetch],
  );

  const handlePaste = useCallback(async () => {
    const text = await readClipboard();
    if (text == null) {
      // Clipboard blocked or empty — focus the field so manual paste is easy.
      inputRef.current?.focus();
      return;
    }
    setInputAndFetch(text);
  }, [setInputAndFetch]);

  const handleDownload = useCallback(() => {
    const trimmed = state.input.trim();
    if (!trimmed) {
      handlePaste();
      return;
    }
    if (state.status === "ready" && state.result) {
      if (state.downloaded) return;
      const filename = triggerBrowserDownload(state.result);
      if (filename) {
        setState((s) => ({ ...s, downloaded: true, filename }));
      }
      return;
    }
    if (state.status === "fetching") {
      pendingDownloadRef.current = true;
      return;
    }
    pendingDownloadRef.current = true;
    fetchMetadata(trimmed);
  }, [state.input, state.status, state.result, state.downloaded, fetchMetadata, handlePaste]);

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      handleDownload();
    },
    [handleDownload],
  );

  const handleClear = useCallback(() => {
    abortRef.current?.abort();
    setState(initialState);
    inputRef.current?.focus();
  }, []);

  const platform = detectPlatform(state.input);
  const showResult = state.status === "fetching" || state.status === "ready" || state.status === "error";

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit}>
        <div
          className="input-row flex items-center gap-1.5 p-1.5 rounded-lg"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "0 0 0 4px var(--ring)",
            transition: "border-color 0.15s",
          }}
        >
          {canReadClipboard && (
            <button
              type="button"
              onClick={handlePaste}
              className="btn-ghost flex-shrink-0 text-[13px] px-3.5 py-2.5"
              aria-label="Paste from clipboard"
            >
              <IconClipboard width={16} height={16} />
              <span className="hidden xs:inline">Paste</span>
            </button>
          )}
          <input
            ref={inputRef}
            type="text"
            value={state.input}
            onChange={handleInputChange}
            placeholder={canReadClipboard ? "…or paste a video link here" : "Paste a video link"}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="flex-1 min-w-0 bg-transparent border-0 px-1 py-2 text-[15px] outline-none"
            style={{ color: "var(--ink-primary)" }}
            aria-label="Video URL"
          />
          {state.input && (
            <button
              type="button"
              onClick={handleClear}
              className="text-xs px-2 py-1 rounded transition-opacity hover:opacity-100 opacity-60"
              style={{ color: "var(--ink-tertiary)" }}
              aria-label="Clear"
            >
              Clear
            </button>
          )}
          <button
            type="submit"
            className="btn-primary flex-shrink-0"
            disabled={state.status === "fetching" && !state.input.trim()}
          >
            {state.status === "fetching" && pendingDownloadRef.current ? (
              <>
                <IconLoader width={16} height={16} />
                <span>Downloading…</span>
              </>
            ) : state.status === "fetching" ? (
              <>
                <IconLoader width={16} height={16} />
                <span>Reading…</span>
              </>
            ) : state.downloaded ? (
              "Downloaded"
            ) : (
              "Download"
            )}
          </button>
        </div>
      </form>

      <p
        className="text-center text-xs mt-3 mb-12 flex items-center justify-center gap-1.5"
        style={{ color: "var(--ink-tertiary)" }}
      >
        <IconBolt width={13} height={13} />
        <span>
          {canReadClipboard
            ? "one tap · reads your clipboard · starts the download"
            : "paste a link to start"}
        </span>
      </p>

      {showResult && (
        <PreviewResult
          status={state.status}
          result={state.result}
          error={state.error}
          platform={platform}
          downloaded={state.downloaded}
          filename={state.filename}
        />
      )}
    </div>
  );
}
