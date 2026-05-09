"""
Streaming proxy.

For YouTube and a few other platforms, the CDN URLs are signed against
the requesting IP, so the user's browser can't fetch them directly. In
those cases we stream the bytes through our server — without ever
writing them to disk. The bytes flow source -> our process -> user.

Bandwidth cost notes:
    - This is the only path that costs us egress.
    - Oracle Cloud's Always Free tier includes 10TB outbound/month,
      which is enough for tens of thousands of short videos.
    - We forward Range requests so the browser can pause/resume.

Security:
    - We refuse to proxy arbitrary URLs. The caller must pass a
      short-lived signed token issued by the /extract endpoint.
      (TODO: implement signed tokens — for MVP we just allowlist hosts.)
"""
from __future__ import annotations

import asyncio
import logging
import shutil
from typing import AsyncIterator
from urllib.parse import quote, urlparse

import httpx
from fastapi import HTTPException
from fastapi.responses import StreamingResponse

from app.extractors import get_format_headers, get_mux_audio_url

log = logging.getLogger("pluck.proxy")
_FFMPEG_BIN = shutil.which("ffmpeg")


# Hosts we'll proxy. Anything else gets a 400.
_PROXYABLE_HOST_SUFFIXES = (
    ".googlevideo.com",
    ".fbcdn.net",
    ".cdninstagram.com",
    ".tiktokcdn.com",
    ".tiktokv.com",
    ".tiktok.com",
    ".muscdn.com",
    ".byteoversea.com",
    ".twimg.com",
)


def _is_proxyable(url: str) -> bool:
    try:
        host = (urlparse(url).hostname or "").lower()
    except Exception:
        return False
    # Match exact host or any subdomain of an allowlisted suffix.
    return any(host == suffix.lstrip(".") or host.endswith(suffix) for suffix in _PROXYABLE_HOST_SUFFIXES)


def _format_headers_for_ffmpeg(headers: dict[str, str]) -> str:
    return "".join(f"{k}: {v}\r\n" for k, v in headers.items())


async def _stream_muxed(video_url: str, audio_url: str, filename: str) -> StreamingResponse:
    """
    Mux a video-only stream and an audio-only stream into a single MP4 on the
    fly using ffmpeg, and stream the result to the client. No re-encoding —
    just stream copy + container remux. Uses fragmented MP4 so output can flow
    without seeking (no need to rewrite the moov atom at the end).
    """
    if not _FFMPEG_BIN:
        raise HTTPException(status_code=500, detail="ffmpeg not available on server.")

    video_headers = get_format_headers(video_url) or {}
    audio_headers = get_format_headers(audio_url) or {}

    cmd = [
        _FFMPEG_BIN,
        "-y", "-loglevel", "error", "-nostdin",
        "-headers", _format_headers_for_ffmpeg(video_headers), "-i", video_url,
        "-headers", _format_headers_for_ffmpeg(audio_headers), "-i", audio_url,
        "-map", "0:v:0", "-map", "1:a:0",
        "-c", "copy",
        "-movflags", "frag_keyframe+empty_moov+default_base_moof+omit_tfhd_offset",
        "-f", "mp4", "pipe:1",
    ]

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    async def iterator() -> AsyncIterator[bytes]:
        assert proc.stdout is not None
        try:
            while True:
                chunk = await proc.stdout.read(256 * 1024)
                if not chunk:
                    break
                yield chunk
        finally:
            if proc.returncode is None:
                proc.terminate()
                try:
                    await asyncio.wait_for(proc.wait(), timeout=5)
                except asyncio.TimeoutError:
                    proc.kill()
                    await proc.wait()
            if proc.returncode and proc.stderr is not None:
                err = (await proc.stderr.read()).decode("utf-8", "replace").strip()
                if err:
                    log.warning("ffmpeg exited %s: %s", proc.returncode, err[:500])

    ascii_filename = filename.encode("ascii", "ignore").decode().strip() or "download"
    return StreamingResponse(
        iterator(),
        media_type="video/mp4",
        headers={
            "Content-Type": "video/mp4",
            "Content-Disposition": (
                f'attachment; filename="{ascii_filename}"; '
                f"filename*=UTF-8''{quote(filename)}"
            ),
        },
    )


async def stream_proxy(url: str, range_header: str | None, filename: str) -> StreamingResponse:
    """Stream the upstream response straight to the client."""
    if not _is_proxyable(url):
        raise HTTPException(status_code=400, detail="URL not proxyable.")

    audio_url = get_mux_audio_url(url)
    if audio_url:
        return await _stream_muxed(url, audio_url, filename)

    # Start from the per-format headers yt-dlp built up during extraction
    # (User-Agent, Referer, Cookie, ...). These are what makes signed/auth'd
    # CDN URLs actually fetchable. Falls back to a generic UA if missing.
    upstream_headers: dict[str, str] = dict(get_format_headers(url) or {})
    upstream_headers.setdefault(
        "User-Agent",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36",
    )
    if range_header:
        upstream_headers["Range"] = range_header

    client = httpx.AsyncClient(
        timeout=httpx.Timeout(30.0, read=None),
        follow_redirects=True,
        http2=True,
    )

    try:
        upstream = await client.send(
            client.build_request("GET", url, headers=upstream_headers),
            stream=True,
        )
    except httpx.HTTPError:
        await client.aclose()
        raise HTTPException(status_code=502, detail="Couldn't reach upstream.")

    if upstream.status_code >= 400:
        status = upstream.status_code
        await upstream.aclose()
        await client.aclose()
        raise HTTPException(status_code=status, detail="Upstream returned an error.")

    headers_to_forward = {}
    for key in ("content-length", "content-range", "accept-ranges", "content-type"):
        value = upstream.headers.get(key)
        if value:
            headers_to_forward[key] = value
    # HTTP headers are latin-1; emoji or non-Latin chars in the title would crash
    # response init. Use RFC 5987 filename* for the real UTF-8 name and a sanitized
    # ASCII filename= as the legacy fallback.
    ascii_filename = filename.encode("ascii", "ignore").decode().strip() or "download"
    headers_to_forward["Content-Disposition"] = (
        f'attachment; filename="{ascii_filename}"; '
        f"filename*=UTF-8''{quote(filename)}"
    )

    async def iterator() -> AsyncIterator[bytes]:
        try:
            async for chunk in upstream.aiter_bytes(chunk_size=512 * 1024):
                yield chunk
        finally:
            await upstream.aclose()
            await client.aclose()

    return StreamingResponse(
        iterator(),
        status_code=upstream.status_code,
        headers=headers_to_forward,
        media_type=upstream.headers.get("content-type", "application/octet-stream"),
    )
