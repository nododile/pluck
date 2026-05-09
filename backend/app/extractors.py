"""
yt-dlp wrapper that normalizes its raw output into our schema.

Design notes:
    - We always pass `skip_download=True` — we never download anything
      server-side. We only extract metadata + direct CDN URLs and hand
      them back to the browser.

    - We classify each format's CORS-friendliness on a best-effort basis.
      Platforms that hand out short-lived signed URLs tied to the
      requesting IP (YouTube's googlevideo.com, in particular) won't work
      directly from the browser, so we mark those as needing a proxy.

    - Errors from yt-dlp are mapped to a small set of user-facing
      messages. We never leak yt-dlp's internal detail to the client.
"""
from __future__ import annotations

import asyncio
import re
from typing import Any, Optional
from urllib.parse import urlparse

from yt_dlp import YoutubeDL
from yt_dlp.utils import DownloadError, ExtractorError

from app.schemas import DownloadOption, ExtractResponse, Platform


# ---------------------------------------------------------------------------
# Platform detection
# ---------------------------------------------------------------------------

_PLATFORM_HOSTS: dict[str, Platform] = {
    "tiktok.com": "tiktok",
    "vm.tiktok.com": "tiktok",
    "vt.tiktok.com": "tiktok",
    "youtube.com": "youtube",
    "youtu.be": "youtube",
    "m.youtube.com": "youtube",
    "instagram.com": "instagram",
    "www.instagram.com": "instagram",
    "facebook.com": "facebook",
    "www.facebook.com": "facebook",
    "fb.watch": "facebook",
    "twitter.com": "x",
    "www.twitter.com": "x",
    "x.com": "x",
    "www.x.com": "x",
}


def detect_platform(url: str) -> Platform:
    try:
        host = urlparse(url).hostname or ""
    except Exception:
        return "unknown"
    host = host.lower()
    if host.startswith("www."):
        host = host[4:]
    return _PLATFORM_HOSTS.get(host, _PLATFORM_HOSTS.get(f"www.{host}", "unknown"))


# Hosts where direct browser download generally works (URLs not IP-bound, CORS permissive enough).
_DIRECT_OK_HOST_PATTERNS = (
    re.compile(r"\.tiktokcdn(-[a-z]+)?\.com$"),
    re.compile(r"\.tiktokv\.com$"),
    re.compile(r"\.twimg\.com$"),
    re.compile(r"video\.twimg\.com$"),
)


def _format_needs_proxy(format_url: str) -> bool:
    """
    Best-effort classifier: does this URL need to be proxied through us
    rather than fetched directly by the browser?
    """
    try:
        host = (urlparse(format_url).hostname or "").lower()
    except Exception:
        return True

    # Whitelisted: try direct.
    for pat in _DIRECT_OK_HOST_PATTERNS:
        if pat.search(host):
            return False

    # YouTube/Google's video CDN signs URLs against the requesting IP.
    if host.endswith(".googlevideo.com"):
        return True

    # Meta CDN URLs are signed and short-lived but sometimes browser-friendly.
    # Default to proxying to be safe.
    if "fbcdn.net" in host or "cdninstagram.com" in host:
        return True

    # Unknown host — default to proxying for safety.
    return True


# ---------------------------------------------------------------------------
# Error mapping
# ---------------------------------------------------------------------------


