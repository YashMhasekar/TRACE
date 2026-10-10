"""
app/services/analysis_pipeline.py
TRACE Analysis Pipeline Orchestrator

Runs the complete TRACE investigation pipeline on an uploaded CSV dataset.
Every stage performs REAL computation and updates MongoDB with genuine results.

Pipeline stages:
  1. dataset_ingestion    - load + parse uploaded CSV
  2. data_quality         - validate completeness, sampling, ranges
  3. column_mapping       - detect/confirm required column mapping
  4. normalization        - standardise column names, timestamps, units
  5. expected_generation  - train GBR on reference period, predict expected AC
  6. variance             - expected vs actual, compute performance gap
  7. attribution          - evidence-weighted multi-factor attribution
  8. evidence             - build DC/AC/POA evidence chain per episode
  9. recurrence           - cluster episodes, detect patterns
 10. recoverability       - classify loss by controllability
 11. recommendations      - generate prioritised action list + persist results
"""

import asyncio
import io
import logging
from datetime import datetime, timezone

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from app.db.repositories.analysis_runs import (
    add_event,
    set_results,
    set_stage_completed,
    set_stage_failed,
    set_stage_running,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
NAMEPLATE_KW        = 720.72
LOW_IRR_THRESH      = 10.0
MIN_TRAIN_POA       = 100.0
INTERVAL_HRS        = 0.25
SIGNIFICANT_VAR_PCT = 40.0
HIGH_POA_THRESH     = 300.0
DC_AC_RATIO_LOW     = 0.30
MODEL_CONFIG = {
    "n_estimators":  150,
    "learning_rate": 0.05,
    "max_depth":     3,
    "random_state":  42,
}

CAT_LABEL = {
    "EQUIPMENT_CONVERSION": "Equipment / Conversion Loss",
    "ENVIRONMENTAL":        "Environmental Loss",
    "DATA_QUALITY":         "Data Quality Gap",
    "UNEXPLAINED":          "Unexplained Loss",
}

# Column auto-detection: TRACE internal name -> possible CSV column names
COLUMN_HEURISTICS = {
    "timestamp":   ["measured_on", "timestamp", "time", "datetime", "date_time", "date"],
    "poa":         ["poa_irradiance__5041", "poa_irradiance", "poa", "irradiance", "ghi"],
    "module_temp": ["module_temp__5043", "module_temp", "module_temperature", "tmod"],
    "dc_power":    ["dc_power__5077", "dc_power", "dc", "pdc"],
    "ac_power":    ["ac_power__5074", "ac_power", "ac", "pac", "inverter_ac"],
    "ambient_temp":["ambient_temp__5042", "ambient_temp", "tamb", "air_temp"],
    "pr":          ["pr__5047", "performance_ratio", "pr"],
}
REQUIRED_FIELDS = {"timestamp", "poa", "module_temp", "ac_power"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now():
    return datetime.now(timezone.utc)


async def _log(aid: str, msg: str, level: str = "info"):
    await add_event(aid, msg, level=level)
    logger.info("[%s] %s", aid, msg)


def _detect_columns(df: pd.DataFrame) -> dict:
    cols_lower = {c.lower(): c for c in df.columns}
    mapping = {}
    for field, candidates in COLUMN_HEURISTICS.items():
        for cand in candidates:
            if cand in cols_lower:
                mapping[field] = cols_lower[cand]
                break
    return mapping


def _domain_constrain(series: pd.Series, poa: pd.Series) -> pd.Series:
    out = series.clip(lower=0, upper=NAMEPLATE_KW).copy()
    out[poa < LOW_IRR_THRESH] = 0.0
    return out


# ---------------------------------------------------------------------------
# Pipeline entry point
# ---------------------------------------------------------------------------

async def run_pipeline(analysis_id: str, csv_bytes: bytes, config: dict):
    try:
        await _run(analysis_id, csv_bytes, config)
    except Exception as exc:
        logger.exception("[%s] top-level error: %s", analysis_id, exc)
        # Best-effort: mark the run as failed so the frontend doesn't poll forever
        try:
            from app.core import database as _db
            if _db.db is not None:
                await _db.db["analysis_runs"].update_one(
                    {"analysis_id": analysis_id},
                    {"$set": {
                        "status":     "failed",
                        "updated_at": datetime.now(timezone.utc),
                    }},
                )
                await add_event(
                    analysis_id,
                    f"Unhandled error: {exc}",
                    level="error",
                )
        except Exception as inner:
            logger.exception("[%s] failed to persist top-level error: %s", analysis_id, inner)


async def _run(analysis_id: str, csv_bytes: bytes, config: dict):
    PROGRESS = {
        "dataset_ingestion":    9,
        "data_quality":        18,
        "column_mapping":      27,
        "normalization":       36,
        "expected_generation": 50,
        "variance":            60,
        "attribution":         70,
        "evidence":            78,
        "recurrence":          85,
        "recoverability":      92,
        "recommendations":    100,
    }

    try:
        await _log(analysis_id, "Pipeline started")

        # ── Stage 1: Dataset Ingestion ─────────────────────────────────────
        await set_stage_running(analysis_id, "dataset_ingestion", 2)
        await _log(analysis_id, "Loading CSV data into memory")
        try:
            df_raw = pd.read_csv(io.BytesIO(csv_bytes), low_memory=False)
        except Exception as exc:
            await set_stage_failed(analysis_id, "dataset_ingestion", "CSV parse error", str(exc))
            return
        n_rows, n_cols = df_raw.shape
        await _log(analysis_id, f"{n_rows:,} rows, {n_cols} columns detected")
        await set_stage_completed(analysis_id, "dataset_ingestion", PROGRESS["dataset_ingestion"],
                                  {"rows": n_rows, "columns": n_cols})

        # ── Stage 2: Data Quality ──────────────────────────────────────────
        await set_stage_running(analysis_id, "data_quality", PROGRESS["dataset_ingestion"] + 2)
        await _log(analysis_id, "Running data quality validation")

        col_map  = _detect_columns(df_raw)
        ts_col   = col_map.get("timestamp")
        ac_col   = col_map.get("ac_power")
        poa_col  = col_map.get("poa")

        missing_ts  = int(df_raw[ts_col].isna().sum())  if ts_col  else n_rows
        missing_ac  = int(df_raw[ac_col].isna().sum())  if ac_col  else n_rows
        missing_poa = int(df_raw[poa_col].isna().sum()) if poa_col else n_rows
        dup_rows    = int(df_raw.duplicated().sum())

        # valid_rows: rows that have a timestamp and AC power reading
        valid_rows = n_rows - missing_ac - dup_rows

        # Sampling consistency
        sampling_ok  = False
        interval_min = None
        if ts_col:
            try:
                ts_s = pd.to_datetime(df_raw[ts_col], utc=False, errors="coerce").sort_values()
                diffs = ts_s.diff().dropna()
                mode_d = diffs.mode()
                if len(mode_d):
                    interval_min = round(mode_d.iloc[0].total_seconds() / 60, 1)
                    sampling_ok  = bool((diffs == mode_d.iloc[0]).mean() >= 0.95)
            except Exception:
                pass

        if valid_rows < 100:
            await set_stage_failed(analysis_id, "data_quality",
                                   "Insufficient valid data",
                                   f"Only {valid_rows} usable rows (need >=100).")
            return

        dq_warnings = []
        if missing_ts  > 0:                    dq_warnings.append(f"{missing_ts} missing timestamps")
        if missing_ac  > n_rows * 0.10:        dq_warnings.append(f"High AC missingness: {missing_ac} rows")
        if not poa_col:                        dq_warnings.append("POA column not found")

        await set_stage_completed(analysis_id, "data_quality", PROGRESS["data_quality"], {
            "total_rows":       n_rows,
            "valid_rows":       valid_rows,
            "missing_ts":       missing_ts,
            "missing_ac":       missing_ac,
            "missing_poa":      missing_poa,
            "duplicate_rows":   dup_rows,
            "interval_minutes": float(interval_min) if interval_min is not None else None,
            "sampling_ok":      bool(sampling_ok),
            "detected_fields":  list(col_map.keys()),
        }, warnings=dq_warnings or None)

        # ── Stage 3: Column Mapping ────────────────────────────────────────
        await set_stage_running(analysis_id, "column_mapping", PROGRESS["data_quality"] + 2)
        missing_req = [f for f in REQUIRED_FIELDS if f not in col_map]
        if missing_req:
            await set_stage_failed(analysis_id, "column_mapping",
                                   f"Required columns not found: {missing_req}",
                                   f"Available: {list(df_raw.columns)[:20]}")
            return
        await set_stage_completed(analysis_id, "column_mapping", PROGRESS["column_mapping"], {
            "mapping":       col_map,
            "optional_found": [k for k in col_map if k not in REQUIRED_FIELDS],
        })

        # ── Stage 4: Normalization ─────────────────────────────────────────
        await set_stage_running(analysis_id, "normalization", PROGRESS["column_mapping"] + 2)

        df = pd.DataFrame()
        df["timestamp"]   = pd.to_datetime(df_raw[col_map["timestamp"]], errors="coerce")
        df["poa"]         = pd.to_numeric(df_raw[col_map["poa"]], errors="coerce")
        df["module_temp"] = pd.to_numeric(df_raw[col_map["module_temp"]], errors="coerce")
        df["ac_power_kw"] = pd.to_numeric(df_raw[col_map["ac_power"]], errors="coerce")
        if col_map.get("dc_power"):
            df["dc_power_kw"] = pd.to_numeric(df_raw[col_map["dc_power"]], errors="coerce")
        if col_map.get("pr"):
            df["pr"]          = pd.to_numeric(df_raw[col_map["pr"]], errors="coerce")
        if col_map.get("ambient_temp"):
            df["ambient_temp"] = pd.to_numeric(df_raw[col_map["ambient_temp"]], errors="coerce")

        df = df.sort_values("timestamp").dropna(subset=["timestamp"]).reset_index(drop=True)
        ts_min, ts_max = df["timestamp"].min(), df["timestamp"].max()
        date_range_str = f"{ts_min.strftime('%Y-%m-%d')} to {ts_max.strftime('%Y-%m-%d')}"

        # Reference / evaluation split
        ref_cfg = config.get("reference_period", "auto")
        if ref_cfg == "auto":
            ref_month, ref_year = ts_min.month, ts_min.year
            eval_start = ts_min.replace(day=1) + pd.DateOffset(months=1)
        else:
            try:
                ref_dt = pd.to_datetime(ref_cfg + "-01")
                ref_month, ref_year = ref_dt.month, ref_dt.year
                eval_start = ref_dt + pd.DateOffset(months=1)
            except Exception:
                ref_month, ref_year = ts_min.month, ts_min.year
                eval_start = ts_min.replace(day=1) + pd.DateOffset(months=1)

        df_ref  = df[(df["timestamp"].dt.month == ref_month) &
                     (df["timestamp"].dt.year  == ref_year)].copy()
        df_eval = df[df["timestamp"] >= eval_start].copy()

        await _log(analysis_id, f"Date range: {date_range_str}")
        await _log(analysis_id, f"Reference: {ref_year}-{ref_month:02d} ({len(df_ref)} rows)")
        await _log(analysis_id, f"Evaluation: from {eval_start.strftime('%Y-%m-%d')} ({len(df_eval)} rows)")

        if len(df_ref)  < 50:
            await set_stage_failed(analysis_id, "normalization",
                                   "Insufficient reference period data",
                                   f"Only {len(df_ref)} rows (need >=50).")
            return
        if len(df_eval) < 50:
            await set_stage_failed(analysis_id, "normalization",
                                   "Insufficient evaluation period data",
                                   f"Only {len(df_eval)} rows (need >=50).")
            return

        await set_stage_completed(analysis_id, "normalization", PROGRESS["normalization"], {
            "date_range":        date_range_str,
            "total_rows":        len(df),
            "reference_rows":    len(df_ref),
            "evaluation_rows":   len(df_eval),
            "ref_period":        f"{ref_year}-{ref_month:02d}",
            "eval_period_start": eval_start.strftime("%Y-%m"),
            "interval_minutes":  interval_min,
        })
        await asyncio.sleep(0)

        # ── Stage 5: Expected Generation Model ────────────────────────────
        await set_stage_running(analysis_id, "expected_generation", PROGRESS["normalization"] + 2)
        await _log(analysis_id, "Training expected-generation model on reference period")

        train = df_ref.dropna(subset=["poa", "module_temp", "ac_power_kw"])
        train = train[(train["poa"] > MIN_TRAIN_POA) & (train["ac_power_kw"] > 0)]

        if len(train) < 30:
            await set_stage_failed(analysis_id, "expected_generation",
                                   "Insufficient training observations",
                                   f"Only {len(train)} quality rows (need >=30).")
            return

        model = GradientBoostingRegressor(**MODEL_CONFIG)
        model.fit(train[["poa", "module_temp"]], train["ac_power_kw"])
        train_pred = model.predict(train[["poa", "module_temp"]])

        t_mae  = float(mean_absolute_error(train["ac_power_kw"], train_pred))
        t_rmse = float(np.sqrt(mean_squared_error(train["ac_power_kw"], train_pred)))
        t_r2   = float(r2_score(train["ac_power_kw"], train_pred))
        t_mean = float(train["ac_power_kw"].mean())
        t_nmae = (t_mae / t_mean * 100) if t_mean > 0 else 0.0

        feat_imp = {
            "poa":         round(float(model.feature_importances_[0]), 4),
            "module_temp": round(float(model.feature_importances_[1]), 4),
        }

        # Predict on eval period
        ve = df_eval.dropna(subset=["poa", "module_temp"]).copy()
        ve["expected_kw"]  = _domain_constrain(
            pd.Series(model.predict(ve[["poa", "module_temp"]]), index=ve.index),
            ve["poa"]
        )
        ve["expected_kwh"] = ve["expected_kw"] * INTERVAL_HRS
        df_eval = df_eval.merge(ve[["timestamp", "expected_kw", "expected_kwh"]],
                                on="timestamp", how="left")

        ec = df_eval.dropna(subset=["ac_power_kw", "expected_kw"])
        ec = ec[ec["expected_kw"] > 0]
        if len(ec) > 0:
            e_mae  = float(mean_absolute_error(ec["ac_power_kw"], ec["expected_kw"]))
            e_rmse = float(np.sqrt(mean_squared_error(ec["ac_power_kw"], ec["expected_kw"])))
            e_r2   = float(r2_score(ec["ac_power_kw"], ec["expected_kw"]))
            e_mean = float(ec["ac_power_kw"].mean())
            e_nmae = (e_mae / e_mean * 100) if e_mean > 0 else 0.0
        else:
            e_mae = e_rmse = e_r2 = e_nmae = 0.0

        total_expected_kwh = float(df_eval["expected_kwh"].sum())
        total_actual_kwh   = float((df_eval["ac_power_kw"] * INTERVAL_HRS).sum())

        await _log(analysis_id, f"R2={t_r2:.4f} (train), R2={e_r2:.4f} (eval)")
        await _log(analysis_id, f"Expected: {total_expected_kwh:,.1f} kWh  Actual: {total_actual_kwh:,.1f} kWh")

        eg_metrics = {
            "training_obs":      len(train),
            "eval_obs":          len(ec),
            "training_mae_kw":   round(t_mae,  3),
            "training_rmse_kw":  round(t_rmse, 3),
            "training_r2":       round(t_r2,   4),
            "training_nmae_pct": round(t_nmae, 2),
            "eval_mae_kw":       round(e_mae,  3),
            "eval_rmse_kw":      round(e_rmse, 3),
            "eval_r2":           round(e_r2,   4),
            "eval_nmae_pct":     round(e_nmae, 2),
            "feature_importance": feat_imp,
            "total_expected_kwh": round(total_expected_kwh, 2),
            "total_actual_kwh":   round(total_actual_kwh,   2),
        }
        await set_stage_completed(analysis_id, "expected_generation",
                                  PROGRESS["expected_generation"], eg_metrics)
        await asyncio.sleep(0)

        # ── Stage 6: Variance ──────────────────────────────────────────────
        await set_stage_running(analysis_id, "variance", PROGRESS["expected_generation"] + 2)
        df_eval["actual_kwh"]   = df_eval["ac_power_kw"] * INTERVAL_HRS
        df_eval["variance_kwh"] = df_eval["expected_kwh"] - df_eval["actual_kwh"]
        df_eval["variance_pct"] = (
            df_eval["variance_kwh"] / df_eval["expected_kwh"].replace(0, np.nan) * 100
        )

        total_variance_kwh = float(df_eval["variance_kwh"].sum())
        variance_pct_total = (total_variance_kwh / total_expected_kwh * 100
                              if total_expected_kwh > 0 else 0.0)
        sig_intervals      = int((df_eval["variance_pct"].abs() > SIGNIFICANT_VAR_PCT).sum())
        period_overperf    = total_actual_kwh >= total_expected_kwh

        await _log(analysis_id,
                   f"Variance: {total_variance_kwh:,.1f} kWh ({variance_pct_total:.2f}%)"
                   + (" [overperformance period]" if period_overperf else ""))

        await set_stage_completed(analysis_id, "variance", PROGRESS["variance"], {
            "expected_kwh":          round(total_expected_kwh, 2),
            "actual_kwh":            round(total_actual_kwh, 2),
            "variance_kwh":          round(total_variance_kwh, 2),
            "variance_pct":          round(variance_pct_total, 2),
            "significant_intervals": sig_intervals,
            "eval_period_start":     eval_start.strftime("%Y-%m-%d"),
            "period_overperformance": bool(period_overperf),
        }, warnings=["Period net actual >= expected — plant overperformed vs model baseline; "
                     "local underperformance episodes are still reported."] if period_overperf else None)
        await asyncio.sleep(0)

        # ── Stage 7: Attribution ───────────────────────────────────────────
        await set_stage_running(analysis_id, "attribution", PROGRESS["variance"] + 2)
        await _log(analysis_id, "Running evidence-weighted attribution engine")

        # Vectorised classification
        has_both = df_eval["poa"].notna() & df_eval["ac_power_kw"].notna()
        is_sig   = (df_eval["variance_pct"].abs() > SIGNIFICANT_VAR_PCT) & has_both
        low_poa  = df_eval["poa"] < HIGH_POA_THRESH
        high_poa = ~low_poa
        ac_vs_exp = df_eval["ac_power_kw"] < df_eval["expected_kw"].fillna(0) * 0.5

        if "dc_power_kw" in df_eval.columns:
            dc_kw_s  = df_eval["dc_power_kw"].where(
                df_eval["dc_power_kw"] <= 1000, df_eval["dc_power_kw"] / 1000)
            dc_ratio = df_eval["ac_power_kw"] / dc_kw_s.replace(0, np.nan)
            dc_low   = (dc_ratio < DC_AC_RATIO_LOW) & df_eval["dc_power_kw"].notna()
        else:
            dc_low   = pd.Series(False, index=df_eval.index)

        df_eval["category"] = None
        df_eval.loc[~has_both, "category"] = "DATA_QUALITY"
        df_eval.loc[is_sig & low_poa  & (df_eval["ac_power_kw"] < df_eval["expected_kw"].fillna(0) * 0.6),
                    "category"] = "ENVIRONMENTAL"
        df_eval.loc[is_sig & high_poa & dc_low,              "category"] = "EQUIPMENT_CONVERSION"
        df_eval.loc[is_sig & high_poa & ~dc_low & ac_vs_exp, "category"] = "EQUIPMENT_CONVERSION"
        df_eval.loc[is_sig & df_eval["category"].isna(),      "category"] = "UNEXPLAINED"

        await asyncio.sleep(0)

        # Episode grouping
        episodes, ep_id = [], 0
        cat_s = df_eval["category"].fillna("__NONE__")
        mask  = df_eval["category"].notna()
        if mask.any():
            grp_ids = (cat_s != cat_s.shift()).cumsum()
            for _, grp in df_eval[mask].groupby(grp_ids[mask]):
                cat = grp["category"].iloc[0]
                if cat and cat != "__NONE__":
                    ep_id += 1
                    episodes.append(_build_episode(ep_id, grp, cat))

        await asyncio.sleep(0)

        # Aggregate
        agg = {}
        for ep in episodes:
            c = ep["category"]
            if c not in agg:
                agg[c] = {"loss_kwh": 0.0, "episodes": 0}
            agg[c]["loss_kwh"] += ep["variance_kwh"]
            agg[c]["episodes"] += 1

        # Use total EPISODE loss as denominator — correct even when period is overperformance
        total_ep_loss = sum(v["loss_kwh"] for v in agg.values())
        denom         = total_ep_loss if total_ep_loss > 0 else 1.0

        attribution_list = []
        for cat, v in sorted(agg.items(), key=lambda x: -x[1]["loss_kwh"]):
            attribution_list.append({
                "category":      cat,
                "label":         CAT_LABEL.get(cat, cat),
                "loss_kwh":      round(v["loss_kwh"], 3),
                "episode_count": v["episodes"],
                "loss_pct":      round(v["loss_kwh"] / denom * 100, 2),
                "confidence":    "HIGH" if cat == "EQUIPMENT_CONVERSION" else "MEDIUM",
                "controllable":  cat == "EQUIPMENT_CONVERSION",
                "recoverable":   cat == "EQUIPMENT_CONVERSION",
            })

        await _log(analysis_id,
                   f"Attribution complete: {len(episodes)} episodes, "
                   f"{total_ep_loss:,.1f} kWh total episode loss")
        await set_stage_completed(analysis_id, "attribution", PROGRESS["attribution"], {
            "total_episodes":       len(episodes),
            "attribution":          attribution_list,
            "total_attributed_kwh": round(total_ep_loss, 2),
            "unexplained_kwh":      0.0,
        })
        await asyncio.sleep(0)

        # ── Stage 8: Evidence ──────────────────────────────────────────────
        await set_stage_running(analysis_id, "evidence", PROGRESS["attribution"] + 2)
        top_eps = sorted(episodes, key=lambda e: -e["variance_kwh"])[:15]
        evidence_items = [{
            "id":               ep["episode_id"],
            "category":         ep["category"],
            "label":            CAT_LABEL.get(ep["category"], ep["category"]),
            "timestamp_start":  ep["timestamp_start"],
            "timestamp_end":    ep["timestamp_end"],
            "duration_minutes": ep["duration_minutes"],
            "variance_kwh":     ep["variance_kwh"],
            "confidence":       ep["confidence"],
            "poa_level":        ep.get("poa_level", "unknown"),
            "dc_available":     "dc_power_kw" in df_eval.columns,
            "proof_statement":  ep.get("proof_statement", ""),
        } for ep in top_eps]

        high_conf = sum(1 for e in evidence_items if e["confidence"] == "HIGH")
        await _log(analysis_id, f"Evidence: {len(evidence_items)} items, {high_conf} HIGH confidence")
        await set_stage_completed(analysis_id, "evidence", PROGRESS["evidence"], {
            "evidence_count":  len(evidence_items),
            "high_confidence": high_conf,
            "items":           evidence_items,
        })

        # ── Stage 9: Recurrence ────────────────────────────────────────────
        await set_stage_running(analysis_id, "recurrence", PROGRESS["evidence"] + 2)
        rec_agg = {}
        for ep in episodes:
            c = ep["category"]
            if c not in rec_agg:
                rec_agg[c] = {"count": 0, "loss_kwh": 0.0, "months": set()}
            rec_agg[c]["count"]    += 1
            rec_agg[c]["loss_kwh"] += ep["variance_kwh"]
            try:
                rec_agg[c]["months"].add(pd.to_datetime(ep["timestamp_start"]).strftime("%Y-%m"))
            except Exception:
                pass

        recurrence_list = []
        for c, d in sorted(rec_agg.items(), key=lambda x: -x[1]["count"]):
            freq = (d["count"] / len(episodes) * 100) if episodes else 0
            nm   = len(d["months"])
            rcls = ("POTENTIALLY_STRUCTURAL" if nm >= 2 and freq >= 50
                    else "REPEATED" if d["count"] >= 3
                    else "ISOLATED")
            recurrence_list.append({
                "category":       c,
                "label":          CAT_LABEL.get(c, c),
                "episode_count":  d["count"],
                "total_loss_kwh": round(d["loss_kwh"], 2),
                "frequency_pct":  round(freq, 1),
                "months_observed": nm,
                "recurrence_class": rcls,
                "recurrence_score": round(min(freq / 10, 10), 1),
            })

        rec_warn = (["Single-month evaluation — recurrence patterns may be limited"]
                    if len(set(df_eval["timestamp"].dt.strftime("%Y-%m"))) < 2 else [])
        await set_stage_completed(analysis_id, "recurrence", PROGRESS["recurrence"], {
            "summary":        recurrence_list,
            "total_episodes": len(episodes),
        }, warnings=rec_warn or None)
        await asyncio.sleep(0)

        # ── Stage 10: Recoverability ───────────────────────────────────────
        await set_stage_running(analysis_id, "recoverability", PROGRESS["recurrence"] + 2)

        controllable_kwh = round(sum(a["loss_kwh"] for a in attribution_list if a.get("controllable")), 2)
        unavoidable_kwh  = round(sum(a["loss_kwh"] for a in attribution_list if not a.get("controllable")), 2)
        recoverable_kwh  = round(controllable_kwh * 0.60, 2)
        uncertain_kwh    = 0.0

        tariff     = config.get("tariff_usd_per_kwh")
        settlement = float(config.get("settlement_factor", 1.0))
        commercial = None
        if tariff and total_ep_loss > 0:
            commercial = {
                "total_loss_kwh":      round(total_ep_loss, 2),
                "revenue_impact":      round(total_ep_loss   * tariff, 2),
                "recoverable_revenue": round(recoverable_kwh * tariff * settlement, 2),
                "tariff_usd_per_kwh":  tariff,
                "settlement_factor":   settlement,
            }
        else:
            await _log(analysis_id, "No tariff provided — commercial impact skipped", "warning")

        rec_metrics = {
            "total_loss_kwh":          round(total_ep_loss, 2),
            "period_net_variance_kwh": round(total_variance_kwh, 2),
            "controllable_kwh":        controllable_kwh,
            "recoverable_kwh":         recoverable_kwh,
            "unavoidable_kwh":         unavoidable_kwh,
            "uncertain_kwh":           uncertain_kwh,
            "recovery_factor_pct":     60,
            "commercial":              commercial,
            "overperformance_note": (
                "Period net actual >= model expected. Episode losses are localised intervals."
            ) if period_overperf else None,
        }
        await set_stage_completed(analysis_id, "recoverability", PROGRESS["recoverability"],
                                  rec_metrics,
                                  warnings=["No maintenance records — telemetry-only estimate",
                                            "No tariff — commercial impact not calculated"]
                                           if not tariff else
                                           ["No maintenance records — telemetry-only estimate"])
        await _log(analysis_id, f"Recoverable: {recoverable_kwh:,.1f} kWh")

        # ── Stage 11: Recommendations ──────────────────────────────────────
        await set_stage_running(analysis_id, "recommendations", PROGRESS["recoverability"] + 2)
        recommendations = []
        for attr in attribution_list:
            if not attr.get("controllable"):
                continue
            rec_ep = next((r for r in recurrence_list if r["category"] == attr["category"]), {})
            rc     = rec_ep.get("recurrence_class", "ISOLATED")
            prio   = "HIGH" if rc in ("POTENTIALLY_STRUCTURAL", "REPEATED") else "MEDIUM"
            recommendations.append({
                "category":        attr["category"],
                "label":           attr["label"],
                "priority":        prio,
                "action":          ("Investigate inverter conversion efficiency and DC/AC ratio. "
                                    "Schedule maintenance inspection."),
                "loss_kwh":        attr["loss_kwh"],
                "recoverable_kwh": round(attr["loss_kwh"] * 0.60, 2),
                "recurrence":      rc,
                "confidence":      attr["confidence"],
            })

        if not recommendations:
            recommendations.append({
                "category":        "GENERAL",
                "label":           "General Monitoring",
                "priority":        "LOW",
                "action":          "Continue monitoring. Insufficient evidence for specific actions.",
                "loss_kwh":        round(total_ep_loss, 2),
                "recoverable_kwh": 0.0,
                "recurrence":      "ISOLATED",
                "confidence":      "LOW",
            })

        # ── Final results ──────────────────────────────────────────────────
        final_results = {
            "analysis_id":      analysis_id,
            "plant_name":       config.get("plant_name", "Uploaded Plant"),
            "dataset_filename": config.get("filename", "dataset.csv"),
            "period":           date_range_str,
            "ref_period":       f"{ref_year}-{ref_month:02d}",
            "eval_period":      eval_start.strftime("%Y-%m"),
            "performance": {
                "expected_kwh":          round(total_expected_kwh, 2),
                "actual_kwh":            round(total_actual_kwh, 2),
                "variance_kwh":          round(total_variance_kwh, 2),
                "variance_pct":          round(variance_pct_total, 2),
                "episode_total_loss_kwh": round(total_ep_loss, 2),
                "overperformance":       bool(period_overperf),
            },
            "model":          eg_metrics,
            "data_quality": {
                "total_rows":   n_rows,
                "valid_rows":   valid_rows,
                "interval_min": float(interval_min) if interval_min is not None else None,
                "missing_ac":   missing_ac,
                "missing_poa":  missing_poa,
            },
            "attribution":    attribution_list,
            "evidence":       evidence_items,
            "recurrence":     recurrence_list,
            "recoverability": rec_metrics,
            "commercial":     commercial,
            "recommendations": recommendations,
            "total_episodes": len(episodes),
        }

        await set_results(analysis_id, final_results)
        await set_stage_completed(analysis_id, "recommendations", 100, {"count": len(recommendations)})
        await _log(analysis_id, f"Analysis complete — {len(recommendations)} recommendations")
        await _log(analysis_id, f"Analysis ID: {analysis_id}")

    except Exception as exc:
        logger.exception("[%s] pipeline error: %s", analysis_id, exc)
        await add_event(analysis_id, f"Pipeline error: {exc}", level="error")
        try:
            from app.core import database as _db
            if _db.db is not None:
                await _db.db["analysis_runs"].update_one(
                    {"analysis_id": analysis_id},
                    {"$set": {"status": "failed", "updated_at": _now()}},
                )
        except Exception:
            pass


def _build_episode(ep_id: int, rows: pd.DataFrame, category: str) -> dict:
    var_kwh   = float(rows["variance_kwh"].sum()) if "variance_kwh" in rows else 0.0
    ts_start  = str(rows["timestamp"].iloc[0])  if len(rows) else ""
    ts_end    = str(rows["timestamp"].iloc[-1]) if len(rows) else ""
    poa_vals  = rows["poa"].dropna()
    poa_mean  = float(poa_vals.mean()) if len(poa_vals) else 0.0
    poa_level = "high" if poa_mean >= HIGH_POA_THRESH else "low"

    if   category == "EQUIPMENT_CONVERSION":
        proof = (f"POA={poa_mean:.0f} W/m2 with low AC output — "
                 f"possible equipment/conversion-side issue.")
    elif category == "ENVIRONMENTAL":
        proof = f"Low irradiance ({poa_mean:.0f} W/m2) accounts for reduced generation."
    elif category == "DATA_QUALITY":
        proof = "Missing or invalid sensor readings in this interval."
    else:
        proof = "Insufficient evidence to attribute to a specific cause."

    return {
        "episode_id":       f"EP-{ep_id:04d}",
        "category":         category,
        "timestamp_start":  ts_start,
        "timestamp_end":    ts_end,
        "duration_minutes": len(rows) * 15,
        "variance_kwh":     round(var_kwh, 3),
        "poa_level":        poa_level,
        "confidence":       "HIGH" if category == "EQUIPMENT_CONVERSION" else "MEDIUM",
        "proof_statement":  proof,
    }
