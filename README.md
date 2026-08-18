# PatrolGuard

PatrolGuard is a local-first companion app for hotel security officers. It tracks work
shifts and patrol rounds, logs incidents with photo and voice-memo evidence, and uses
AI to write professional Daily Activity Reports (DAR) and 5W incident reports — all
run on your own machine, with your own LLM of choice.

## Features

- **Shift management** — start/end shifts tied to a site; each shift automatically
  spawns a configurable set of patrol slots (2–8 rounds)
- **Patrol rounds** — work through checklists per round and record an outcome
  (`all_clear`, `minor_issues`, `requires_action`); finishing the last round
  auto-completes the shift
- **Incidents** — log types, locations, and details with attached photos and voice memos
- **AI reports** — generates a structured DAR for a shift or a 5W incident report
  (Who / What / Where / When / Why / Action taken) via any OpenAI-compatible API
- **AI profiles** — configure and test one or more LLM endpoints (OpenRouter, Ollama,
  LM Studio, ...); pick a default profile and override per report
- **Sites & locations** — manage multiple sites, each with its own patrol plan
- **Customization** — officer profile (name + badge), dark/light/system theme,
  and multiple accent color palettes

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite 5, Tailwind CSS 3, lucide-react icons |
| Backend | Express 4 (ESM), better-sqlite3, Multer |
| Database | SQLite (WAL mode) — schema auto-migrates on startup |
| LLM | Any OpenAI-compatible `chat/completions` endpoint |
| Deployment | Multi-stage Docker image, published to GitHub Container Registry |

## Repository Layout

```
├── client/                  # React frontend (Vite + Tailwind)
│   └── src/
│       ├── App.jsx          # Tabbed shell: Shift / Incidents / Reports / History / Settings
│       ├── components/      # Dashboard, Incidents, Reports, History, Settings, ...
│       └── lib/             # API client + formatting helpers
├── server/                  # Express API
│   ├── index.js             # Entry point: mounts routes, serves built frontend
│   ├── db.js                # SQLite schema + auto-migration
│   ├── llm.js               # OpenAI-compatible chat completion client
│   ├── routes/              # shifts, patrols, incidents, uploads, sites,
│   │                        # llm-profiles, reports, settings
│   └── migrate.js           # Standalone migration runner
├── docker-compose.yml       # Single-container deployment with persistent volume
├── Dockerfile               # Multi-stage build (React → Express runtime)
└── .github/workflows/       # GitHub Actions → build & push image to GHCR
```

## Getting Started

### Option 1: Docker (recommended)

Requirements: Docker + Docker Compose.

```bash
docker compose up -d
```

Open http://localhost:3000. All data (SQLite database + media uploads) persists in
the `patrolguard-data` volume, so photos, reports, and history survive container
restarts.

### Option 2: Local development

Requirements: Node.js ≥ 18.

Run the two dev servers in separate terminals:

```bash
# Terminal 1 — API server on http://localhost:3000
cd server
npm install
npm run dev

# Terminal 2 — Vite dev server on http://localhost:5173
cd client
npm install
npm run dev
```

The Vite dev server proxies `/api` and `/uploads` to the API server, so open
http://localhost:5173 for the full app with hot reload.

Useful scripts:

| Where | Script | Purpose |
| --- | --- | --- |
| server | `npm run dev` | Run API with auto-restart |
| server | `npm run start` | Run API (production) |
| server | `npm run migrate` | Apply schema migrations only |
| client | `npm run dev` | Vite dev server |
| client | `npm run build` | Production bundle to `client/dist` |
| client | `npm run preview` | Preview the production build |

Prefer a built frontend served by Express? Run `npm run build` in `client/` then
`npm run start` in `server/` — the API serves the bundle and SPA fallback on one
port (3000).

## First Run

1. Open **Settings** and fill in the officer profile (name, badge, company).
2. Add a **Site & Location** in Settings → Sites (a site is required to start a shift).
3. Add an **AI profile** in Settings → AI Profiles:
   - endpoint (base URL, e.g. `https://openrouter.ai/api/v1` or `http://localhost:11434/v1` for Ollama)
   - API key (blank for local servers) and model name
   - use the **test** button to verify connectivity, and set a default
4. Open **Shift**, pick a site, and **Start Shift**.

Complete your patrol rounds as you go. When you need paperwork, head to **Reports**
and generate a DAR or incident report with one click.

## Configuration

Everything is configured in-app (stored in SQLite); no environment files required.
Environment variables are only used for deployment:

| Variable | Default | Use |
| --- | --- | --- |
| `PORT` | `3000` | API port |
| `DATA_DIR` | `<repo>/data` (dev) or `/app/data` (Docker) | Location of the SQLite DB and uploads |

## API Overview

| Endpoint | Description |
| --- | --- |
| `GET /api/health` | Liveness check + data paths |
| `GET/PUT /api/settings` | Officer profile, theme |
| `GET/POST /api/sites`, `PUT/DELETE /api/sites/:id` | Manage sites & patrol plans |
| `GET/POST /api/llm-profiles`, `POST /api/llm-profiles/:id/test` | Manage & test AI profiles |
| `GET/POST /api/shifts`, `POST /api/shifts/active` | Shift list & active shift |
| `POST /api/shifts/:id/end` | End the shift |
| `POST /api/shifts/:id/patrols/:slot/start` / `.../complete` | Run a patrol round |
| `POST /api/incidents`, `GET /api/incidents` | Log & list incidents |
| `POST /api/uploads` (multipart) | Photo / voice-memo upload → `/uploads/...` |
| `POST /api/reports/dar`, `POST /api/reports/incident` | Generate AI reports |
| `GET /api/reports`, `DELETE /api/reports/:id` | List & delete reports |

Reports are instructed to use only the facts recorded in the app — no invented events.

## CI / Release

Pushing to `main` triggers `.github/workflows/docker-publish.yml`, which builds the
multi-stage Docker image and publishes it to GitHub Container Registry as
`ghcr.io/omgitsyasir/patrolguard:latest` (plus a commit-SHA tag). Compose files can
then pull the published image instead of building locally.

## License

Internal / private use.
