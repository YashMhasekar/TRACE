"""
routers/recurrence.py
GET /api/recurrence  — recurrence analysis from real TRACE CSVs.
"""

from fastapi import APIRouter, Query
from app.core.data_loader import recurrence_summary_df, episode_recurrence_df

router = APIRouter(prefix="/api", tags=["Recurrence"])

_CATEGORY_META = {
    "EQUIPMENT_CONVERSION": {"cause": "Equipment / Conversion", "category": "Equipment", "controllability": "High"},
    "ENVIRONMENTAL":        {"cause": "Environmental",           "category": "Resource",  "controllability": "None"},
    "DATA_QUALITY":         {"cause": "Data Quality",            "category": "Data",      "controllability": "None"},
    "UNEXPLAINED":          {"cause": "Unexplained",             "category": "Residual",  "controllability": "Unknown"},
}

_STATUS_MAP = {
    "POTENTIALLY_STRUCTURAL": "Structural",
    "RECURRING":              "Recurring",
    "REPEATED":               "Watch",
    "ISOLATED":               "Isolated",
}


@router.get("/recurrence")
def get_recurrence(plant_id: str = Query("PLANT-002", description="Plant ID")):
    total_episodes = int(recurrence_summary_df["episode_count"].sum())

    # Build month list from episode data
    months = sorted(episode_recurrence_df["timestamp_start"].dt.to_period("M").astype(str).unique().tolist())

    causes = []
    for _, row in recurrence_summary_df.iterrows():
        cat  = row["primary_evidence_category"]
        meta = _CATEGORY_META.get(cat, {"cause": cat, "category": "Other", "controllability": "Unknown"})
        count = int(row["episode_count"])
        freq  = round(float(row["episode_frequency_pct"]), 1)
        status = _STATUS_MAP.get(str(row["recurrence_class"]), "Isolated")

        # Build per-month period data
        cat_episodes = episode_recurrence_df[
            episode_recurrence_df["primary_evidence_category"] == cat
        ].copy()
        cat_episodes["month"] = cat_episodes["timestamp_start"].dt.to_period("M").astype(str)

        period_data = []
        for month in months:
            month_eps = cat_episodes[cat_episodes["month"] == month]
            occurred  = len(month_eps) > 0
            loss_kwh  = round(float(month_eps["observed_variance_kwh"].sum()) / 1000, 3) if occurred else 0
            period_data.append({"period": month, "occurred": occurred, "lossGwh": loss_kwh})

        conf_map = {"HIGH": 90, "MEDIUM": 72, "LOW": 50}
        confidence = conf_map.get(str(cat_episodes["attribution_confidence"].mode().iloc[0]) if not cat_episodes.empty else "MEDIUM", 72)

        causes.append({
            "id":            cat.lower(),
            "cause":         meta["cause"],
            "category":      meta["category"],
            "occurrences":   count,
            "totalPeriods":  len(months),
            "frequencyPct":  freq,
            "status":        status,
            "avgLossGwh":    round(float(row["average_variance_kwh"]) / 1000, 3),
            "maxLossGwh":    round(float(row["max_variance_kwh"]) / 1000, 3),
            "controllability": meta["controllability"],
            "confidence":    confidence,
            "priorityScore": round(float(row["recurrence_score"]), 1),
            "periodData":    period_data,
        })

    # Sort by priority score descending
    causes.sort(key=lambda x: x["priorityScore"], reverse=True)

    return {"periods": months, "causes": causes}
