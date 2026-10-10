"""
routers/simulations.py
GET  /api/simulations                 — list all simulations for a plant
GET  /api/simulations/{simulation_id} — get a specific simulation result
"""

from fastapi import APIRouter, HTTPException
from app.db.repositories.simulations import get_simulation, list_simulations

router = APIRouter(prefix="/api", tags=["Simulations"])


@router.get("/simulations")
async def get_simulations(plant_id: str = "PLANT-001", limit: int = 20):
    """
    List simulation history for a plant (newest first).
    Results come from MongoDB — each POST /api/simulation/simulate is persisted.
    """
    results = await list_simulations(plant_id=plant_id, limit=limit)
    return {
        "simulations": results,
        "total":       len(results),
        "note":        "Each simulation result is persisted to MongoDB.",
    }


@router.get("/simulations/{simulation_id}")
async def get_simulation_by_id(simulation_id: str):
    """Retrieve a single simulation result by its simulation_id."""
    sim = await get_simulation(simulation_id)
    if not sim:
        raise HTTPException(status_code=404, detail=f"Simulation {simulation_id} not found")
    return sim
