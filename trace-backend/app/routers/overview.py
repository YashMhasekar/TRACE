"""
routers/overview.py
GET /api/overview  — plant summary, KPIs, recovery opportunities.
Primary source: MongoDB analysis_results + plants collections.
Fallback: CSV data (always available).
"""

from fastapi import APIRouter, Query
from app.core.data_loader import (
    commercial_df,
    decision_df,
    recurrence_summary_df,
    physical_expected_df,
)
from app.core import database

router = APIRouter(prefix="/api", tags=["Overview"])


def _get_db():
    return database.db


def _csv_fallback(plant_name: str, period_label: str):
    """Build the overview response entirely from CSVs."""
    comm = commercial_df.iloc[0]
    expected_kwh = float(comm["expected_generation_kwh"])
    actual_kwh   = float(comm["actual_generation_kwh"])
    gap_kwh      = float(comm["generation_gap_kwh"])
    tariff       = float(comm["tariff_usd_per_kwh"])
    settle       = float(comm["settlement_factor"])
    revenue_gap  = float(comm["total_revenue_gap_usd"])
    recovery_kwh = float(comm["recovery_potential_kwh"])
    recovery_rev = float(comm["recovery_revenue_potential_usd"])
    variance_pct = round((gap_kwh / expected_kwh) * 100, 2) if expected_kwh else 0.0

    top = (
        decision_df[decision_df["recovery_potential_kwh"] > 0]
        .sort_values("recovery_potential_kwh", ascending=False)
        .head(3)
        .reset_index(drop=True)
    )
    _LABEL = {
        "EQUIPMENT_CONVERSION": "Equipment / Conversion Loss",
        "ENVIRONMENTAL":        "Environmental Loss",
        "DATA_QUALITY":         "Data Quality Gap",
        "UNEXPLAINED":          "Unexplained Loss",
    }
    rec_map  = recurrence_summary_df.set_index("primary_evidence_category")["recurrence_class"].to_dict()
    conf_map = {"HIGH": 90, "MEDIUM": 72, "LOW": 50}
    opportunities = []
    for rank, (_, row) in enumerate(top.iterrows(), start=1):
        cat       = row["primary_evidence_category"]
        rec_class = rec_map.get(cat, "ISOLATED")
        rec_label = {
            "POTENTIALLY_STRUCTURAL": "Structural / recurring",
            "RECURRING":  "Recurring",
            "REPEATED":   "Repeated",
            "ISOLATED":   "Isolated",
        }.get(rec_class, rec_class)
        opportunities.append({
            "rank":                 rank,
            "cause":                _LABEL.get(cat, cat),
            "causeId":              cat.lower(),
            "lossGwh":              round(float(row["observed_variance_kwh"]) / 1000, 4),
            "potentialRecoveryGwh": round(float(row["recovery_potential_kwh"]) / 1000, 4),
            "potentialRevenue":     round(float(row["recovery_potential_kwh"]) * tariff * settle, 2),
            "controllability":      "High" if cat == "EQUIPMENT_CONVERSION" else "Low",
            "recurrence":           rec_label,
            "confidence":           conf_map.get(str(row.get("attribution_confidence", "MEDIUM")), 72),
        })

    total_rows = len(physical_expected_df)
    valid_ac   = int(physical_expected_df["ac_power__5074"].notna().sum())
    valid_poa  = int(physical_expected_df["poa_irradiance__5041"].notna().sum())
    overall_dq = round((valid_ac / total_rows) * 100, 1) if total_rows else 94.0

    return {
        "plant":  plant_name,
        "period": period_label,
        "performance": {
            "expectedGwh":       round(expected_kwh / 1000, 3),
            "actualGwh":         round(actual_kwh / 1000, 3),
            "varianceGwh":       round(gap_kwh / 1000, 3),
            "variancePct":       variance_pct,
            "expectedRevenue":   round(expected_kwh * tariff * settle, 2),
            "actualRevenue":     round(actual_kwh * tariff * settle, 2),
            "revenueGap":        round(revenue_gap, 2),
            "recoverableGwh":    round(recovery_kwh / 1000, 3),
            "recoverableRevenue": round(recovery_rev, 2),
        },
        "dataQuality": {
            "overall":          overall_dq,
            "completeness":     round((valid_ac / total_rows) * 100, 1) if total_rows else 97.0,
            "timestampQuality": 99.0,
            "duplicateRate":    0.0,
            "evidenceCoverage": round((valid_poa / total_rows) * 100, 1) if total_rows else 91.0,
        },
        "topRecoveryOpportunities": opportunities,
    }


