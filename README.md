# TRACE — Performance Attribution & Recovery Intelligence

> **Why did we miss our generation target — and what can we do about it?**

TRACE is an AI-powered solar performance attribution platform for solar asset managers. It ingests real PV telemetry, builds an expected-generation model, attributes performance gaps to evidence-weighted categories, quantifies recovery potential, and delivers actionable financial intelligence — all through an interactive dashboard backed by a live AI Investigator.

---

## Problem & Solution

Solar plants routinely underperform against their expected generation targets. Identifying the root cause is slow, manual, and imprecise. TRACE automates the investigation:

1. **Expected generation** — a GradientBoosting model trained on a reference period predicts what the plant *should* have generated under observed conditions.
2. **Attribution** — every performance gap interval is classified into evidence-weighted categories: Equipment/Conversion Loss, Environmental, Data Quality, or Unexplained.
3. **Recurrence** — episodes are clustered to distinguish isolated faults from structural patterns.
4. **Recovery** — controllable losses are quantified conservatively; commercial revenue impact is calculated using configurable tariff assumptions.
5. **AI Investigator** — a Groq-powered conversational assistant answers natural-language questions grounded in the actual TRACE analysis data.

---

## Main Features

| Feature | Description |
|---|---|
| Overview dashboard | Plant KPIs, generation gap, recovery potential |
| Attribution waterfall | Evidence-weighted breakdown by loss category |
| Episode timeline | Grouped performance-gap episodes with confidence levels |
| Evidence chain | Signal-level DC / AC / POA evidence per episode |
| Recurrence analysis | Isolated → Repeated → Potentially Structural classification |
| Recovery simulator | Interactive scenario modelling of recovery actions |
| Commercial impact | Revenue gap and recovery opportunity at configurable tariffs |
| Impact tree | Hierarchical visualisation of loss propagation |
| AI Investigator | Streaming Groq-powered chat grounded in TRACE data |
| Model Runner | Upload any PV CSV dataset and run the full pipeline in-browser |

---

## Technology Stack

### Frontend
- React 19 + Vite 8
- Tailwind CSS v4 · shadcn/ui (base-nova, JavaScript mode)
- React Router v6 · TanStack Query v5
- Apache ECharts · React Flow (`@xyflow/react`)
- Firebase Authentication (Email/Password + Google)

### Backend
- FastAPI · Python 3.11 · Uvicorn
- PyMongo Async → MongoDB Atlas
- Firebase Admin SDK (ID-token verification)
- scikit-learn (`GradientBoostingRegressor`) · pandas · joblib
- Groq Python SDK (AI Investigator)
- python-multipart (CSV file uploads)

### Data
- Source: NREL PVDAQ System 1430 — January–February 2017, 15-minute intervals
- 11 processed CSV outputs + 1 trained `.joblib` model (committed in `trace-backend/data/processed/`)

---

## Architecture

```
Firebase Auth (browser)
        │  ID token (JWT)
        ▼
React + Vite SPA  ──HTTPS──►  FastAPI (Uvicorn)
                                  │
                    ┌─────────────┼──────────────────┐
                    ▼             ▼                  ▼
             data/processed/  MongoDB Atlas     Groq API
             (CSVs + model)   (plants, sims,   (AI Investigator)
                               model runs)
```

The backend loads all processed CSV files once at startup into memory (`app/core/data_loader.py`). All 18 routers read from those in-memory DataFrames. MongoDB is used only for mutable state: plant metadata, simulation history, model run provenance, and the Model Runner analysis pipeline.

---

## Repository Structure

