"""
main.py — TRACE FastAPI application entry point.

Architecture:
    React + Firebase Auth  →  FastAPI  →  Processed CSVs + ML Model
                                       →  MongoDB (simulations, plants)
"""

import logging
import os
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.database import close_db, init_db, ping_db
from app.core.firebase import get_current_user
from app.db.indexes import create_indexes
from app.db.repositories.plants import seed_plant_if_missing

logger = logging.getLogger(__name__)

# ── Data routers (read from processed CSVs + ML model) ────────────────────
from app.routers import (
    overview,
    attribution,
    recurrence,
    evidence,
    commercial,
    performance,
    operations,
    recovery,
    impact_tree,
    predict,
    ai,
    model,
    plants,
    simulations,
    data_quality,
    model_runs,
    analysis,
    model_status,
    model_runner,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Connect to MongoDB
    init_db()

    # 2. Create indexes + seed demo plant (idempotent)
    try:
        await create_indexes()
        await seed_plant_if_missing()
        logger.info("MongoDB startup tasks completed.")
    except Exception as exc:
        logger.warning(f"MongoDB startup warning (non-fatal): {exc}")

    # 3. Start background model simulator
    from app.services.model_simulator import start_model_simulator
    try:
        await start_model_simulator()
        logger.info("Model execution simulator started.")
    except Exception as exc:
        logger.warning(f"Simulator startup warning (non-fatal): {exc}")

    yield
    await close_db()


app = FastAPI(
    title="TRACE API",
    description="Backend API for the TRACE performance attribution platform.",
    version="1.1.0",
    lifespan=lifespan,
)

# ── CORS ───────────────────────────────────────────────────────────────────
# Development origins are always allowed.
# In production, set ALLOWED_ORIGINS to a comma-separated list of frontend URLs,
# e.g.: ALLOWED_ORIGINS=https://trace.netlify.app,https://www.trace.netlify.app
_DEV_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:3000",
]

_extra = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]

_allowed_origins = list(dict.fromkeys(_DEV_ORIGINS + _extra))  # preserve order, deduplicate

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register data routers ──────────────────────────────────────────────────
app.include_router(overview.router)
app.include_router(attribution.router)
app.include_router(recurrence.router)
app.include_router(evidence.router)
app.include_router(commercial.router)
app.include_router(performance.router)
app.include_router(operations.router)
app.include_router(recovery.router)       # now also persists to MongoDB
app.include_router(impact_tree.router)
app.include_router(predict.router)
app.include_router(ai.router)
app.include_router(model.router)
app.include_router(plants.router)         # plant metadata from MongoDB
app.include_router(simulations.router)    # simulation history from MongoDB
app.include_router(data_quality.router)   # data quality metrics
app.include_router(model_runs.router)     # model provenance from MongoDB
app.include_router(analysis.router)       # canonical TRACE analysis results
app.include_router(model_status.router)   # model execution status & animation
app.include_router(model_runner.router)   # /model-runner upload + async pipeline


# ── General routes ─────────────────────────────────────────────────────────
@app.get("/", tags=["General"])
async def root():
    return {"message": "TRACE API is running", "docs": "/docs", "version": "1.1.0"}


@app.get("/health", tags=["General"])
async def health():
    try:
        await ping_db()
        return JSONResponse({"status": "ok", "mongodb": "connected"})
    except Exception:
        return JSONResponse(status_code=503, content={"status": "degraded", "mongodb": "unreachable"})


# ── Auth routes ────────────────────────────────────────────────────────────
@app.get("/api/auth/me", tags=["Auth"])
async def me(current_user: Annotated[dict, Depends(get_current_user)]):
    return {
        "uid":   current_user.get("uid"),
        "email": current_user.get("email"),
        "name":  current_user.get("name"),
    }
