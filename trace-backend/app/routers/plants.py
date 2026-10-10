"""
routers/plants.py
GET /api/plants        — list all plants (from MongoDB)
GET /api/plants/{id}   — get a single plant by plant_id
"""

from fastapi import APIRouter, HTTPException
from app.db.repositories.plants import get_plant, list_plants

router = APIRouter(prefix="/api", tags=["Plants"])


@router.get("/plants")
async def get_plants():
    """Return all plants stored in MongoDB (seeded at startup)."""
    plants = await list_plants()
    return {"plants": plants, "total": len(plants)}


@router.get("/plants/{plant_id}")
async def get_plant_by_id(plant_id: str):
    """Return a single plant by plant_id."""
    plant = await get_plant(plant_id)
    if not plant:
        raise HTTPException(status_code=404, detail=f"Plant {plant_id} not found")
    return plant
