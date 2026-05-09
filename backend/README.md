# Pluck Backend

FastAPI service that wraps `yt-dlp`. Stateless. No database. In-memory cache + per-IP rate limiting.

## Running locally

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

Then open http://localhost:8000/docs for interactive Swagger docs.

## API

### `POST /extract`

Request:
```json
{ "url": "https://www.tiktok.com/@user/video/123" }
```

Response:
```json
{
  "platform": "tiktok",
  "title": "...",
  "author": "...",
  "duration": 42.0,
  "thumbnail": "https://...",
  "options": [
    {
      "label": "MP4 1080p",
      "kind": "video",
      "url": "https://v16-webapp.tiktokcdn.com/...",
      "ext": "mp4",
      "width": 1920,
      "height": 1080,
      "filesize": 12400000,
      "needs_proxy": false
    }
  ]
}
```

The frontend uses `needs_proxy` to decide whether to use the URL as a direct `<a download>` link (when `false`) or route through `/proxy?url=...` (when `true`).

### `GET /proxy?url=...&filename=...`

Streams the upstream URL to the client without storing anything. Only allowed for known platform CDN hosts. Forwards `Range` headers so pause/resume works.

### `GET /health`

Returns `{ "status": "ok", "cached_entries": N }`.

## Configuration

All via environment variables (see `.env.example`):

| Variable | Default | Purpose |
|---|---|---|
| `ALLOWED_ORIGINS` | `http://localhost:3000` | Comma-separated CORS allowlist. |
| `RATE_LIMIT_PER_MINUTE` | `30` | Per-IP requests/minute on `/extract` and `/proxy`. |
| `CACHE_TTL_SECONDS` | `600` | How long to cache metadata responses. |
| `CACHE_MAX_SIZE` | `1000` | Max cached entries before LRU eviction. |

## Updating yt-dlp

Platforms break extractors regularly. `yt-dlp` ships fixes within days. To update:

```bash
pip install --upgrade yt-dlp
pip freeze | grep yt-dlp >> requirements.txt   # then clean up the file
```

You probably want this on a weekly cron in production.

## Deploying

The included `Dockerfile` builds a slim image. On Oracle Cloud's Always Free ARM VM:

```bash
docker build -t pluck-backend .
docker run -d --restart=always -p 8000:8000 --env-file .env pluck-backend
```

Then point Cloudflare at the VM and you're done.

## Scaling notes

- The cache is process-local. If you run multiple workers/VMs, swap `TTLCache` for Redis (same `get`/`set` interface).
- `slowapi` rate limits are per-process. For distributed limiting use `slowapi`'s Redis backend.
- yt-dlp calls run in a thread pool (`asyncio.to_thread`) so they don't block the event loop.
