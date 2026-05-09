"""
A small thread-safe TTL + LRU cache.

Why we have it:
    yt-dlp does an HTTP round-trip (sometimes several) to extract metadata.
    For a viral TikTok, hundreds of users may paste the same URL within
    minutes. Caching the response for a few minutes turns those into
    near-instant hits and avoids hammering platform APIs.

This is intentionally process-local. If you scale to multiple workers
later, replace this with Redis — same interface, swap the backend.
"""
from __future__ import annotations

import threading
import time
from collections import OrderedDict
from typing import Any, Optional


class TTLCache:
    def __init__(self, max_size: int = 1000, ttl_seconds: int = 600) -> None:
        self._max_size = max_size
        self._ttl = ttl_seconds
        self._store: "OrderedDict[str, tuple[float, Any]]" = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            expires_at, value = entry
            if time.time() > expires_at:
                # Expired — drop it lazily.
                self._store.pop(key, None)
                return None
            # Mark as recently used.
            self._store.move_to_end(key)
            return value

    def set(self, key: str, value: Any) -> None:
        with self._lock:
            expires_at = time.time() + self._ttl
            if key in self._store:
                self._store.move_to_end(key)
            self._store[key] = (expires_at, value)
            # Evict oldest if over capacity.
            while len(self._store) > self._max_size:
                self._store.popitem(last=False)

    def clear(self) -> None:
        with self._lock:
            self._store.clear()

    def __len__(self) -> int:
        with self._lock:
            return len(self._store)
