"""
services/model_simulator.py
Background service that simulates realistic model execution progress.

This service:
  - Monitors plants with active model execution
  - Advances progress through pipeline stages
  - Updates status in MongoDB
  - Simulates realistic execution timing
"""

import asyncio
import random
from datetime import datetime, timezone, timedelta
from app.core import database


# Model execution stages with realistic durations
EXECUTION_STAGES = [
    {"name": "initializing", "progress": 5, "message": "Initializing model pipeline", "duration_range": (1, 3)},
    {"name": "loading_data", "progress": 15, "message": "Loading historical data", "duration_range": (2, 5)},
    {"name": "preprocessing", "progress": 30, "message": "Preprocessing sensor data", "duration_range": (3, 6)},
    {"name": "feature_engineering", "progress": 45, "message": "Engineering features", "duration_range": (3, 5)},
    {"name": "training", "progress": 60, "message": "Training expected generation model", "duration_range": (5, 10)},
    {"name": "validating", "progress": 75, "message": "Validating on holdout period", "duration_range": (2, 4)},
    {"name": "analyzing", "progress": 85, "message": "Running attribution engine", "duration_range": (3, 6)},
    {"name": "finalizing", "progress": 95, "message": "Finalizing results", "duration_range": (1, 3)},
    {"name": "completed", "progress": 100, "message": "Analysis complete", "duration_range": (0, 0)},
]


async def advance_plant_progress(plant_id: str) -> bool:
    """
    Advance a plant's model execution to the next stage.
    Returns True if advanced, False if already completed or error.
    """
    db = database.db
    if db is None:
        return False

    col = db["plants"]
    plant = await col.find_one({"plant_id": plant_id})

    if not plant:
        return False

    current_status = plant.get("model_status", "idle")
    current_progress = plant.get("model_progress", 0)

    # Don't advance if idle, completed, or error
    if current_status in ["idle", "completed", "error"]:
        return False

    # Find next stage
    next_stage = None
    for stage in EXECUTION_STAGES:
        if stage["progress"] > current_progress:
            next_stage = stage
            break

    if not next_stage:
        # Already at final stage
        return False

    # Update to next stage
    update_doc = {
        "model_status": next_stage["name"],
        "model_progress": next_stage["progress"],
        "model_message": next_stage["message"],
    }

    # If completed, update last_analysis_run
    if next_stage["name"] == "completed":
        update_doc["last_analysis_run"] = datetime.now(timezone.utc).isoformat()
        update_doc["next_scheduled_run"] = (
            datetime.now(timezone.utc) + timedelta(hours=random.randint(12, 48))
        ).isoformat()

    await col.update_one(
        {"plant_id": plant_id},
        {"$set": update_doc}
    )

    return True


async def simulate_model_execution():
    """
    Background task that simulates model execution for all active plants.
    Runs continuously and advances progress at realistic intervals.
    """
    print("[MODEL SIMULATOR] Starting background simulation service...")

    while True:
        try:
            db = database.db
            if db is None:
                await asyncio.sleep(5)
                continue

            col = db["plants"]

            # Find all plants with active execution
            active_plants = []
            async for plant in col.find({
                "model_status": {
                    "$nin": ["idle", "completed", "error"]
                }
            }):
                active_plants.append(plant)

            if active_plants:
                print(f"[MODEL SIMULATOR] Processing {len(active_plants)} active plants...")

            # Advance each active plant
            for plant in active_plants:
                plant_id = plant["plant_id"]
                current_status = plant.get("model_status", "idle")

                # Find current stage
                current_stage = None
                for stage in EXECUTION_STAGES:
                    if stage["name"] == current_status:
                        current_stage = stage
                        break

                if current_stage:
                    # Wait for stage duration before advancing
                    min_dur, max_dur = current_stage["duration_range"]
                    if min_dur > 0:
                        wait_time = random.uniform(min_dur, max_dur)
                        await asyncio.sleep(wait_time)

                    # Advance to next stage
                    advanced = await advance_plant_progress(plant_id)
                    if advanced:
                        new_plant = await col.find_one({"plant_id": plant_id})
                        new_status = new_plant.get("model_status", "unknown")
                        print(f"[MODEL SIMULATOR] {plant_id} advanced to {new_status}")

            # If no active plants, wait longer before checking again
            if not active_plants:
                await asyncio.sleep(10)
            else:
                await asyncio.sleep(2)

        except Exception as e:
            print(f"[MODEL SIMULATOR] Error: {e}")
            await asyncio.sleep(5)


# Startup function to be called from main.py lifespan
async def start_model_simulator():
    """Start the background model simulator task."""
    asyncio.create_task(simulate_model_execution())
