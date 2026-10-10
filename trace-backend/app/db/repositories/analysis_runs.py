"""
db/repositories/analysis_runs.py
MongoDB CRUD for the analysis_runs collection.

Each document tracks a complete TRACE pipeline execution:
- dataset metadata
- current stage / progress
- stage-level results
- event log
- final results summary
"""

from datetime import datetime, timezone
from typing import Optional
import uuid

from app.core import database

COLLECTION = "analysis_runs"


def _db():
    return database.db


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _sanitize(obj):
    """
    Recursively convert numpy / pandas scalars to native Python types so
    that PyMongo's BSON encoder never sees numpy.bool_, numpy.int64, etc.

    Handles:
      numpy.bool_          -> bool
      numpy.integer        -> int
      numpy.floating       -> float
      numpy.ndarray        -> list (recursed)
      dict                 -> dict (recursed)
      list / tuple         -> list (recursed)
      datetime             -> left as-is (BSON-native)
      everything else      -> left as-is
    """
    try:
        import numpy as np
        if isinstance(obj, np.bool_):
            return bool(obj)
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return [_sanitize(v) for v in obj.tolist()]
    except ImportError:
        pass

    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_sanitize(v) for v in obj]
    return obj


def _serialize(doc: dict) -> dict:
    """Convert ObjectId and datetimes to JSON-safe types."""
    doc["_id"] = str(doc["_id"])
    for key in ("created_at", "updated_at", "completed_at"):
        val = doc.get(key)
        if isinstance(val, datetime):
            doc[key] = val.isoformat()
    # Serialize stage timestamps
    for stage in doc.get("stages", []):
        for ts in ("started_at", "completed_at"):
            val = stage.get(ts)
            if isinstance(val, datetime):
                stage[ts] = val.isoformat()
    # Serialize event timestamps
    for evt in doc.get("events", []):
        val = evt.get("ts")
        if isinstance(val, datetime):
            evt["ts"] = val.isoformat()
    return doc


# ── CRUD ──────────────────────────────────────────────────────────────────

async def create_run(dataset_meta: dict, config: dict) -> dict:
    """Create a new analysis run document and return it."""
    analysis_id = f"ANL-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

    doc = {
        "analysis_id":   analysis_id,
        "status":        "pending",
        "current_stage": "queued",
        "progress":      0,
        "dataset":       dataset_meta,
        "config":        config,
        "stages":        [],
        "events":        [],
        "results":       {},
        "created_at":    _now(),
        "updated_at":    _now(),
        "completed_at":  None,
    }

    await _db()[COLLECTION].insert_one(doc)
    return _serialize(doc)


async def get_run(analysis_id: str) -> Optional[dict]:
    doc = await _db()[COLLECTION].find_one({"analysis_id": analysis_id})
    if not doc:
        return None
    return _serialize(doc)


async def set_stage_running(analysis_id: str, stage_id: str, progress: int) -> None:
    await _db()[COLLECTION].update_one(
        {"analysis_id": analysis_id},
        {
            "$set": {
                "current_stage": stage_id,
                "status":        "running",
                "progress":      progress,
                "updated_at":    _now(),
            },
            "$push": {
                "stages": {
                    "stage_id":    stage_id,
                    "status":      "running",
                    "started_at":  _now(),
                    "completed_at": None,
                    "metrics":     {},
                    "warnings":    [],
                }
            },
        },
    )


async def set_stage_completed(
    analysis_id: str,
    stage_id: str,
    progress: int,
    metrics: dict,
    warnings: list[str] | None = None,
) -> None:
    safe_metrics = _sanitize(metrics)
    await _db()[COLLECTION].update_one(
        {"analysis_id": analysis_id, "stages.stage_id": stage_id},
        {
            "$set": {
                "current_stage":             stage_id,
                "progress":                  progress,
                "updated_at":                _now(),
                "stages.$.status":           "warning" if warnings else "completed",
                "stages.$.completed_at":     _now(),
                "stages.$.metrics":          safe_metrics,
                "stages.$.warnings":         warnings or [],
            }
        },
    )


async def set_stage_failed(
    analysis_id: str,
    stage_id: str,
    reason: str,
    detail: str = "",
) -> None:
    safe_metrics = _sanitize({"error": reason, "detail": detail})
    await _db()[COLLECTION].update_one(
        {"analysis_id": analysis_id, "stages.stage_id": stage_id},
        {
            "$set": {
                "status":                "failed",
                "updated_at":            _now(),
                "stages.$.status":       "failed",
                "stages.$.completed_at": _now(),
                "stages.$.metrics":      safe_metrics,
            }
        },
    )
    await add_event(analysis_id, f"FAILED [{stage_id}]: {reason}", level="error")


async def add_event(analysis_id: str, message: str, level: str = "info") -> None:
    await _db()[COLLECTION].update_one(
        {"analysis_id": analysis_id},
        {
            "$push": {
                "events": {
                    "ts":      _now(),
                    "level":   level,
                    "message": message,
                }
            },
            "$set": {"updated_at": _now()},
        },
    )


async def set_results(analysis_id: str, results: dict) -> None:
    safe_results = _sanitize(results)
    await _db()[COLLECTION].update_one(
        {"analysis_id": analysis_id},
        {
            "$set": {
                "results":      safe_results,
                "status":       "completed",
                "progress":     100,
                "current_stage": "completed",
                "completed_at": _now(),
                "updated_at":   _now(),
            }
        },
    )


async def list_runs(limit: int = 20) -> list[dict]:
    runs = []
    async for doc in _db()[COLLECTION].find({}).sort("created_at", -1).limit(limit):
        runs.append(_serialize(doc))
    return runs


async def get_events(analysis_id: str, since_index: int = 0) -> list[dict]:
    doc = await _db()[COLLECTION].find_one(
        {"analysis_id": analysis_id},
        {"events": 1}
    )
    if not doc:
        return []
    events = doc.get("events", [])
    result = []
    for evt in events[since_index:]:
        ts = evt.get("ts")
        result.append({
            "ts":      ts.isoformat() if isinstance(ts, datetime) else str(ts),
            "level":   evt.get("level", "info"),
            "message": evt.get("message", ""),
        })
    return result
