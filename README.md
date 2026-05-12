# Pluck

- **TRY IT NOW**: [Pluck It](https://pluck-enn.pages.dev)

> /plʌk/ — verb. To take quickly and cleanly. Also us.

A clean, fast, ad-free downloader for TikTok, YouTube, Instagram, Facebook, and X. No sign-up, no watermarks, no clutter.

## Architecture

```
┌─────────────────────┐         ┌──────────────────────┐         ┌─────────────────┐
│  Next.js frontend   │  POST   │   FastAPI backend    │  calls  │     yt-dlp      │
│  (Cloudflare Pages) │ ──────> │   (Oracle Cloud VM)  │ ──────> │  (extracts URL) │
└─────────────────────┘         └──────────────────────┘         └─────────────────┘
        │                                                                  │
        │            Browser downloads directly from platform CDN          │
        └──────────────────────────────────────────────────────────────────┘
                  (no bytes flow through our server in the common case)
```

The backend only extracts metadata + direct CDN URLs. Where possible, the browser downloads straight from the source platform — we never touch the bytes. Falls back to a streaming proxy only when CORS blocks the direct route.

## Project structure

```
pluck/
├── frontend/         # Next.js 15 + TypeScript + Tailwind
└── backend/          # FastAPI + yt-dlp
```

## Quick start (local development)

You'll need **two terminals** — one for the backend, one for the frontend.

### Terminal 1 — Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate         # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

Backend will be running at http://localhost:8000. API docs at http://localhost:8000/docs.

### Terminal 2 — Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Frontend will be running at http://localhost:3000.

## Tech stack

**Frontend**
- Next.js 15 (App Router) + React 18
- TypeScript (strict)
- Tailwind CSS
- Geist + Fraunces (Google Fonts)

**Backend**
- FastAPI (async)
- yt-dlp (the workhorse)
- slowapi (rate limiting)
- In-memory LRU cache

## Design principles

1. **Clarity first, personality second.** "Download" on the button  "Pluck" everywhere else.
2. **Optimistic everything.** Metadata fetches the moment a valid URL appears, not when a button is clicked.
3. **Zero bytes through us when avoidable.** Browser downloads directly from platform CDNs.
4. **No state, no accounts, no logs.** Stateless backend, per-IP rate limiting only.

## License

MIT
