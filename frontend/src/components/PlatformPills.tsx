"use client";

import { useEffect, useState } from "react";

import { fetchStats, type PlatformStats } from "@/lib/api";

import {
  IconFacebook,
  IconInstagram,
  IconTikTok,
  IconTwitterX,
  IconYouTube,
} from "./icons";

const PLATFORMS = [
  { name: "TikTok", key: "tiktok", Icon: IconTikTok },
  { name: "YouTube", key: "youtube", Icon: IconYouTube },
  { name: "Instagram", key: "instagram", Icon: IconInstagram },
  { name: "Facebook", key: "facebook", Icon: IconFacebook },
  { name: "X", key: "x", Icon: IconTwitterX },
] as const;

const POLL_INTERVAL_MS = 15_000;

export function PlatformPills() {
  const [counts, setCounts] = useState<PlatformStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const tick = async () => {
      try {
        const data = await fetchStats(controller.signal);
        if (!cancelled) setCounts(data);
      } catch {
        // Stats are non-essential — failures stay silent so the pills still render.
      }
    };

    tick();
    const id = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(id);
    };
  }, []);

  return (
    <div
      id="supported"
      className="flex items-center justify-center gap-x-6 gap-y-2 flex-wrap text-[13px]"
      style={{ color: "var(--ink-tertiary)" }}
    >
      {PLATFORMS.map(({ name, key, Icon }) => {
        const count = counts?.[key];
        return (
          <span key={name} className="flex items-center gap-1.5">
            <Icon />
            {name}
            {count != null && count > 0 && (
              <span
                className="ml-1 px-1.5 py-0.5 rounded text-[11px] tabular-nums"
                style={{ background: "var(--muted)", color: "var(--ink-secondary)" }}
              >
                {count}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
