"""
routers/model_status.py
GET /api/model-status              — get current model execution status for all plants
GET /api/model-status/{plant_id}   — get model status for specific plant
POST /api/model-status/{plant_id}/trigger — manually trigger model execution
"""

import random
from fastapi import APIRouter, HTTPException
from app.core import database

router = APIRouter(prefix="/api/model-status", tags=["Model Status"])


def get_db():
    """Get the database connection."""
    return database.db


@router.get("")
async def get_all_model_statuses():
    """
    Return model execution status for all plants.
    Shows real-time progress of ML pipeline execution.
    """
    db = get_db()
    col = db["plants"]

    plants = []
    async for doc in col.find({}):
        plants.append({
            "plant_id": doc["plant_id"],
            "name": doc["name"],
            "status": doc.get("model_status", "idle"),
            "progress": doc.get("model_progress", 0),
            "message": doc.get("model_message", "No status"),
            "last_run": doc.get("last_analysis_run"),
            "next_run": doc.get("next_scheduled_run"),
        })

    return {
        "total_plants": len(plants),
        "statuses": plants,
    }


@router.get("/{plant_id}")
async def get_plant_model_status(plant_id: str):
    """
    Get detailed model execution status for a specific plant.
    Includes pipeline stage breakdown and estimated completion time.
    """
    db = get_db()
    col = db["plants"]

    plant = await col.find_one({"plant_id": plant_id})
    if not plant:
        raise HTTPException(status_code=404, detail=f"Plant {plant_id} not found")

    status = plant.get("model_status", "idle")
    progress = plant.get("model_progress", 0)

    # Pipeline stages
    stages = [
        {"name": "Data Loading", "progress": min(progress, 15), "status": "completed" if progress > 15 else "in_progress" if progress > 5 else "pending"},
        {"name": "Preprocessing", "progress": min(max(progress - 15, 0), 15), "status": "completed" if progress > 30 else "in_progress" if progress > 15 else "pending"},
        {"name": "Feature Engineering", "progress": min(max(progress - 30, 0), 15), "status": "completed" if progress > 45 else "in_progress" if progress > 30 else "pending"},
        {"name": "Model Training", "progress": min(max(progress - 45, 0), 15), "status": "completed" if progress > 60 else "in_progress" if progress > 45 else "pending"},
        {"name": "Validation", "progress": min(max(progress - 60, 0), 15), "status": "completed" if progress > 75 else "in_progress" if progress > 60 else "pending"},
        {"name": "Attribution Analysis", "progress": min(max(progress - 75, 0), 10), "status": "completed" if progress > 85 else "in_progress" if progress > 75 else "pending"},
        {"name": "Finalizing", "progress": min(max(progress - 85, 0), 15), "status": "completed" if progress >= 100 else "in_progress" if progress > 85 else "pending"},
    ]

    # Estimated time remaining (in seconds)
    if progress < 100 and status not in ["idle", "error"]:
        remaining_pct = 100 - progress
        estimated_seconds = int(remaining_pct * random.uniform(2, 4))  # ~2-4 sec per %
    else:
        estimated_seconds = 0

    return {
        "plant_id": plant_id,
        "plant_name": plant["name"],
        "status": status,
        "progress": progress,
        "message": plant.get("model_message", "No status"),
        "stages": stages,
        "estimated_time_remaining_seconds": estimated_seconds,
        "last_analysis_run": plant.get("last_analysis_run"),
        "next_scheduled_run": plant.get("next_scheduled_run"),
        "performance_rating": plant.get("performance_rating", "unknown"),
        "data_quality_score": plant.get("data_quality_score", 0),
    }


@router.post("/{plant_id}/trigger")
async def trigger_model_execution(plant_id: str):
    """
    Manually trigger model execution for a plant.
    This starts the ML pipeline and returns immediately.
    Use GET /api/model-status/{plant_id} to poll progress.
    """
    db = get_db()
    col = db["plants"]

    plant = await col.find_one({"plant_id": plant_id})
    if not plant:
        raise HTTPException(status_code=404, detail=f"Plant {plant_id} not found")

    current_status = plant.get("model_status", "idle")

    # Don't allow trigger if already running
    if current_status not in ["idle", "completed", "error"]:
        raise HTTPException(
            status_code=409,
            detail=f"Model execution already in progress (status: {current_status})"
        )

    # Start execution
    await col.update_one(
        {"plant_id": plant_id},
        {
            "$set": {
                "model_status": "initializing",
                "model_progress": 5,
                "model_message": "Initializing model pipeline",
            }
        }
    )

    return {
        "plant_id": plant_id,
        "message": "Model execution triggered",
        "status": "initializing",
        "progress": 5,
    }
