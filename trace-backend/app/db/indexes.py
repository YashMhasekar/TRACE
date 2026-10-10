"""
db/indexes.py
Creates MongoDB indexes for all TRACE collections.
Called once at application startup — idempotent.
"""

import logging
from app.core import database

logger = logging.getLogger(__name__)


async def create_indexes() -> None:
    """Create all required indexes. Safe to call multiple times."""
    try:
        db = database.db
        if db is None:
            logger.warning("Database not initialized, skipping index creation")
            return

        # ── plants ────────────────────────────────────────────────────────
        await db["plants"].create_index([("plant_id", 1)], unique=True)

        # ── simulations ───────────────────────────────────────────────────
        await db["simulations"].create_index(
            [("plant_id", 1), ("created_at", -1)]
        )
        await db["simulations"].create_index(
            [("simulation_id", 1)], unique=True
        )

        # ── model_runs ────────────────────────────────────────────────────
        await db["model_runs"].create_index(
            [("plant_id", 1), ("created_at", -1)]
        )
        await db["model_runs"].create_index(
            [("model_run_id", 1)], unique=True
        )

        # ── analysis_results ──────────────────────────────────────────────
        # Unique per plant + period + model_version so re-runs upsert cleanly
        await db["analysis_results"].create_index(
            [("plant_id", 1), ("period", 1), ("model_version", 1)],
            unique=True,
        )
        await db["analysis_results"].create_index(
            [("plant_id", 1), ("created_at", -1)]
        )
        await db["analysis_results"].create_index(
            [("analysis_id", 1)], unique=True
        )

        # ── assets ────────────────────────────────────────────────────────
        await db["assets"].create_index([("plant_id", 1)])
        await db["assets"].create_index([("asset_id", 1)], unique=True)

        # ── analysis_runs (model runner pipeline) ─────────────────────────
        await db["analysis_runs"].create_index([("analysis_id", 1)], unique=True)
        await db["analysis_runs"].create_index([("created_at", -1)])
        await db["analysis_runs"].create_index([("status", 1)])

        logger.info("MongoDB indexes created/verified for all collections.")
    except Exception as exc:
        logger.warning(f"Index creation warning (non-fatal): {exc}")
