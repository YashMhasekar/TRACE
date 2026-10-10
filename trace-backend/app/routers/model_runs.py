"""
routers/model_runs.py
GET /api/model-runs              — list all model runs (from MongoDB)
GET /api/model-runs/latest       — get the most recent model run
GET /api/model-runs/{run_id}     — get a specific model run by model_run_id
"""

from fastapi import APIRouter, HTTPException, Query
from app.db.repositories.model_runs import (
    get_latest_model_run,
    list_model_runs,
)

router = APIRouter(prefix="/api/model-runs", tags=["Model Runs"])


@router.get("")
async def get_model_runs(
    plant_id: str = Query("PLANT-001", description="Plant ID to filter by"),
    limit: int = Query(10, ge=1, le=100, description="Max number of results"),
):
    """
    Return all model runs for a plant, sorted by most recent first.
    Each model run captures provenance: training period, features, metrics.
    """
    runs = await list_model_runs(plant_id=plant_id, limit=limit)
    return {"model_runs": runs, "total": len(runs)}


@router.get("/latest")
async def get_latest_run(
    plant_id: str = Query("PLANT-001", description="Plant ID"),
):
    """
    Return the most recent model run for a plant.
    Useful for displaying current model version and validation metrics.
    """
    run = await get_latest_model_run(plant_id=plant_id)
    if not run:
        raise HTTPException(
            status_code=404,
            detail=f"No model runs found for plant {plant_id}",
        )
    return run


@router.get("/{model_run_id}")
async def get_model_run_by_id(model_run_id: str):
    """
    Return a specific model run by model_run_id.
    Provides full provenance including features, parameters, and metrics.
    """
    from app.core import database
    col = database.db["model_runs"]
    doc = await col.find_one({"model_run_id": model_run_id})
    if not doc:
        raise HTTPException(
            status_code=404,
            detail=f"Model run {model_run_id} not found",
        )
    doc["_id"] = str(doc["_id"])
    if hasattr(doc.get("created_at"), "isoformat"):
        doc["created_at"] = doc["created_at"].isoformat()
    return doc