class ExtractionError(Exception):
    """Raised when we can't extract metadata. `code` is a stable string for the frontend."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def _map_ytdlp_error(exc: Exception) -> ExtractionError:
    """Translate a yt-dlp exception into a user-facing error."""
    text = str(exc).lower()
    if "private" in text or "login required" in text or "sign in" in text:
        return ExtractionError(
            "private",
            "This post is private or requires login. Try a public link.",
        )
    if "not available" in text or "unavailable" in text or "removed" in text:
        return ExtractionError(
            "unavailable",
            "This media is unavailable — it may have been removed or geo-blocked.",
        )
    if "unsupported url" in text or "no video" in text:
        return ExtractionError(
            "unsupported",
            "We can't pluck that one yet. Make sure it's a public TikTok, YouTube, Instagram, Facebook or X link.",
        )
    return ExtractionError(
        "extraction_failed",
        "Something went wrong reading that link. Try again in a moment.",
    )


# ---------------------------------------------------------------------------
# yt-dlp invocation
# ---------------------------------------------------------------------------

_YDL_OPTS: dict[str, Any] = {
    "skip_download": True,
    "quiet": True,
    "no_warnings": True,
    "noplaylist": True,
    # Don't write any files server-side, ever.
    "writesubtitles": False,
    "writeinfojson": False,
    "writethumbnail": False,
    # Reasonable network timeouts.
    "socket_timeout": 15,
}


# Maps a format URL to the headers needed to fetch it (UA, Referer, Cookie, ...).
# Populated by _run_extract; consumed by the /proxy endpoint when a browser
# can't fetch the URL directly. Bounded so memory doesn't grow unbounded.
_FORMAT_HEADERS: dict[str, dict[str, str]] = {}
_FORMAT_HEADERS_MAX = 2000

# When a platform serves video and audio as separate streams (YouTube, post-2020),
# we record the audio stream that should be muxed with the video URL.
# Lookup by video URL: returns the audio URL (or None for progressive formats).
_MUX_AUDIO: dict[str, str] = {}


def get_format_headers(url: str) -> dict[str, str] | None:
    return _FORMAT_HEADERS.get(url)


def get_mux_audio_url(video_url: str) -> str | None:
    return _MUX_AUDIO.get(video_url)


def _record_format_headers(url: str, headers: dict[str, str]) -> None:
    if len(_FORMAT_HEADERS) >= _FORMAT_HEADERS_MAX:
        for k in list(_FORMAT_HEADERS.keys())[: _FORMAT_HEADERS_MAX // 10]:
            _FORMAT_HEADERS.pop(k, None)
    _FORMAT_HEADERS[url] = headers


def _record_mux_pair(video_url: str, audio_url: str) -> None:
    if len(_MUX_AUDIO) >= _FORMAT_HEADERS_MAX:
        for k in list(_MUX_AUDIO.keys())[: _FORMAT_HEADERS_MAX // 10]:
            _MUX_AUDIO.pop(k, None)
    _MUX_AUDIO[video_url] = audio_url


def _run_extract(url: str) -> dict[str, Any]:
    """Synchronous yt-dlp call. Run in a worker thread from async code."""
    with YoutubeDL(_YDL_OPTS) as ydl:
        info = ydl.extract_info(url, download=False)
        cookie_header = "; ".join(f"{c.name}={c.value}" for c in ydl.cookiejar if c.value)

    formats = (info.get("formats") if info else None) or ([info] if info else [])
    for fmt in formats:
        fmt_url = fmt.get("url")
        if not fmt_url:
            continue
        merged = dict(fmt.get("http_headers") or {})
        if cookie_header and "Cookie" not in {k.title() for k in merged}:
            merged["Cookie"] = cookie_header
        if merged:
            _record_format_headers(fmt_url, merged)

    return info


def _build_label(fmt: dict[str, Any]) -> str:
    ext = (fmt.get("ext") or "mp4").upper()
    height = fmt.get("height")
    abr = fmt.get("abr")
    vcodec = fmt.get("vcodec")
    acodec = fmt.get("acodec")

    is_audio_only = (vcodec in (None, "none")) and (acodec not in (None, "none"))

    if is_audio_only:
        return f"{ext} audio" + (f" {int(abr)}kbps" if abr else "")

    if height:
        return f"{ext} {height}p"

    return ext


def _format_to_option(fmt: dict[str, Any]) -> Optional[DownloadOption]:
    url = fmt.get("url")
    if not url:
        return None

    ext = fmt.get("ext") or "mp4"
    vcodec = fmt.get("vcodec")
    acodec = fmt.get("acodec")
    is_audio_only = (vcodec in (None, "none")) and (acodec not in (None, "none"))

    return DownloadOption(
        label=_build_label(fmt),
        kind="audio" if is_audio_only else "video",
        url=url,
        ext=ext,
        width=fmt.get("width"),
        height=fmt.get("height"),
        filesize=fmt.get("filesize") or fmt.get("filesize_approx"),
        needs_proxy=_format_needs_proxy(url),
    )


def _has_audio(fmt: dict[str, Any]) -> bool:
    return (fmt.get("acodec") or "none") not in (None, "none")


def _has_video(fmt: dict[str, Any]) -> bool:
    return (fmt.get("vcodec") or "none") not in (None, "none")


def _select_best_options(info: dict[str, Any]) -> list[DownloadOption]:
    """
    Pick exactly one option: the highest-quality MP4 with audio.

    Strategy:
    - If any progressive format (video+audio combined) exists, pick the highest
      H.264/MP4 one (universal compatibility).
    - Otherwise (typical for YouTube ≥ 480p), pick the best H.264 video-only +
      best AAC audio-only and register them as a mux pair. The proxy will mux
      them with ffmpeg and stream the resulting MP4.
    """
    raw_formats: list[dict[str, Any]] = info.get("formats") or []

    # Some extractors return a single flat URL.
    if not raw_formats and info.get("url"):
        single = _format_to_option(info)
        return [single] if single else []

    video_candidates = [f for f in raw_formats if f.get("url") and _has_video(f) and f.get("height")]
    audio_only = [f for f in raw_formats if f.get("url") and _has_audio(f) and not _has_video(f)]

    if not video_candidates:
        return []

    # Pick the highest-quality video stream we can actually deliver as MP4.
    # Tiers (highest first):
    #   1. Progressive H.264 (already MP4 with audio — no muxing)
    #   2. H.264 video-only paired with AAC audio (muxes cleanly)
    #   3. Other (VP9/AV1) video-only paired with AAC audio (still muxes to MP4)
    # Within each tier, prefer highest height, then fps.
    def video_score(f: dict[str, Any]) -> tuple[int, int, int, int]:
        # H.264 first (universal MP4 playback). Within H.264, prefer highest
        # height + fps. This caps YouTube at ~1080p (its highest H.264 stream)
        # rather than chasing 4K VP9/AV1 — much smaller file, plays everywhere.
        is_h264 = 1 if (f.get("vcodec") or "").startswith("avc1") else 0
        h = f.get("height") or 0
        fps = int(f.get("fps") or 0)
        progressive = 1 if _has_audio(f) else 0
        return (is_h264, h, fps, progressive)

    video_candidates.sort(key=video_score, reverse=True)
    best_video = video_candidates[0]

    # If chosen video already has audio, ship it as-is.
    if _has_audio(best_video):
        opt = _format_to_option(best_video)
        return [opt] if opt else []

    # Need to mux. Find best audio-only — prefer AAC for clean MP4 mux.
    if not audio_only:
        # No separate audio track available — fall back to video-only (silent).
        opt = _format_to_option(best_video)
        return [opt] if opt else []

    def audio_score(f: dict[str, Any]) -> tuple[int, float]:
        is_m4a = 1 if (f.get("ext") == "m4a" or (f.get("acodec") or "").startswith("mp4a")) else 0
        abr = f.get("abr") or 0
        return (is_m4a, abr)

    audio_only.sort(key=audio_score, reverse=True)
    best_audio = audio_only[0]

    video_url = best_video["url"]
    audio_url = best_audio["url"]
    _record_mux_pair(video_url, audio_url)

    height = best_video.get("height")
    width = best_video.get("width")
    combined_size = (best_video.get("filesize") or best_video.get("filesize_approx") or 0) + (
        best_audio.get("filesize") or best_audio.get("filesize_approx") or 0
    )

    return [DownloadOption(
        label=f"MP4 {height}p" if height else "MP4",
        kind="video",
        url=video_url,  # proxy will look up the mux pair via get_mux_audio_url().
        ext="mp4",
        width=width,
        height=height,
        filesize=combined_size or None,
        needs_proxy=True,
    )]


def _normalize(info: dict[str, Any], url: str) -> ExtractResponse:
    options = _select_best_options(info)
    if not options:
        raise ExtractionError(
            "no_formats",
            "We could read the post but couldn't find a downloadable file in it.",
        )
    return ExtractResponse(
        platform=detect_platform(url),
        title=info.get("title") or "Untitled",
        author=info.get("uploader") or info.get("channel") or info.get("creator"),
        duration=info.get("duration"),
        thumbnail=info.get("thumbnail"),
        options=options,
    )


# ---------------------------------------------------------------------------
# Public async entry point
# ---------------------------------------------------------------------------


async def extract(url: str) -> ExtractResponse:
    """
    Extract metadata for `url`. Runs yt-dlp in a worker thread so it
    doesn't block the event loop.
    """
    try:
        info = await asyncio.to_thread(_run_extract, url)
    except (DownloadError, ExtractorError) as exc:
        raise _map_ytdlp_error(exc) from exc
    except Exception as exc:  # noqa: BLE001 — last-resort safety net
        raise _map_ytdlp_error(exc) from exc

    if info is None:
        raise ExtractionError("extraction_failed", "Couldn't read that link.")

    return _normalize(info, url)
