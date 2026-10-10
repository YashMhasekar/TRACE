"""
db/repositories/simulations.py
Async MongoDB repository for simulation results.

Every call to POST /api/simulation/simulate is persisted here so the
analyst can retrieve past simulations and compare scenarios.
"""

from datetime import datetime, timezone
from typing import Optional
import uuid

from app.core import database


COLLECTION = "simulations"


def get_db():
    """Get the database connection."""
    return database.db


async def save_simulation(simulation: dict) -> dict:
    """
    Persist a simulation result document.
    Returns the saved document (with _id as string for JSON serialisation).
    """
    doc = {
        "simulation_id":         simulation.get("simulation_id", f"SIM-{uuid.uuid4().hex[:8].upper()}"),
        "plant_id":              simulation.get("plant_id", "PLANT-001"),
        "period":                simulation.get("period", "2017-01_02"),
        "cause_id":              simulation.get("causeId", ""),
        "cause_label":           simulation.get("cause", ""),
        "improvement_pct":       float(simulation.get("improvementPct", 0.0)),
        "current_loss_gwh":      float(simulation.get("currentLossGwh", 0.0)),
        "max_recoverable_gwh":   float(simulation.get("maxRecoverableGwh", 0.0)),
        "recovered_gwh":         float(simulation.get("recoveredGwh", 0.0)),
        "recovered_revenue_usd": simulation.get("recoveredRevenue"),
        "is_estimate":           bool(simulation.get("isEstimate", True)),
        "status":                "estimated",
        "assumptions": [
            "Recovery proportional to improvement level applied to max recoverable potential.",
            "Revenue calculated using TRACE tariff and settlement factor assumptions.",
            "Actual recovery depends on operational execution and conditions.",
        ],
        "created_at": datetime.now(timezone.utc),
    }

    col = get_db()[COLLECTION]
    result = await col.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    doc["created_at"] = doc["created_at"].isoformat()
    return doc


async def get_simulation(simulation_id: str) -> Optional[dict]:
    """Fetch a single simulation by simulation_id."""
    col = get_db()[COLLECTION]
    doc = await col.find_one({"simulation_id": simulation_id})
    if not doc:
        return None
    doc["_id"] = str(doc["_id"])
    if isinstance(doc.get("created_at"), datetime):
        doc["created_at"] = doc["created_at"].isoformat()
    return doc


async def list_simulations(plant_id: str = "PLANT-001", limit: int = 20) -> list:
    """List recent simulations for a plant, newest first."""
    col = get_db()[COLLECTION]
    cursor = col.find({"plant_id": plant_id}).sort("created_at", -1).limit(limit)
    results = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        if isinstance(doc.get("created_at"), datetime):
            doc["created_at"] = doc["created_at"].isoformat()
        results.append(doc)
    return results