@router.get("/overview")
async def get_overview(plant_id: str = Query("PLANT-002", description="Plant ID")):
    """
    Get plant overview with KPIs and top recovery opportunities.
    Merges MongoDB (plant metadata + analysis) with CSV (detailed attribution).
    """
    db = _get_db()

    # ── Fetch MongoDB documents ──────────────────────────────────────────
    plant_doc    = None
    analysis_doc = None

    if db is not None:
        plant_doc = await db["plants"].find_one({"plant_id": plant_id})
        analysis_doc = await db["analysis_results"].find_one(
            {"plant_id": plant_id, "status": "completed"},
            sort=[("generated_at", -1)],
        )

    # ── Plant name + period ──────────────────────────────────────────────
    if plant_doc:
        plant_name = plant_doc["name"]
    else:
        plant_name = "Solar Plant Alpha"

    if analysis_doc:
        period_label = analysis_doc.get("period_label", "May 2026")
    else:
        period_start = physical_expected_df["measured_on"].min()
        period_end   = physical_expected_df["measured_on"].max()
        period_label = f"{period_start.strftime('%b')}–{period_end.strftime('%b %Y')}"

    # ── Data quality from MongoDB plant doc ──────────────────────────────
    if plant_doc:
        dq_score = float(plant_doc.get("data_quality_score", 94.0))
    else:
        total_rows = len(physical_expected_df)
        valid_ac   = int(physical_expected_df["ac_power__5074"].notna().sum())
        dq_score   = round((valid_ac / total_rows) * 100, 1) if total_rows else 94.0

    # ── Performance from MongoDB analysis ────────────────────────────────
    if analysis_doc:
        perf        = analysis_doc.get("performance", {})
        expected_kwh = float(perf.get("expected_kwh", 0))
        actual_kwh   = float(perf.get("actual_kwh", 0))
        gap_kwh      = float(perf.get("gap_kwh", 0))
        variance_pct = float(perf.get("gap_percent", 0))
        revenue_gap  = float(perf.get("revenue_gap", 0))
        recovery_kwh = float(perf.get("recoverable_kwh", 0))
        recovery_rev = float(perf.get("recoverable_revenue", 0))

        tariff  = float(plant_doc.get("tariff_usd_per_kwh", 0.055)) if plant_doc else 0.055
        settle  = float(plant_doc.get("settlement_factor", 0.97)) if plant_doc else 0.97

        # Build opportunities from MongoDB attribution
        attribution = analysis_doc.get("attribution", [])
        opportunities = []
        _CTRL_MAP = {"EQUIPMENT_CONVERSION": "High", "ENVIRONMENTAL": "Low", "DATA_QUALITY": "Low", "UNEXPLAINED": "Low"}
        _REC_LABEL = {
            "POTENTIALLY_STRUCTURAL": "Structural / recurring",
            "RECURRING":  "Recurring",
            "REPEATED":   "Repeated",
            "ISOLATED":   "Isolated",
        }
        for rank, attr in enumerate(
            sorted(attribution, key=lambda x: x.get("recoverable_kwh", 0), reverse=True)[:3],
            start=1
        ):
            cat = attr.get("category", "")
            opportunities.append({
                "rank":                 rank,
                "cause":                attr.get("label", cat),
                "causeId":              cat.lower(),
                "lossGwh":              round(attr.get("loss_kwh", 0) / 1000, 4),
                "potentialRecoveryGwh": round(attr.get("recoverable_kwh", 0) / 1000, 4),
                "potentialRevenue":     round(attr.get("recoverable_kwh", 0) * tariff * settle, 2),
                "controllability":      "High" if attr.get("controllable") else "Low",
                "recurrence":           _REC_LABEL.get(attr.get("recurrence_class", "ISOLATED"), "Isolated"),
                "confidence":           attr.get("confidence", 75),
            })

        # If no recoverable, fall back to largest loss opportunities
        if not opportunities or all(o["potentialRecoveryGwh"] == 0 for o in opportunities):
            for rank, attr in enumerate(
                sorted(attribution, key=lambda x: x.get("loss_kwh", 0), reverse=True)[:3],
                start=1
            ):
                cat = attr.get("category", "")
                opportunities.append({
                    "rank":                 rank,
                    "cause":                attr.get("label", cat),
                    "causeId":              cat.lower(),
                    "lossGwh":              round(attr.get("loss_kwh", 0) / 1000, 4),
                    "potentialRecoveryGwh": round(attr.get("recoverable_kwh", 0) / 1000, 4),
                    "potentialRevenue":     round(attr.get("recoverable_kwh", 0) * tariff * settle, 2),
                    "controllability":      "High" if attr.get("controllable") else "Low",
                    "recurrence":           _REC_LABEL.get(attr.get("recurrence_class", "ISOLATED"), "Isolated"),
                    "confidence":           attr.get("confidence", 75),
                })

        dq_data = analysis_doc.get("data_quality", {})

        return {
            "plant":  plant_name,
            "period": period_label,
            "performance": {
                "expectedGwh":       round(expected_kwh / 1000, 3),
                "actualGwh":         round(actual_kwh / 1000, 3),
                "varianceGwh":       round(gap_kwh / 1000, 3),
                "variancePct":       round(variance_pct, 2),
                "expectedRevenue":   float(perf.get("expected_revenue", expected_kwh * tariff)),
                "actualRevenue":     float(perf.get("actual_revenue", actual_kwh * tariff)),
                "revenueGap":        round(revenue_gap, 2),
                "recoverableGwh":    round(recovery_kwh / 1000, 3),
                "recoverableRevenue": round(recovery_rev, 2),
            },
            "dataQuality": {
                "overall":          dq_score,
                "completeness":     float(dq_data.get("completeness_ac", dq_score)),
                "timestampQuality": 99.0,
                "duplicateRate":    0.0,
                "evidenceCoverage": float(dq_data.get("completeness_poa", 91.0)),
            },
            "topRecoveryOpportunities": opportunities,
        }

    # ── No MongoDB data — use CSV fallback ───────────────────────────────
    return _csv_fallback(plant_name, period_label)
