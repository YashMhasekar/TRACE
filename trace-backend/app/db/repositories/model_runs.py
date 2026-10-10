"""
db/repositories/model_runs.py
Async MongoDB repository for TRACE model run records.

A model_run document captures provenance for every expected-generation
model execution so that any analysis result can be traced back to the
exact model version, training period, and validation metrics used.
"""

from datetime import datetime, timezone
from typing import Optional

from app.core import database

COLLECTION = "model_runs"


def get_db():
    """Get the database connection."""
    return database.db


async def upsert_model_run(run: dict) -> dict:
    """
    Insert or update a model run document keyed on model_run_id.
    Returns the saved document.
    """
    col = get_db()[COLLECTION]
    run.setdefault("created_at", datetime.now(timezone.utc))

    await col.update_one(
        {"model_run_id": run["model_run_id"]},
        {"$set": run, "$setOnInsert": {"created_at": run["created_at"]}},
        upsert=True,
    )
    doc = await col.find_one({"model_run_id": run["model_run_id"]})
    if doc:
        doc["_id"] = str(doc["_id"])
        if isinstance(doc.get("created_at"), datetime):
            doc["created_at"] = doc["created_at"].isoformat()
    return doc or run


async def get_latest_model_run(plant_id: str = "PLANT-001") -> Optional[dict]:
    """Return the most recent model run for a plant."""
    col = get_db()[COLLECTION]
    doc = await col.find_one(
        {"plant_id": plant_id},
        sort=[("created_at", -1)],
    )
    if not doc:
        return None
    doc["_id"] = str(doc["_id"])
    if isinstance(doc.get("created_at"), datetime):
        doc["created_at"] = doc["created_at"].isoformat()
    return doc


async def list_model_runs(plant_id: str = "PLANT-001", limit: int = 10) -> list:
    """List recent model runs for a plant, newest first."""
    col = get_db()[COLLECTION]
    results = []
    async for doc in col.find({"plant_id": plant_id}).sort("created_at", -1).limit(limit):
        doc["_id"] = str(doc["_id"])
        if isinstance(doc.get("created_at"), datetime):
            doc["created_at"] = doc["created_at"].isoformat()
        results.append(doc)
    return results
