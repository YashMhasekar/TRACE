"""
routers/analysis.py
GET /api/analysis                — list all analysis results (from MongoDB)
GET /api/analysis/latest         — get the most recent analysis result
GET /api/analysis/{analysis_id}  — get a specific analysis by analysis_id
"""

from fastapi import APIRouter, HTTPException, Query
from app.db.repositories.analysis_results import (
    get_latest_analysis,
    get_analysis_by_id,
    list_analyses,
)

router = APIRouter(prefix="/api/analysis", tags=["Analysis Results"])


@router.get("")
async def get_analyses(
    plant_id: str = Query("PLANT-001", description="Plant ID to filter by"),
    limit: int = Query(10, ge=1, le=100, description="Max number of results"),
):
    """
    Return all canonical TRACE analysis results for a plant.
    Each analysis contains:
      - performance (expected, actual, gap)
      - attribution (evidence-weighted loss categories)
      - recoverability (controllable/recoverable loss breakdown)
      - recurrence (pattern identification)
      - commercial impact (revenue calculations)
      - recommendations (prioritized actions)
    """
    analyses = await list_analyses(plant_id=plant_id, limit=limit)
    return {"analyses": analyses, "total": len(analyses)}


@router.get("/latest")
async def get_latest_analysis_result(
    plant_id: str = Query("PLANT-001", description="Plant ID"),
):
    """
    Return the most recent TRACE analysis for a plant.
    This is the primary endpoint for dashboard consumption.
    """
    analysis = await get_latest_analysis(plant_id=plant_id)
    if not analysis:
        raise HTTPException(
            status_code=404,
            detail=f"No analysis results found for plant {plant_id}",
        )
    return analysis


@router.get("/{analysis_id}")
async def get_analysis_by_identifier(analysis_id: str):
    """
    Return a specific analysis by analysis_id.
    Provides full TRACE result including all subsystems.
    """
    analysis = await get_analysis_by_id(analysis_id)
    if not analysis:
        raise HTTPException(
            status_code=404,
            detail=f"Analysis {analysis_id} not found",
        )
    return analysis
