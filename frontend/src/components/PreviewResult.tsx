"use client";

import { formatDuration } from "@/lib/format-utils";
import type { ExtractResponse, Platform } from "@/types";

import { IconCheck, IconLoader, IconPlay, IconX } from "./icons";

interface Props {
  status: "fetching" | "ready" | "error" | "idle";
  result: ExtractResponse | null;
  error: string | null;
  platform: Platform;
  downloaded: boolean;
  filename: string | null;
}

export function PreviewResult({ status, result, error, downloaded, filename }: Props) {
  if (status === "fetching") {
    return <SkeletonCard />;
  }

  if (status === "error") {
    return <ErrorCard message={error ?? "Something went wrong."} />;
  }

  if (status === "ready" && result) {
    return <ResultCard result={result} downloaded={downloaded} filename={filename} />;
  }

  return null;
}

/* ---------------------------------------------------------------------- */
/* Loading skeleton                                                        */
/* ---------------------------------------------------------------------- */

function SkeletonCard() {
  return (
    <div className="surface-card p-4 flex gap-4 items-center animate-fade-in">
      <div
        className="w-[88px] h-[88px] rounded-md flex items-center justify-center flex-shrink-0"
        style={{ background: "var(--muted)" }}
      >
        <IconLoader width={24} height={24} style={{ color: "var(--ink-tertiary)" }} />
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-4 rounded w-3/4" style={{ background: "var(--muted)" }} />
        <div className="h-3 rounded w-1/2" style={{ background: "var(--muted)" }} />
        <div className="flex gap-2 mt-3">
          <div className="h-6 rounded w-20" style={{ background: "var(--muted)" }} />
          <div className="h-6 rounded w-16" style={{ background: "var(--muted)" }} />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Error                                                                   */
/* ---------------------------------------------------------------------- */

function ErrorCard({ message }: { message: string }) {
  return (
    <div
      className="rounded-lg p-4 flex items-start gap-3 animate-slide-up"
      style={{
        background: "rgba(220, 38, 38, 0.04)",
        border: "1px solid rgba(220, 38, 38, 0.15)",
      }}
    >
      <div
        className="flex-shrink-0 mt-0.5"
        style={{ color: "rgba(220, 38, 38, 0.9)" }}
      >
        <IconX width={18} height={18} />
      </div>
      <p className="text-sm leading-relaxed" style={{ color: "var(--ink-primary)" }}>
        {message}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Success — preview + download confirmation                               */
/* ---------------------------------------------------------------------- */

function ResultCard({
  result,
  downloaded,
  filename,
}: {
  result: ExtractResponse;
  downloaded: boolean;
  filename: string | null;
}) {
  const duration = formatDuration(result.duration);

  return (
    <div className="surface-card p-4 sm:p-5 animate-slide-up">
      <div className="flex gap-4 items-start">
        <Thumbnail src={result.thumbnail} />
        <div className="flex-1 min-w-0">
          <p
            className="text-[15px] font-medium leading-snug truncate sm:whitespace-normal sm:line-clamp-2"
            title={result.title}
          >
            {result.title}
          </p>
          <p
            className="text-[13px] mt-1 flex items-center gap-1.5 flex-wrap"
            style={{ color: "var(--ink-secondary)" }}
          >
            {result.author && <span>@{result.author}</span>}
            {result.author && duration && <span aria-hidden="true">·</span>}
            {duration && <span>{duration}</span>}
          </p>
        </div>
      </div>

      {downloaded && filename ? (
        <div
          className="mt-4 rounded-md px-3 py-2.5 flex items-start gap-2.5"
          style={{
            background: "rgba(22, 163, 74, 0.06)",
            border: "1px solid rgba(22, 163, 74, 0.18)",
          }}
        >
          <div className="flex-shrink-0 mt-0.5" style={{ color: "rgba(22, 163, 74, 0.95)" }}>
            <IconCheck width={16} height={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium" style={{ color: "var(--ink-primary)" }}>
              Saved to your Downloads folder
            </p>
            <p
              className="text-[12px] mt-0.5 truncate"
              style={{ color: "var(--ink-secondary)" }}
              title={filename}
            >
              {filename}
            </p>
          </div>
        </div>
      ) : (
        <p
          className="text-[12px] mt-4 flex items-center gap-1.5"
          style={{ color: "var(--ink-tertiary)" }}
        >
          <IconCheck width={12} height={12} />
          <span>Ready — click Download to save the highest-quality version.</span>
        </p>
      )}
    </div>
  );
}

function Thumbnail({ src }: { src?: string | null }) {
  if (!src) {
    return (
      <div
        className="w-[88px] h-[88px] rounded-md flex items-center justify-center flex-shrink-0"
        style={{ background: "var(--muted)", color: "var(--ink-secondary)" }}
        aria-hidden="true"
      >
        <IconPlay width={28} height={28} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="w-[88px] h-[88px] rounded-md object-cover flex-shrink-0"
      style={{ background: "var(--muted)" }}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}
