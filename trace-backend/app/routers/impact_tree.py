"""
routers/impact_tree.py
GET /api/impact-tree  — tree nodes, edges, and metadata derived from real TRACE data.
"""

from fastapi import APIRouter, Query
from app.core.data_loader import recurrence_summary_df, commercial_df, decision_df

router = APIRouter(prefix="/api", tags=["Impact Tree"])

_STATUS_MAP = {
    "EQUIPMENT_CONVERSION": "critical",
    "ENVIRONMENTAL":        "warning",
    "DATA_QUALITY":         "neutral",
    "UNEXPLAINED":          "neutral",
}

_LABEL_MAP = {
    "EQUIPMENT_CONVERSION": "Equipment / Conversion",
    "ENVIRONMENTAL":        "Environmental",
    "DATA_QUALITY":         "Data Quality",
    "UNEXPLAINED":          "Unexplained",
}


@router.get("/impact-tree")
def get_impact_tree(plant_id: str = Query("PLANT-002", description="Plant ID")):
    comm      = commercial_df.iloc[0]
    total_gap = float(comm["generation_gap_kwh"])
    total_rev = float(comm["total_revenue_gap_usd"])
    exp_kwh   = float(comm["expected_generation_kwh"])
    act_kwh   = float(comm["actual_generation_kwh"])
    tariff    = float(comm["tariff_usd_per_kwh"])
    settle    = float(comm["settlement_factor"])

    nodes = []
    edges = []

    # Root node
    nodes.append({
        "id":              "root",
        "type":            "root",
        "label":           "Performance Gap",
        "sublabel":        f"-{round(total_gap / 1000, 1)} GWh · -{round((total_gap / exp_kwh) * 100, 1)}%",
        "description":     f"Total model-attributed performance gap: {round(total_gap/1000, 2)} GWh (${round(total_rev, 0):,.0f} revenue impact).",
        "lossGwh":         round(total_gap / 1000, 2),
        "contributionPct": 100.0,
        "confidence":      99,
        "status":          "critical",
        "classification": {
            "explainable":  True,
            "controllable": False,
            "recoverable":  False,
        },
        "evidenceIds":     ["MTR-229", "CALC-042"],
    })

    # Category nodes from recurrence summary
    for _, row in recurrence_summary_df.iterrows():
        cat       = row["primary_evidence_category"]
        cat_id    = cat.lower()
        loss_kwh  = float(row["total_observed_variance_kwh"])
        loss_gwh  = round(loss_kwh / 1000, 2)
        rec_class = str(row["recurrence_class"])
        ep_count  = int(row["episode_count"])
        freq_pct  = round(float(row["episode_frequency_pct"]), 1)
        contrib   = round((loss_kwh / total_gap) * 100, 1) if total_gap else 0.0

        status = _STATUS_MAP.get(cat, "neutral")
        if rec_class == "POTENTIALLY_STRUCTURAL":
            status = "critical"
        elif rec_class == "RECURRING":
            status = "warning"

        is_equip = (cat == "EQUIPMENT_CONVERSION")

        nodes.append({
            "id":              cat_id,
            "type":            "category",
            "category":        _LABEL_MAP.get(cat, cat),
            "label":           _LABEL_MAP.get(cat, cat),
            "sublabel":        f"-{loss_gwh} GWh · {contrib}%",
            "description":     f"{_LABEL_MAP.get(cat, cat)} variance: {loss_gwh} GWh ({ep_count} episodes, {rec_class.replace('_', ' ').title()}).",
            "lossGwh":         loss_gwh,
            "contributionPct": contrib,
            "confidence":      92 if is_equip else 85,
            "status":          status,
            "classification": {
                "explainable":  cat != "UNEXPLAINED",
                "controllable": is_equip,
                "recoverable":  is_equip,
            },
            "evidenceIds":     ["EVT-102"] if is_equip else ["WX-001"] if cat == "ENVIRONMENTAL" else ["MTR-229"],
            "parentId":        "root",
        })
        edges.append({
            "id":     f"root-{cat_id}",
            "source": "root",
            "target": cat_id,
            "type":   "contributes_to",
        })

        # Top 3 episode nodes per category
        cat_eps = (
            decision_df[decision_df["primary_evidence_category"] == cat]
            .sort_values("observed_variance_kwh", ascending=False)
            .head(3)
        )

        for _, ep in cat_eps.iterrows():
            ep_id     = str(ep["episode_id"]).lower()
            ep_loss   = float(ep["observed_variance_kwh"])
            ep_rec    = float(ep.get("recovery_potential_kwh", 0))
            ep_status = "success" if ep_rec > 0 else "neutral"
            ep_loss_g = round(ep_loss / 1000, 3)
            ep_rec_g  = round(ep_rec / 1000, 3)
            ep_rev    = round(ep_rec * tariff * settle, 2)
            conf_str  = str(ep.get("attribution_confidence", "MEDIUM"))
            conf_val  = 90 if conf_str == "HIGH" else 72 if conf_str == "MEDIUM" else 50

            nodes.append({
                "id":              ep_id,
                "type":            "cause",
                "category":        _LABEL_MAP.get(cat, cat),
                "label":           str(ep["episode_id"]),
                "sublabel":        f"-{round(ep_loss, 1)} kWh · {str(ep.get('priority', 'MONITOR'))}",
                "description":     f"Episode {ep['episode_id']}: {round(ep_loss, 1)} kWh variance. Priority: {ep.get('priority', 'MONITOR')}. Recommended: {ep.get('recommended_action', 'INVESTIGATE')}.",
                "lossGwh":         ep_loss_g,
                "contributionPct": round((ep_loss / loss_kwh) * 100, 1) if loss_kwh else 0.0,
                "confidence":      conf_val,
                "status":          ep_status,
                "classification": {
                    "explainable":  True,
                    "controllable": is_equip,
                    "recoverable":  ep_rec > 0,
                },
                "recurrence": {
                    "occurrences":     ep_count,
                    "eligiblePeriods": 6,
                    "frequencyPct":    freq_pct,
                    "status":          rec_class.replace("_", " ").title(),
                },
                "recovery": {
                    "potentialGwh":     ep_rec_g,
                    "potentialRevenue": ep_rev,
                } if ep_rec > 0 else None,
                "evidenceIds":     [str(ep["episode_id"])],
                "parentId":        cat_id,
            })
            edges.append({
                "id":     f"{cat_id}-{ep_id}",
                "source": cat_id,
                "target": ep_id,
                "type":   "caused_by" if is_equip else "related_to",
            })

    return {
        "rootId": "root",
        "metadata": {
            "assetId":      "solar-alpha",
            "period":       "May 2026",
            "plantName":    "Solar Plant Alpha",
            "expectedGwh":  round(exp_kwh / 1000, 2),
            "actualGwh":    round(act_kwh / 1000, 2),
            "totalLossGwh": round(total_gap / 1000, 2),
        },
        "nodes": nodes,
        "edges": edges,
    }
