"""
routers/model_runner.py
POST /api/model-runner/upload           — validate + preview an uploaded CSV
POST /api/model-runner/analyze          — start async analysis pipeline
GET  /api/model-runner/status/{id}      — poll pipeline status + stage list
GET  /api/model-runner/results/{id}     — full results once completed
GET  /api/model-runner/events/{id}      — live event log (supports ?since=N)
GET  /api/model-runner/history          — list past analysis runs
"""

import asyncio
import io
import logging
import re
from datetime import datetime, timezone

import pandas as pd
from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel

from app.db.repositories.analysis_runs import (
    create_run,
    get_events,
    get_run,
    list_runs,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/model-runner", tags=["Model Runner"])

# ── Column detection heuristics (mirror pipeline) ─────────────────────────
_HEURISTICS = {
    "timestamp":   ["measured_on", "timestamp", "time", "datetime", "date_time", "date"],
    "poa":         ["poa_irradiance__5041", "poa_irradiance", "poa", "irradiance", "ghi", "irrad"],
    "module_temp": ["module_temp__5043", "module_temp", "module_temperature", "temp_module", "tmod"],
    "dc_power":    ["dc_power__5077", "dc_power", "dc", "pdc"],
    "ac_power":    ["ac_power__5074", "ac_power", "ac", "pac", "ac_watts", "inverter_ac"],
    "ambient_temp":["ambient_temp__5042", "ambient_temp", "tamb", "air_temp"],
    "pr":          ["pr__5047", "performance_ratio", "pr", "perf_ratio"],
}
_REQUIRED  = {"timestamp", "poa", "module_temp", "ac_power"}
_OPTIONAL  = {"dc_power", "ambient_temp", "pr"}


def _detect(cols: list[str]) -> dict[str, str]:
    lower = {c.lower(): c for c in cols}
    mapping = {}
    for field, candidates in _HEURISTICS.items():
        for cand in candidates:
            if cand in lower:
                mapping[field] = lower[cand]
                break
    return mapping


# ── /upload ────────────────────────────────────────────────────────────────
@router.post("/upload")
async def upload_dataset(file: UploadFile = File(...)):
    """
    Parse uploaded CSV, detect columns, run basic quality checks.
    Returns a dataset_preview without starting the pipeline.
    """
    MAX_BYTES = 50 * 1024 * 1024  # 50 MB
    raw = await file.read()
    if len(raw) > MAX_BYTES:
        raise HTTPException(413, "File exceeds 50 MB limit")

    try:
        df = pd.read_csv(io.BytesIO(raw), low_memory=False, nrows=None)
    except Exception as exc:
        raise HTTPException(400, f"Cannot parse CSV: {exc}")

    n_rows, n_cols = df.shape
    col_map = _detect(list(df.columns))

    # ── Date range
    ts_col = col_map.get("timestamp")
    date_range = period_label = interval_min = None
    if ts_col:
        try:
            ts = pd.to_datetime(df[ts_col], utc=False, errors="coerce").dropna().sort_values()
            if len(ts):
                date_range = {
                    "start": ts.iloc[0].isoformat(),
                    "end":   ts.iloc[-1].isoformat(),
                }
                period_label = (
                    f"{ts.iloc[0].strftime('%b %d')} → "
                    f"{ts.iloc[-1].strftime('%b %d, %Y')}"
                )
                diffs = ts.diff().dropna()
                mode_diff = diffs.mode()
                if len(mode_diff):
                    interval_min = round(mode_diff.iloc[0].total_seconds() / 60, 1)
        except Exception:
            pass

    # ── Quality metrics
    ac_col  = col_map.get("ac_power")
    poa_col = col_map.get("poa")
    missing_ts  = int(df[ts_col].isna().sum())  if ts_col  else n_rows
    missing_ac  = int(df[ac_col].isna().sum())  if ac_col  else n_rows
    missing_poa = int(df[poa_col].isna().sum()) if poa_col else n_rows
    dup_rows    = int(df.duplicated().sum())
    # valid_rows = total rows minus duplicates only.
    # Missing AC/POA at night is expected and does NOT make a row invalid.
    valid_rows  = n_rows - dup_rows

    sampling_pct = None
    if ts_col:
        try:
            ts2 = pd.to_datetime(df[ts_col], errors="coerce").sort_values()
            diffs2 = ts2.diff().dropna()
            md = diffs2.mode()
            if len(md):
                sampling_pct = round((diffs2 == md.iloc[0]).mean() * 100, 1)
        except Exception:
            pass

    # Power range check
    pwr_ok = None
    if ac_col:
        try:
            ac_vals = pd.to_numeric(df[ac_col], errors="coerce").dropna()
            pwr_ok = bool((ac_vals >= 0).all() and (ac_vals <= 10000).all())
        except Exception:
            pass

    # ── Field detection results
    detected_fields = []
    for field in list(_REQUIRED) + list(_OPTIONAL):
        if field in col_map:
            detected_fields.append({
                "field":     field,
                "csv_col":   col_map[field],
                "status":    "found",
                "required":  field in _REQUIRED,
                "auto":      True,
            })
        elif field in _REQUIRED:
            detected_fields.append({
                "field":     field,
                "csv_col":   None,
                "status":    "missing_required",
                "required":  True,
                "auto":      False,
            })
        else:
            detected_fields.append({
                "field":     field,
                "csv_col":   None,
                "status":    "not_found",
                "required":  False,
                "auto":      False,
            })

    missing_required = [f for f in _REQUIRED if f not in col_map]
    can_run = len(missing_required) == 0 and n_rows >= 100

    return {
        "filename":     file.filename,
        "file_size_kb": round(len(raw) / 1024, 1),
        "rows":         n_rows,
        "columns":      n_cols,
        "column_names": list(df.columns),
        "date_range":   date_range,
        "period_label": period_label,
        "interval_minutes": interval_min,
        "col_map":      col_map,
        "detected_fields": detected_fields,
        "quality": {
            "valid_rows":       valid_rows,
            "missing_ts":       missing_ts,
            "missing_ac":       missing_ac,
            "missing_poa":      missing_poa,
            "duplicate_rows":   dup_rows,
            "sampling_pct":     sampling_pct,
            "power_range_ok":   pwr_ok,
        },
        "missing_required": missing_required,
        "can_run":          can_run,
        "csv_bytes_b64":    None,   # caller re-sends file with /analyze
    }


# ── /analyze ───────────────────────────────────────────────────────────────
@router.post("/analyze")
async def start_analysis(
    file: UploadFile = File(...),
    plant_name: str = Form("Uploaded Plant"),
    reference_period: str = Form("auto"),
    tariff: float | None = Form(None),
    settlement_factor: float = Form(1.0),
):
    """
    Accept uploaded CSV, create analysis run in MongoDB, launch pipeline
    as a background task, and immediately return analysis_id for polling.
    """
    raw = await file.read()
    if len(raw) > 50 * 1024 * 1024:
        raise HTTPException(413, "File exceeds 50 MB limit")

    config = {
        "filename":          file.filename,
        "plant_name":        plant_name,
        "reference_period":  reference_period,
        "tariff_usd_per_kwh": tariff,
        "settlement_factor": settlement_factor,
    }

    # Quick preview for dataset metadata
    try:
        df_head = pd.read_csv(io.BytesIO(raw), nrows=5)
        col_map = _detect(list(df_head.columns))
        n_rows  = sum(1 for _ in io.BytesIO(raw).readlines()) - 1
    except Exception:
        col_map, n_rows = {}, 0

    dataset_meta = {
        "filename":   file.filename,
        "rows":       n_rows,
        "col_map":    col_map,
    }

    # Create MongoDB document
    run = await create_run(dataset_meta, config)
    analysis_id = run["analysis_id"]

    # Launch pipeline as background task (non-blocking)
    from app.services.analysis_pipeline import run_pipeline
    asyncio.create_task(run_pipeline(analysis_id, raw, config))

    return {
        "analysis_id": analysis_id,
        "status":      "running",
        "message":     "Pipeline started. Poll /status for updates.",
    }


# ── /status/{id} ───────────────────────────────────────────────────────────
@router.get("/status/{analysis_id}")
async def get_status(analysis_id: str):
    """
    Return current pipeline status, progress, and per-stage breakdown.
    Poll this every 2 seconds from the frontend.
    """
    run = await get_run(analysis_id)
    if not run:
        raise HTTPException(404, f"Analysis {analysis_id} not found")

    return {
        "analysis_id":   run["analysis_id"],
        "status":        run["status"],
        "current_stage": run["current_stage"],
        "progress":      run["progress"],
        "stages":        run.get("stages", []),
        "dataset":       run.get("dataset", {}),
        "config":        run.get("config", {}),
        "created_at":    run.get("created_at"),
        "updated_at":    run.get("updated_at"),
        "completed_at":  run.get("completed_at"),
    }


# ── /results/{id} ──────────────────────────────────────────────────────────
@router.get("/results/{analysis_id}")
async def get_results(analysis_id: str):
    """Return full analysis results once pipeline is completed."""
    run = await get_run(analysis_id)
    if not run:
        raise HTTPException(404, f"Analysis {analysis_id} not found")
    if run["status"] not in ("completed", "failed"):
        raise HTTPException(202, {"message": "Analysis still running", "status": run["status"]})

    return {
        "analysis_id": analysis_id,
        "status":      run["status"],
        "results":     run.get("results", {}),
        "stages":      run.get("stages", []),
    }


# ── /events/{id} ───────────────────────────────────────────────────────────
@router.get("/events/{analysis_id}")
async def get_analysis_events(
    analysis_id: str,
    since: int = Query(0, ge=0, description="Return events from this index onward"),
):
    """
    Return event log entries for live terminal panel.
    Use ?since=N to only get new events since last poll.
    """
    events = await get_events(analysis_id, since_index=since)
    return {
        "analysis_id": analysis_id,
        "events":      events,
        "total":       since + len(events),
    }


# ── /history ───────────────────────────────────────────────────────────────
@router.get("/history")
async def get_history(limit: int = Query(20, ge=1, le=100)):
    """Return recent analysis runs for the history drawer."""
    runs = await list_runs(limit=limit)
    return {
        "runs": [
            {
                "analysis_id":  r["analysis_id"],
                "status":       r["status"],
                "plant_name":   r.get("config", {}).get("plant_name", "Unknown"),
                "filename":     r.get("dataset", {}).get("filename", ""),
                "rows":         r.get("dataset", {}).get("rows", 0),
                "progress":     r.get("progress", 0),
                "created_at":   r.get("created_at"),
                "completed_at": r.get("completed_at"),
                "variance_kwh": r.get("results", {}).get("performance", {}).get("variance_kwh"),
                "episodes":     r.get("results", {}).get("total_episodes"),
            }
            for r in runs
        ],
        "total": len(runs),
    }
