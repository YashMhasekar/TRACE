"""
db/repositories/plants.py
MongoDB repository for plant metadata.
Seeds the demo plant on first use (idempotent).
"""

from datetime import datetime, timezone
from typing import Optional

from app.core import database

COLLECTION = "plants"

DEMO_PLANT = {
    "plant_id":    "PLANT-001",
    "name":        "Solar Plant Alpha (PVDAQ 1430)",
    "capacity_kw": 720.72,
    "location":    "Colorado, USA",
    "timezone":    "America/Denver",
    "asset_count": 12,
    "status":      "active",
    "data_source": "PVDAQ System 1430 — Jan/Feb 2017",
    "label":       "DEMO / SEEDED",
    "created_at":  datetime.now(timezone.utc),
    "updated_at":  datetime.now(timezone.utc),
}


def get_db():
    """Get the database connection."""
    return database.db


async def seed_plant_if_missing() -> None:
    """Insert the demo plant if it does not already exist (idempotent)."""
    db = get_db()
    if db is None:
        return
    col = db[COLLECTION]
    existing = await col.find_one({"plant_id": DEMO_PLANT["plant_id"]})
    if not existing:
        await col.insert_one(DEMO_PLANT.copy())


async def get_plant(plant_id: str) -> Optional[dict]:
    col = get_db()[COLLECTION]
    doc = await col.find_one({"plant_id": plant_id})
    if not doc:
        return None
    doc["_id"] = str(doc["_id"])
    if isinstance(doc.get("created_at"), datetime):
        doc["created_at"] = doc["created_at"].isoformat()
    if isinstance(doc.get("updated_at"), datetime):
        doc["updated_at"] = doc["updated_at"].isoformat()
    return doc


async def list_plants() -> list:
    col = get_db()[COLLECTION]
    results = []
    async for doc in col.find({}):
        doc["_id"] = str(doc["_id"])
        if isinstance(doc.get("created_at"), datetime):
            doc["created_at"] = doc["created_at"].isoformat()
        if isinstance(doc.get("updated_at"), datetime):
            doc["updated_at"] = doc["updated_at"].isoformat()
        results.append(doc)
    return results