```
Trace/
├── .gitignore                       # Root gitignore (covers entire monorepo)
├── README.md
├── ARCHITECTURE.md
│
├── data/
│   ├── processed/                   # Source-of-truth processed data (pipeline outputs)
│   └── pvdaq_raw/                   # Raw PVDAQ CSVs — excluded from git
│
├── trace-frontend/                  # React + Vite SPA
│   ├── src/
│   │   ├── api/                     # Per-feature API clients
│   │   ├── components/              # UI components (shadcn/ui + custom)
│   │   ├── contexts/                # AuthContext, PlantContext, ThemeContext
│   │   ├── hooks/
│   │   ├── lib/
│   │   │   ├── api.js               # Base fetch client (reads VITE_API_BASE_URL)
│   │   │   └── firebase.js          # Firebase SDK init
│   │   └── pages/                   # Route-level page components
│   ├── public/
│   ├── .env.example
│   ├── package.json
│   └── vite.config.js
│
└── trace-backend/                   # FastAPI application
    ├── app/
    │   ├── core/
    │   │   ├── data_loader.py       # Loads CSVs + model at startup
    │   │   ├── database.py          # MongoDB Atlas connection
    │   │   ├── firebase.py          # Firebase Admin SDK init + token verification
    │   │   └── serialization.py
    │   ├── db/repositories/         # MongoDB repository layer
    │   ├── routers/                 # 18 FastAPI routers
    │   └── services/
    │       ├── analysis_pipeline.py # Full ML pipeline (Model Runner)
    │       ├── grok_client.py       # Groq AI client
    │       └── model_simulator.py   # Background execution simulator
    ├── data/
    │   └── processed/               # CSVs + model bundled for deployment
    ├── requirements.txt
    └── .env.example
```

---

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | 20 LTS or 22 LTS |
| npm | 10+ (bundled with Node) |
| Python | 3.11 |
| pip / venv | standard library |
| MongoDB Atlas | Free M0 cluster or higher |
| Firebase project | Authentication enabled (Email/Password + Google) |

---

## Local Setup — Frontend

```powershell
cd trace-frontend

# 1. Install dependencies
npm install

# 2. Create your local environment file
Copy-Item .env.example .env
# Edit .env — fill in VITE_FIREBASE_* values from Firebase Console

# 3. Start the development server (http://localhost:5173)
npm run dev

# 4. Production build (output → dist/)
npm run build
```

---

## Local Setup — Backend

```powershell
cd trace-backend

# 1. Create and activate a virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# 2. Install dependencies
pip install -r requirements.txt

# 3. Create your local environment file
Copy-Item .env.example .env
# Edit .env — fill in MONGODB_URI, FIREBASE_SERVICE_ACCOUNT_PATH, GROQ_API_KEY

# 4. Start the development server (http://localhost:8000)
uvicorn app.main:app --reload

# 5. Open the interactive API docs
# http://localhost:8000/docs
```

> **Data:** The backend reads from `trace-backend/data/processed/` at startup.
> These files are committed to the repository — no separate pipeline run is needed for local development.

---

## Environment Variables

### Frontend — `trace-frontend/.env`

| Variable | Required | Description |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | Yes | Firebase web SDK API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Yes | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Yes | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Yes | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Yes | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Yes | Firebase app ID |
| `VITE_API_BASE_URL` | No | Backend URL; defaults to `http://localhost:8000` |

All `VITE_FIREBASE_*` values are **public client identifiers** — they are embedded in the browser bundle by design. They are not server secrets.

### Backend — `trace-backend/.env`

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | Yes | MongoDB Atlas connection string |
| `MONGODB_DATABASE` | Yes | Database name (e.g. `trace_db`) |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Strategy A | Path to service-account JSON (local dev) |
| `FIREBASE_PROJECT_ID` | Strategy B | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Strategy B | Service account client email |
| `FIREBASE_PRIVATE_KEY` | Strategy B | Service account RSA private key (single line, `\n` escaped) |
| `ALLOWED_ORIGINS` | Production | Comma-separated frontend URLs (e.g. `https://trace.netlify.app`) |
| `GROQ_API_KEY` | Yes* | Groq API key — AI Investigator returns a stub without it |
| `GROQ_MODEL` | No | Groq model override (default: `openai/gpt-oss-120b`) |

**Firebase credential strategies** (use one):
- **Strategy A** — set `FIREBASE_SERVICE_ACCOUNT_PATH` to a local path. Recommended for local dev.
- **Strategy B** — set `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`. Required for cloud hosting (no filesystem access to JSON files).

