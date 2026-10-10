"""
data_loader.py
Loads all TRACE processed CSVs and the trained ML model once at startup.
All routers import from here — no CSV is read more than once.

Data directory layout (relative to this file):
    trace-backend/
        app/
            core/
                data_loader.py   ← __file__
        data/
            processed/           ← _DATA_DIR  (../../data/processed)
"""

import os
import joblib
import pandas as pd

# Path to the processed data directory bundled inside trace-backend/.
# Resolves to:  trace-backend/data/processed/
_DATA_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "data", "processed")
)


def _csv(name: str) -> str:
    return os.path.join(_DATA_DIR, name)


# ── Load all datasets ──────────────────────────────────────────────────────

attribution_df        = pd.read_csv(_csv("trace_attribution.csv"), parse_dates=["timestamp"])
commercial_df         = pd.read_csv(_csv("trace_commercial_impact.csv"))
decision_df           = pd.read_csv(_csv("trace_decision_intelligence.csv"), parse_dates=["timestamp_start", "timestamp_end"])
episode_attr_df       = pd.read_csv(_csv("trace_episode_attribution.csv"), parse_dates=["timestamp_start", "timestamp_end"])
episode_financial_df  = pd.read_csv(_csv("trace_episode_financial_impact.csv"), parse_dates=["timestamp_start", "timestamp_end"])
episode_recurrence_df = pd.read_csv(_csv("trace_episode_recurrence.csv"), parse_dates=["timestamp_start", "timestamp_end"])
evidence_chain_df     = pd.read_csv(_csv("trace_evidence_chain.csv"), parse_dates=["timestamp_start", "timestamp_end"])
recurrence_summary_df = pd.read_csv(_csv("trace_recurrence_summary.csv"))
recovery_df           = pd.read_csv(_csv("trace_recovery_reconciliation.csv"))
physical_expected_df  = pd.read_csv(_csv("trace_physical_expected.csv"), parse_dates=["measured_on"])
integrity_df          = pd.read_csv(_csv("trace_integrity_report.csv"))

# ── Load trained ML model ──────────────────────────────────────────────────

model = joblib.load(_csv("expected_generation_model.joblib"))
