"""
Request and response schemas for the Pluck API.

The frontend posts a URL; the backend returns a normalized
metadata object listing the available download options.
"""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field, HttpUrl


Platform = Literal["tiktok", "youtube", "instagram", "facebook", "x", "twitter", "unknown"]
MediaKind = Literal["video", "audio", "image"]


class ExtractRequest(BaseModel):
    url: HttpUrl = Field(..., description="The source URL to extract from.")


class DownloadOption(BaseModel):
    """One downloadable variant of the media (e.g. 1080p MP4)."""

    label: str = Field(..., description="Human-readable label, e.g. 'MP4 1080p'.")
    kind: MediaKind = Field(..., description="What this option contains.")
    url: str = Field(..., description="Direct CDN URL (used by the browser).")
    ext: str = Field(..., description="File extension without the dot, e.g. 'mp4'.")
    width: Optional[int] = Field(None, description="Pixel width if known.")
    height: Optional[int] = Field(None, description="Pixel height if known.")
    filesize: Optional[int] = Field(None, description="Size in bytes if known.")
    needs_proxy: bool = Field(
        False,
        description="True if the browser cannot fetch the URL directly (CORS/auth) and must use the proxy endpoint.",
    )


class ExtractResponse(BaseModel):
    """Normalized metadata returned to the frontend."""

    platform: Platform
    title: str
    author: Optional[str] = None
    duration: Optional[float] = Field(None, description="Length in seconds if applicable.")
    thumbnail: Optional[str] = None
    options: list[DownloadOption]


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
