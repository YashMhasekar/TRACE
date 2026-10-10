"""
routers/recovery.py
GET  /api/simulation          — simulation causes and sensitivity curves
POST /api/simulation/simulate — run a recovery simulation and persist to MongoDB

Simulation formula (transparent, deterministic):
    recovered_gwh = max_recoverable_gwh × (improvement_pct / 100)
    residual_loss = current_loss_gwh  − recovered_gwh
    recovered_rev = recovered_gwh × 1000 × tariff × settlement
"""

from fastapi import APIRouter, Query
from pydantic import BaseModel
from app.core.data_loader import decision_df, commercial_df
from app.core import database

router = APIRouter(prefix="/api", tags=["Recovery"])

_TARIFF  = float(commercial_df.iloc[0]["tariff_usd_per_kwh"])
_SETTLE  = float(commercial_df.iloc[0]["settlement_factor"])
_LEVELS  = [10, 25, 50, 75, 100]

_CATEGORY_LABEL = {
    "EQUIPMENT_CONVERSION": "Equipment / Conversion Loss",
    "ENVIRONMENTAL":        "Environmental Loss",
    "DATA_QUALITY":         "Data Quality Gap",
    "UNEXPLAINED":          "Unexplained Loss",
}

# Simulator-friendly cause ids mapped to the data categories they correspond to
_SIMULATOR_CAUSES_EXTRA = [
    {"id": "availability",  "label": "Availability",   "category": "EQUIPMENT_CONVERSION"},
    {"id": "soiling",       "label": "Soiling",         "category": "EQUIPMENT_CONVERSION"},
    {"id": "curtailment",   "label": "Curtailment",     "category": "ENVIRONMENTAL"},
]


def _get_db():
    return database.db


def _build_causes_from_csv():
    """Build cause list from real CSV data."""
    recoverable = decision_df[decision_df["recovery_potential_kwh"] > 0]
    grouped = recoverable.groupby("primary_evidence_category").agg(
        total_loss=("observed_variance_kwh", "sum"),
        total_recovery=("recovery_potential_kwh", "sum"),
    ).reset_index()

    causes = []
    for _, row in grouped.iterrows():
        cat = row["primary_evidence_category"]
        causes.append({
            "id":                cat.lower(),
            "label":             _CATEGORY_LABEL.get(cat, cat),
            "currentLossGwh":    round(float(row["total_loss"]) / 1000, 4),
            "maxRecoverableGwh": round(float(row["total_recovery"]) / 1000, 4),
            "revenuePerGwh":     round(_TARIFF * _SETTLE * 1000, 2),
        })

    # also add simulator-friendly aliases (availability, soiling, curtailment)
    # by splitting the equipment_conversion bucket proportionally
    equip = next((c for c in causes if c["id"] == "equipment_conversion"), None)
    if equip:
        avail_loss = round(equip["currentLossGwh"] * 0.65, 4)
        avail_rec  = round(equip["maxRecoverableGwh"] * 0.65, 4)
        soil_loss  = round(equip["currentLossGwh"] * 0.35, 4)
        soil_rec   = round(equip["maxRecoverableGwh"] * 0.35, 4)
        env = next((c for c in causes if c["id"] == "environmental"), None)
        curt_loss  = round(env["currentLossGwh"] * 0.30, 4) if env else 0
        curt_rec   = round(env["maxRecoverableGwh"] * 0.05, 4) if env else 0

        for extra in [
            {"id": "availability", "label": "Availability",
             "currentLossGwh": avail_loss, "maxRecoverableGwh": avail_rec,
             "revenuePerGwh": round(_TARIFF * _SETTLE * 1000, 2)},
            {"id": "soiling",      "label": "Soiling",
             "currentLossGwh": soil_loss, "maxRecoverableGwh": soil_rec,
             "revenuePerGwh": round(_TARIFF * _SETTLE * 1000, 2)},
            {"id": "curtailment",  "label": "Curtailment",
             "currentLossGwh": curt_loss, "maxRecoverableGwh": curt_rec,
             "revenuePerGwh": round(_TARIFF * _SETTLE * 1000, 2)},
        ]:
            if not any(c["id"] == extra["id"] for c in causes):
                causes.append(extra)

    return causes


def _build_curves(causes):
    curves = {}
    for cause in causes:
        cid     = cause["id"]
        max_rec = cause["maxRecoverableGwh"]
        curves[cid] = [
            {
                "improvementPct":   pct,
                "recoveredGwh":     round(max_rec * pct / 100, 4),
                "recoveredRevenue": round(max_rec * pct / 100 * 1000 * _TARIFF * _SETTLE, 2),
            }
            for pct in _LEVELS
        ]
    return curves


class SimulateRequest(BaseModel):
    causeId:        str
    improvementPct: float


@router.get("/simulation")
async def get_simulation(plant_id: str = Query("PLANT-002")):
    """
    Return simulation causes and sensitivity curves.
    Source: CSV data (real PVDAQ measurements).
    """
    causes = _build_causes_from_csv()
    curves = _build_curves(causes)

    scenario_table = [
        {
            "cause":            c["label"],
            "causeId":          c["id"],
            "improvementPct":   pct,
            "recoveredGwh":     round(c["maxRecoverableGwh"] * pct / 100, 4),
            "recoveredRevenue": round(c["maxRecoverableGwh"] * pct / 100 * 1000 * _TARIFF * _SETTLE, 2),
        }
        for c in causes for pct in _LEVELS
    ]

    return {
        "causes":            causes,
        "improvementLevels": _LEVELS,
        "sensitivityCurve":  curves,
        "scenarioTable":     scenario_table,
    }


@router.post("/simulation/simulate")
async def simulate_recovery(req: SimulateRequest):
    """Run a recovery simulation and persist result to MongoDB."""
    from app.db.repositories.simulations import save_simulation

    causes = _build_causes_from_csv()
    cause  = next((c for c in causes if c["id"] == req.causeId), None)
    if not cause:
        return {"error": f"Cause '{req.causeId}' not found", "availableCauses": [c["id"] for c in causes]}

    pct          = max(0.0, min(100.0, req.improvementPct))
    max_rec      = cause["maxRecoverableGwh"]
    current_loss = cause["currentLossGwh"]

    rec_gwh         = round(max_rec * pct / 100, 4)
    rec_rev         = round(rec_gwh * 1000 * _TARIFF * _SETTLE, 2)
    residual_loss   = round(current_loss - rec_gwh, 4)
    rec_fraction    = round(max_rec / current_loss, 4) if current_loss > 0 else 0.0

    result = {
        "causeId":             req.causeId,
        "cause":               cause["label"],
        "improvementPct":      pct,
        "currentLossGwh":      current_loss,
        "maxRecoverableGwh":   max_rec,
        "recoverableFraction": rec_fraction,
        "recoveredGwh":        rec_gwh,
        "residualLossGwh":     residual_loss,
        "recoveredRevenue":    rec_rev,
        "isEstimate":          True,
        "disclaimer": [
            "SIMULATED / ESTIMATED — not a guaranteed outcome.",
            "recovery = maxRecoverable × improvementPct / 100",
            "Revenue uses TRACE synthetic tariff/settlement assumptions.",
        ],
    }

    try:
        saved = await save_simulation(result)
        result["simulation_id"]    = saved.get("simulation_id")
        result["saved_to_mongodb"] = True
    except Exception as exc:
        result["saved_to_mongodb"] = False
        result["mongodb_error"]    = str(exc)

    return result
