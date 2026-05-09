"""
Per-platform download counters.

Counts every successful /proxy invocation, grouped by platform. Persists to
a small JSON file so counts survive restarts. No URLs, IPs, or timestamps —
just totals.
"""
import json
import threading
from collections import Counter
from pathlib import Path

_FILE = Path(__file__).resolve().parent.parent / "downloads_stats.json"
_LOCK = threading.Lock()
_COUNTS: Counter[str] = Counter()

PLATFORMS = ("tiktok", "youtube", "instagram", "facebook", "x")


def _load() -> None:
    if not _FILE.exists():
        return
    try:
        data = json.loads(_FILE.read_text())
        for k, v in data.items():
            if isinstance(v, int):
                _COUNTS[k] = v
    except Exception:
        pass


def _save() -> None:
    try:
        _FILE.write_text(json.dumps(dict(_COUNTS)))
    except Exception:
        pass


def increment(platform: str) -> None:
    if platform == "twitter":
        platform = "x"
    if platform not in PLATFORMS:
        return
    with _LOCK:
        _COUNTS[platform] += 1
        _save()


def snapshot() -> dict[str, int]:
    with _LOCK:
        return {p: _COUNTS.get(p, 0) for p in PLATFORMS}


_load()