---

## Authentication Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com).
2. Enable **Authentication** → Sign-in methods → **Email/Password** and **Google**.
3. Register a **Web app** to obtain the `VITE_FIREBASE_*` client config values.
4. Download a **service account JSON** (Project Settings → Service Accounts) for the backend.
5. After deploying the frontend, add your production domain to **Authentication → Settings → Authorized domains**.

---

## Database Setup

1. Create a free [MongoDB Atlas](https://www.mongodb.com/atlas) M0 cluster.
2. Create a database user with read/write access.
3. Add your server IP (or `0.0.0.0/0` for any IP) to the Network Access list.
4. Copy the connection string into `MONGODB_URI`.

The backend creates required indexes and seeds a demo plant record automatically on first startup.

---

## Deployment

### Recommended: Netlify (frontend) + Render (backend)

#### Frontend — Netlify

1. Push this repository to GitHub.
2. New site → Import from Git.
3. Build settings:
   - **Base directory:** `trace-frontend`
   - **Build command:** `npm run build`
   - **Publish directory:** `trace-frontend/dist`
   - **Node version:** 20
4. Set all `VITE_FIREBASE_*` environment variables in Site → Environment variables.
5. Set `VITE_API_BASE_URL` to your Render backend URL after it is deployed.
6. The file `trace-frontend/public/_redirects` handles SPA routing rewrites.

#### Backend — Render

1. New Web Service → Connect repository.
2. Settings:
   - **Root directory:** `trace-backend`
   - **Runtime:** Python 3.11
   - **Build command:** `pip install -r requirements.txt`
   - **Start command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
3. Set all backend environment variables (Strategy B Firebase credentials, `MONGODB_URI`, `GROQ_API_KEY`, `ALLOWED_ORIGINS`).
4. **Health check path:** `/health`

> The free Render tier sleeps after 15 minutes of inactivity. The first request after sleep takes ~30 seconds. Wake the URL before a demo.

---

## Health Endpoint

```
GET /health
```

Returns `200 {"status": "ok", "mongodb": "connected"}` when the backend is running and MongoDB is reachable.
Returns `503 {"status": "degraded", "mongodb": "unreachable"}` if the database connection fails.

---

## Limitations

- **Solar-specific prototype.** The current model and attribution logic are calibrated for a single commercial PV system (NREL PVDAQ System 1430). The Model Runner supports uploading arbitrary PV CSV datasets and runs the same pipeline dynamically.
- **Evidence-weighted attribution, not proven causality.** TRACE classifies performance gaps using observable signal patterns. A category assignment indicates supporting evidence, not a confirmed physical root cause.
- **Synthetic commercial assumptions.** Revenue calculations use a placeholder tariff (`$0.055/kWh`) and settlement factor (`0.97`). These must be replaced with actual contract values before using financial figures for real decisions.
- **Reference-period baseline.** The expected-generation model trains on the first month of data as the reference period. This is a relative baseline, not an independently verified "healthy" baseline.
- **Conservative recoverability.** Recovery estimates apply a 60% recovery factor as a conservative default. Actual recoverability depends on maintenance records, root-cause confirmation, and site conditions not available in telemetry alone.
- **No multi-plant aggregation.** Each analysis run is scoped to a single plant or uploaded dataset.

---

## Security

- **Never commit `.env` files**, Firebase service-account JSON files, private keys, or database credentials.
- The root `.gitignore` excludes `.env`, `serviceAccountKey.json`, `*.json.json`, `gemini-test/`, `node_modules/`, `.venv/`, and `data/pvdaq_raw/`.
- Use Strategy B (individual environment variables) for Firebase Admin credentials in all cloud environments — never copy the service-account JSON file to a server.
- Rotate MongoDB Atlas credentials if they have been exposed in any chat, log, or unprotected file.
- Firebase web SDK config values (`VITE_FIREBASE_*`) are public client identifiers — they are safe to include in the browser bundle but should not be confused with the Firebase Admin private key, which is a backend-only secret.
