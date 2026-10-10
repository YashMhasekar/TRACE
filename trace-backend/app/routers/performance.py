"""
routers/performance.py
GET /api/performance  — time-series performance data from physical_expected CSV.
"""

from fastapi import APIRouter, Query
from app.core.data_loader import physical_expected_df, commercial_df

router = APIRouter(prefix="/api", tags=["Performance"])


@router.get("/performance")
def get_performance(plant_id: str = Query("PLANT-002", description="Plant ID")):
    comm = commercial_df.iloc[0]

    # Daily aggregation for time series
    df = physical_expected_df.copy()
    df["date"] = df["measured_on"].dt.date

    daily = df.groupby("date").agg(
        expected_kwh=("expected_generation_kwh", "sum"),
        actual_kwh=("actual_generation_kwh", "sum"),
    ).reset_index()

    daily["variance_kwh"] = daily["expected_kwh"] - daily["actual_kwh"]
    daily["variance_pct"] = (daily["variance_kwh"] / daily["expected_kwh"].replace(0, float("nan"))) * 100

    time_series = [
        {
            "date":        str(row["date"]),
            "expectedKwh": round(float(row["expected_kwh"]), 2),
            "actualKwh":   round(float(row["actual_kwh"]), 2),
            "varianceKwh": round(float(row["variance_kwh"]), 2),
            "variancePct": round(float(row["variance_pct"]), 2) if not float("nan") == float(row["variance_pct"]) else 0.0,
        }
        for _, row in daily.iterrows()
    ]

    return {
        "summary": {
            "expectedKwh":  float(comm["expected_generation_kwh"]),
            "actualKwh":    float(comm["actual_generation_kwh"]),
            "varianceKwh":  float(comm["generation_gap_kwh"]),
            "variancePct":  round((float(comm["generation_gap_kwh"]) / float(comm["expected_generation_kwh"])) * 100, 2),
        },
        "timeSeries": time_series,
    }
