"""
db/repositories/analysis_results.py
Async MongoDB repository for TRACE canonical analysis results.

One analysis_result document per (plant_id, period, model_version) stores
the full TRACE output so that:
  - The frontend gets consistent results after a page refresh
  - Each result is traceable to its model_run_id
  - Reconciliation numbers are persisted alongside the analysis
"""

from datetime import datetime, timezone
from typing import Optional
import uuid

from app.core import database

COLLECTION = "analysis_results"


def get_db():
    """Get the database connection."""
    return database.db


async def upsert_analysis(analysis: dict) -> dict:
    """
    Insert or replace an analysis result document.
    Keyed on (plant_id, period, model_version) — idempotent re-runs.
    Returns the saved document.
    """
    col = get_db()[COLLECTION]
    analysis.setdefault(
        "analysis_id",
        f"ANALYSIS-{uuid.uuid4().hex[:8].upper()}",
    )
    analysis.setdefault("created_at", datetime.now(timezone.utc))

    filter_key = {
        "plant_id":      analysis["plant_id"],
        "period":        analysis["period"],
        "model_version": analysis.get("model_version", "1.1.0"),
    }

    await col.update_one(
        filter_key,
        {
            "$set": {**analysis, "updated_at": datetime.now(timezone.utc)},
            "$setOnInsert": {"created_at": analysis["created_at"]},
        },
        upsert=True,
    )

    doc = await col.find_one(filter_key)
    if doc:
        doc["_id"] = str(doc["_id"])
        for ts_field in ("created_at", "updated_at"):
            if isinstance(doc.get(ts_field), datetime):
                doc[ts_field] = doc[ts_field].isoformat()
    return doc or analysis


async def get_latest_analysis(plant_id: str = "PLANT-001") -> Optional[dict]:
    """Return the most recently created analysis for a plant."""
    col = get_db()[COLLECTION]
    doc = await col.find_one(
        {"plant_id": plant_id},
        sort=[("created_at", -1)],
    )
    if not doc:
        return None
    doc["_id"] = str(doc["_id"])
    for ts_field in ("created_at", "updated_at"):
        if isinstance(doc.get(ts_field), datetime):
            doc[ts_field] = doc[ts_field].isoformat()
    return doc


async def get_analysis_by_id(analysis_id: str) -> Optional[dict]:
    """Fetch a single analysis document by analysis_id."""
    col = get_db()[COLLECTION]
    doc = await col.find_one({"analysis_id": analysis_id})
    if not doc:
        return None
    doc["_id"] = str(doc["_id"])
    for ts_field in ("created_at", "updated_at"):
        if isinstance(doc.get(ts_field), datetime):
            doc[ts_field] = doc[ts_field].isoformat()
    return doc


async def list_analyses(plant_id: str = "PLANT-001", limit: int = 10) -> list:
    """List analyses for a plant, newest first."""
    col = get_db()[COLLECTION]
    results = []
    async for doc in col.find({"plant_id": plant_id}).sort("created_at", -1).limit(limit):
        doc["_id"] = str(doc["_id"])
        for ts_field in ("created_at", "updated_at"):
            if isinstance(doc.get(ts_field), datetime):
                doc[ts_field] = doc[ts_field].isoformat()
        results.append(doc)
    return results
