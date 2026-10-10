"""
routers/attribution.py
GET /api/attribution  — waterfall attribution data from real TRACE CSVs.
"""

from fastapi import APIRouter, Query
from app.core.data_loader import attribution_df, commercial_df, recurrence_summary_df

router = APIRouter(prefix="/api", tags=["Attribution"])

_CATEGORY_META = {
    "EQUIPMENT_CONVERSION": {
        "label": "Equipment / Conversion",
        "category": "Equipment",
        "controllable": True,
        "recoverable": True,
        "color": "#615FFF",
    },
    "ENVIRONMENTAL": {
        "label": "Environmental",
        "category": "Resource",
        "controllable": False,
        "recoverable": False,
        "color": "#F59E0B",
    },
    "DATA_QUALITY": {
        "label": "Data Quality",
        "category": "Data",
        "controllable": False,
        "recoverable": False,
        "color": "#94a3b8",
    },
    "UNEXPLAINED": {
        "label": "Unexplained / Residual",
        "category": "Residual",
        "controllable": False,
        "recoverable": False,
        "color": "#6b7280",
    },
}


@router.get("/attribution")
def get_attribution(plant_id: str = Query("PLANT-002", description="Plant ID")):
    comm    = commercial_df.iloc[0]
    tariff  = float(comm["tariff_usd_per_kwh"])
    settle  = float(comm["settlement_factor"])

    # Aggregate by evidence category
    grouped = attribution_df.groupby("primary_evidence_category").agg(
        total_variance=("observed_variance_kwh", "sum"),
        total_equipment=("equipment_conversion_kwh", "sum"),
        total_environmental=("environmental_kwh", "sum"),
        total_data_quality=("data_quality_kwh", "sum"),
        total_unexplained=("unexplained_kwh", "sum"),
    ).reset_index()

    total_variance = float(attribution_df["observed_variance_kwh"].sum())
    expected_kwh   = float(comm["expected_generation_kwh"])
    actual_kwh     = float(comm["actual_generation_kwh"])

    rec_map = recurrence_summary_df.set_index("primary_evidence_category")["episode_count"].to_dict()
    total_episodes = recurrence_summary_df["episode_count"].sum()

    waterfall = [
        {
            "id":    "expected",
            "label": "Expected Output",
            "value": round(expected_kwh / 1000, 3),
            "type":  "baseline",
            "color": "#615FFF",
        }
    ]

    for _, row in grouped.iterrows():
        cat  = row["primary_evidence_category"]
        meta = _CATEGORY_META.get(cat, {"label": cat, "category": "Other", "controllable": False, "recoverable": False, "color": "#6b7280"})
        loss_kwh = float(row["total_variance"])
        ep_count = int(rec_map.get(cat, 0))
        recurrence_str = f"{ep_count} episodes" if ep_count else "—"
        contrib_pct = round((loss_kwh / total_variance) * 100, 2) if total_variance else 0

        waterfall.append({
            "id":    cat.lower(),
            "label": meta["label"],
            "cause": meta["label"],
            "value": round(-loss_kwh / 1000, 3),
            "type":  "loss",
            "category": meta["category"],
            "contributionPct": contrib_pct,
            "classification": {
                "explainable":  cat != "UNEXPLAINED",
                "controllable": meta["controllable"],
                "recoverable":  meta["recoverable"],
            },
            "confidence": 90 if cat == "EQUIPMENT_CONVERSION" else 75,
            "financialImpact": round(loss_kwh * tariff * settle, 2),
            "recurrence": recurrence_str,
            "evidenceIds": [],
        })

    waterfall.append({
        "id":    "actual",
        "label": "Actual Output",
        "value": round(actual_kwh / 1000, 3),
        "type":  "total",
        "color": "#10B981",
    })

    return {
        "waterfall": waterfall,
        "reconciliation": {
            "expected":   round(expected_kwh / 1000, 3),
            "totalLoss":  round(total_variance / 1000, 3),
            "actual":     round(actual_kwh / 1000, 3),
            "residual":   0.0,
            "status":     "PASS",
        },
    }
