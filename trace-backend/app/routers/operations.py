"""
routers/operations.py
GET /api/operations  — operational episode data from episode_attribution CSV.
"""

from fastapi import APIRouter, Query
from app.core.data_loader import episode_attr_df

router = APIRouter(prefix="/api", tags=["Operations"])


@router.get("/operations")
def get_operations(plant_id: str = Query("PLANT-002", description="Plant ID")):
    episodes = []
    for _, row in episode_attr_df.iterrows():
        episodes.append({
            "episodeId":       str(row["episode_id"]),
            "timestampStart":  str(row["timestamp_start"]),
            "timestampEnd":    str(row["timestamp_end"]),
            "durationMinutes": float(row["duration_minutes"]),
            "expectedKwh":     float(row["expected_generation_kwh"]),
            "actualKwh":       float(row["actual_generation_kwh"]),
            "varianceKwh":     float(row["observed_variance_kwh"]),
            "variancePct":     float(row["variance_pct"]),
            "primaryCategory": str(row["primary_evidence_category"]),
            "confidence":      str(row["attribution_confidence"]),
            "evidenceStatus":  str(row.get("evidence_status", "MODERATE")),
            "recoverability":  str(row.get("recoverability", "NOT_ESTABLISHED")),
            "recoveryKwh":     float(row.get("recovery_potential_kwh", 0)),
            "priority":        str(row.get("priority", "MONITOR")),
            "recommendedAction": str(row.get("recommended_action", "COLLECT_MORE_EVIDENCE")),
        })

    # Summary stats
    total_variance = sum(e["varianceKwh"] for e in episodes)
    high_priority  = [e for e in episodes if e["priority"] == "HIGH"]
    med_priority   = [e for e in episodes if e["priority"] == "MEDIUM"]

    return {
        "summary": {
            "totalEpisodes":       len(episodes),
            "totalVarianceKwh":    round(total_variance, 2),
            "highPriorityCount":   len(high_priority),
            "mediumPriorityCount": len(med_priority),
        },
        "episodes": episodes,
    }
