"""
routers/commercial.py
GET /api/commercial  — revenue breakdown from real TRACE commercial CSV.
"""

from fastapi import APIRouter, Query
from app.core.data_loader import commercial_df, episode_financial_df

router = APIRouter(prefix="/api", tags=["Commercial"])


@router.get("/commercial")
def get_commercial(plant_id: str = Query("PLANT-002", description="Plant ID")):
    comm = commercial_df.iloc[0]

    top_episodes = (
        episode_financial_df
        .sort_values("generation_revenue_impact_usd", ascending=False)
        .head(10)
    )

    episodes = []
    for _, row in top_episodes.iterrows():
        episodes.append({
            "episodeId":          str(row["episode_id"]),
            "timestampStart":     str(row["timestamp_start"]),
            "timestampEnd":       str(row["timestamp_end"]),
            "varianceKwh":        float(row["observed_variance_kwh"]),
            "revenueImpactUsd":   float(row["generation_revenue_impact_usd"]),
            "recoveryPotentialUsd": float(row["recovery_revenue_potential_usd"]),
            "primaryCategory":    str(row["primary_evidence_category"]),
            "confidence":         str(row["attribution_confidence"]),
            "priority":           str(row["priority"]),
        })

    return {
        "summary": {
            "periodStart":              str(comm["period_start"]),
            "periodEnd":                str(comm["period_end"]),
            "expectedGenerationKwh":    float(comm["expected_generation_kwh"]),
            "actualGenerationKwh":      float(comm["actual_generation_kwh"]),
            "generationGapKwh":         float(comm["generation_gap_kwh"]),
            "tariffUsdPerKwh":          float(comm["tariff_usd_per_kwh"]),
            "settlementFactor":         float(comm["settlement_factor"]),
            "baselineEnergyValueUsd":   float(comm["baseline_energy_value_usd"]),
            "actualSettlementValueUsd": float(comm["actual_settlement_value_usd"]),
            "generationRevenueGapUsd":  float(comm["generation_driven_revenue_loss_usd"]),
            "commercialRevenueGapUsd":  float(comm["commercial_driven_revenue_impact_usd"]),
            "totalRevenueGapUsd":       float(comm["total_revenue_gap_usd"]),
            "generationDrivenPct":      float(comm["generation_driven_pct"]),
            "commercialDrivenPct":      float(comm["commercial_driven_pct"]),
            "recoveryPotentialKwh":     float(comm["recovery_potential_kwh"]),
            "recoveryRevenuePotentialUsd": float(comm["recovery_revenue_potential_usd"]),
            "commercialDataSource":     str(comm["commercial_data_source"]),
        },
        "topEpisodes": episodes,
    }
