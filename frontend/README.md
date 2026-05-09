# Pluck Frontend

Next.js 15 + TypeScript + Tailwind. The whole UI is one page that talks to the backend.

## Running locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

The backend must be running at the URL in `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`).

## Scripts

```bash
npm run dev         # Dev server with hot reload
npm run build       # Production build
npm run start       # Run the production build
npm run type-check  # TypeScript check without emitting
npm run lint        # ESLint
```

## Project structure

```
src/
├── app/
│   ├── layout.tsx       # Root layout, fonts, metadata
│   ├── page.tsx         # Single landing page
│   ├── globals.css      # Tailwind + design tokens (CSS vars for dark mode)
│   ├── manifest.ts      # PWA manifest with share_target
│   └── icon.tsx         # Generated app icon
├── components/
│   ├── Header.tsx
│   ├── Hero.tsx
│   ├── DownloadCard.tsx # The interactive crown jewel — input, paste, fetch
│   ├── PreviewResult.tsx
│   ├── PlatformPills.tsx
│   ├── Footer.tsx
│   └── icons.tsx        # Inline SVG icons (no library bloat)
├── lib/
│   ├── api.ts           # Backend client
│   ├── url-detection.ts # Platform regex matching
│   ├── clipboard.ts     # Clipboard API wrapper
│   └── format-utils.ts  # bytes/duration/filename helpers
└── types/
    └── index.ts         # Mirrors backend schemas
```

## Design

- **Fonts**: [Geist](https://vercel.com/font) (sans) + [Fraunces](https://fonts.google.com/specimen/Fraunces) (italic serif), via `next/font/google`. Both free.
- **Theme**: Light by default, automatic dark mode via `prefers-color-scheme`.
- **Tokens**: CSS variables in `globals.css`, mirrored in `tailwind.config.ts`. Edit one, the other follows.
- **Icons**: Hand-rolled inline SVG (`components/icons.tsx`). No dependency on lucide-react / react-icons / etc.

## Notable UX touches

1. **Optimistic prefetch** (DownloadCard.tsx) — debounce 250ms after a recognized URL appears in the input, fire `/extract` automatically. By the time the user clicks Download, the result is already there.
2. **PWA share target** (manifest.ts + DownloadCard.tsx useEffect) — install on Android, appears in TikTok's Share menu, taps land at `/?url=...` and auto-extract.
3. **Clipboard auto-detect** — only show the Paste button if `navigator.clipboard.readText` is supported. Fall back gracefully on iOS Safari etc.
4. **Direct CDN handoff** — when `needs_proxy` is false, the Download button is just `<a href={cdnUrl} download>`. Bytes never touch our backend.
5. **AbortController** — typing fast cancels the previous fetch before starting a new one.

## Deploying

Static export works with Cloudflare Pages:

```bash
# Add to next.config.mjs:
#   output: 'export',
#   trailingSlash: true,
npm run build
# Then deploy the `out/` directory to Cloudflare Pages.
```

For now, just `npm run dev` — the priority is getting it on GitHub.
