"""
Pluck API — main FastAPI app.

Endpoints:
    POST /extract       Extract metadata + direct URLs for a media link.
    GET  /proxy         Stream a URL through us (used only when CORS blocks direct download).
    GET  /health        Liveness probe for monitoring.
    GET  /              Tiny landing JSON.

Run locally:
    uvicorn app.main:app --reload --port 8000
"""
import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app import stats
from app.cache import TTLCache
from app.extractors import ExtractionError, extract
from app.proxy import stream_proxy
from app.schemas import ExtractRequest, ExtractResponse


load_dotenv()

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

ALLOWED_ORIGINS = [
    o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",") if o.strip()
]
RATE_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", "30"))
CACHE_TTL_SECONDS = int(os.getenv("CACHE_TTL_SECONDS", "600"))
CACHE_MAX_SIZE = int(os.getenv("CACHE_MAX_SIZE", "1000"))


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("pluck")


# ---------------------------------------------------------------------------
# App + middleware
# ---------------------------------------------------------------------------

limiter = Limiter(key_func=get_remote_address)
metadata_cache = TTLCache(max_size=CACHE_MAX_SIZE, ttl_seconds=CACHE_TTL_SECONDS)

app = FastAPI(
    title="Pluck API",
    version="0.1.0",
    description="Stateless metadata extractor for short-form video downloads.",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    max_age=3600,
)


@app.exception_handler(ExtractionError)
async def _extraction_error_handler(_: Request, exc: ExtractionError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={"error": exc.code, "detail": exc.message},
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/")
async def root() -> dict[str, str]:
    return {"name": "pluck", "status": "ok"}


@app.get("/health")
async def health() -> dict[str, object]:
    return {"status": "ok", "cached_entries": len(metadata_cache)}


@app.post("/extract", response_model=ExtractResponse)
@limiter.limit(f"{RATE_LIMIT_PER_MINUTE}/minute")
async def extract_endpoint(request: Request, body: ExtractRequest) -> ExtractResponse:
    url = str(body.url)

    cached = metadata_cache.get(url)
    if cached is not None:
        return cached

    log.info("extract %s", url)
    result = await extract(url)
    metadata_cache.set(url, result)
    return result


@app.get("/proxy")
@limiter.limit(f"{RATE_LIMIT_PER_MINUTE}/minute")
async def proxy_endpoint(
    request: Request,
    url: str = Query(..., description="Direct CDN URL to stream."),
    filename: str = Query("download.mp4", description="Suggested filename for the browser."),
    platform: str = Query("", description="Source platform — used for download counters."),
):
    """
    Stream `url` to the client. Only allowed for known platform CDN hosts.
    Used when direct browser download is blocked by CORS or IP-bound URLs.
    """
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Invalid URL.")
    if platform:
        stats.increment(platform)
    range_header = request.headers.get("range")
    return await stream_proxy(url=url, range_header=range_header, filename=filename)


@app.get("/stats")
async def stats_endpoint() -> dict[str, int]:
    """Per-platform download counts. Cheap; safe to poll."""
    return stats.snapshot()
