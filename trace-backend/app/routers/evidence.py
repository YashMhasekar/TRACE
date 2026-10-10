"""
routers/evidence.py
GET /api/evidence        — all evidence items
GET /api/evidence/{id}   — single evidence item by episode_id
"""

from fastapi import APIRouter, HTTPException, Query
from app.core.data_loader import evidence_chain_df

router = APIRouter(prefix="/api", tags=["Evidence"])

_STATUS_MAP = {"STRONG": "Strong", "MODERATE": "Moderate", "LIMITED": "Limited"}
_CONF_MAP   = {"HIGH": 90, "MEDIUM": 72, "LOW": 50}


def _row_to_item(row) -> dict:
    cat = str(row.get("primary_evidence_category", "UNEXPLAINED"))
    return {
        "id":              str(row["episode_id"]),
        "timestampStart":  str(row["timestamp_start"]),
        "timestampEnd":    str(row["timestamp_end"]),
        "durationMinutes": float(row["duration_minutes"]),
        "expectedKwh":     float(row["expected_generation_kwh"]),
        "actualKwh":       float(row["actual_generation_kwh"]),
        "varianceKwh":     float(row["observed_variance_kwh"]),
        "variancePct":     float(row["variance_pct"]),
        "evidenceStatus":  _STATUS_MAP.get(str(row.get("evidence_status", "MODERATE")), "Moderate"),
        "primaryCategory": cat,
        "confidence":      _CONF_MAP.get(str(row.get("attribution_confidence", "MEDIUM")), 72),
        "explainability":  str(row.get("explainability", "PARTIAL")),
        "controllability": str(row.get("controllability", "UNKNOWN")),
        "recoverability":  str(row.get("recoverability", "NOT_ESTABLISHED")),
        "recoveryPotentialKwh": float(row.get("recovery_potential_kwh", 0)),
        "priority":        str(row.get("priority", "MONITOR")),
        "recommendedAction": str(row.get("recommended_action", "COLLECT_MORE_EVIDENCE")),
        "recurrenceClass": str(row.get("recurrence_class", "ISOLATED")),
        "proofStatement":  str(row.get("proof_statement", "")),
        "evidenceLimitations": str(row.get("evidence_limitations", "")),
        "avgPoaIrradiance": float(row["average_poa_irradiance"]) if "average_poa_irradiance" in row and str(row["average_poa_irradiance"]) != "nan" else None,
        "avgAcPower":      float(row["average_ac_power"]) if "average_ac_power" in row and str(row["average_ac_power"]) != "nan" else None,
    }


@router.get("/evidence")
def get_evidence(plant_id: str = Query("PLANT-002", description="Plant ID")):
    items = [_row_to_item(row) for _, row in evidence_chain_df.iterrows()]
    return {"items": items, "total": len(items)}


@router.get("/evidence/{episode_id}")
def get_evidence_by_id(episode_id: str):
    match = evidence_chain_df[evidence_chain_df["episode_id"] == episode_id]
    if match.empty:
        raise HTTPException(status_code=404, detail=f"Episode {episode_id} not found")
    return _row_to_item(match.iloc[0])
