"""
config.py — TRACE Data Pipeline Configuration

Centralized configuration for all data pipeline scripts.
Uses relative paths from this file's location for portability.
"""

import os
from pathlib import Path

# ─────────────────────────────────────────────────────────────────────────────
# Base Paths
# ─────────────────────────────────────────────────────────────────────────────

# Get the directory containing this config file
CONFIG_DIR = Path(__file__).parent.resolve()

# Raw data directory
RAW_DATA_DIR = CONFIG_DIR / "pvdaq_raw"

# Processed data directory
PROCESSED_DATA_DIR = CONFIG_DIR / "processed"

# Ensure processed directory exists
PROCESSED_DATA_DIR.mkdir(parents=True, exist_ok=True)


# ─────────────────────────────────────────────────────────────────────────────
# Input Paths
# ─────────────────────────────────────────────────────────────────────────────

# Raw PVDAQ data files (glob pattern)
RAW_PVDAQ_PATTERN = str(RAW_DATA_DIR / "*.csv")

# Processed pipeline inputs
PHYSICAL_DATA_PATH = PROCESSED_DATA_DIR / "physical_data.csv"
PHYSICAL_EXPECTED_PATH = PROCESSED_DATA_DIR / "trace_physical_expected.csv"
PHYSICAL_QUALITY_PATH = PROCESSED_DATA_DIR / "trace_physical_quality.csv"
ATTRIBUTION_PATH = PROCESSED_DATA_DIR / "trace_attribution.csv"
EPISODE_ATTRIBUTION_PATH = PROCESSED_DATA_DIR / "trace_episode_attribution.csv"
EPISODE_RECURRENCE_PATH = PROCESSED_DATA_DIR / "trace_episode_recurrence.csv"
DECISION_INTELLIGENCE_PATH = PROCESSED_DATA_DIR / "trace_decision_intelligence.csv"
COMMERCIAL_IMPACT_PATH = PROCESSED_DATA_DIR / "trace_commercial_impact.csv"
RECURRENCE_SUMMARY_PATH = PROCESSED_DATA_DIR / "trace_recurrence_summary.csv"
RECOVERY_RECONCILIATION_PATH = PROCESSED_DATA_DIR / "trace_recovery_reconciliation.csv"


# ─────────────────────────────────────────────────────────────────────────────
# Output Paths
# ─────────────────────────────────────────────────────────────────────────────

# Model output
EXPECTED_GENERATION_MODEL_PATH = PROCESSED_DATA_DIR / "expected_generation_model.joblib"

# Pipeline outputs
OUTPUT_PHYSICAL_DATA = PROCESSED_DATA_DIR / "physical_data.csv"
OUTPUT_PHYSICAL_EXPECTED = PROCESSED_DATA_DIR / "trace_physical_expected.csv"
OUTPUT_PHYSICAL_QUALITY = PROCESSED_DATA_DIR / "trace_physical_quality.csv"
OUTPUT_ATTRIBUTION = PROCESSED_DATA_DIR / "trace_attribution.csv"
OUTPUT_EPISODE_ATTRIBUTION = PROCESSED_DATA_DIR / "trace_episode_attribution.csv"
OUTPUT_RECURRENCE_SUMMARY = PROCESSED_DATA_DIR / "trace_recurrence_summary.csv"
OUTPUT_EPISODE_RECURRENCE = PROCESSED_DATA_DIR / "trace_episode_recurrence.csv"
OUTPUT_DECISION_INTELLIGENCE = PROCESSED_DATA_DIR / "trace_decision_intelligence.csv"
OUTPUT_EVIDENCE_CHAIN = PROCESSED_DATA_DIR / "trace_evidence_chain.csv"
OUTPUT_COMMERCIAL_IMPACT = PROCESSED_DATA_DIR / "trace_commercial_impact.csv"
OUTPUT_EPISODE_FINANCIAL = PROCESSED_DATA_DIR / "trace_episode_financial_impact.csv"
OUTPUT_RECOVERY_RECONCILIATION = PROCESSED_DATA_DIR / "trace_recovery_reconciliation.csv"
OUTPUT_INTEGRITY_REPORT = PROCESSED_DATA_DIR / "trace_integrity_report.csv"
OUTPUT_EVENTS = PROCESSED_DATA_DIR / "trace_events.csv"


# ─────────────────────────────────────────────────────────────────────────────
# Expected Generation Model Configuration
# ─────────────────────────────────────────────────────────────────────────────

# Reference period for model training
# NOTE: This is a REFERENCE TRAINING PERIOD after operational-quality filtering,
# NOT a proven "healthy baseline". The model learns normal operating patterns
# from January 2017 data that passes quality filters.
REFERENCE_MONTH = 1  # January

# Model parameters
MODEL_CONFIG = {
    "n_estimators": 150,
    "learning_rate": 0.05,
    "max_depth": 3,
    "random_state": 42,
}

# Feature configuration
FEATURES = [
    "poa_irradiance__5041",
    "module_temp__5043",
]

TARGET = "ac_power__5074"

# Domain constraints
LOW_IRRADIANCE_THRESHOLD_W_M2 = 10  # Below this, expected power = 0
NAMEPLATE_CAPACITY_KW = 720.72  # Plant capacity cap

# Training data quality filters (applied to reference period)
MIN_TRAINING_POA_W_M2 = 100  # Minimum irradiance for training
MIN_TRAINING_AC_POWER_KW = 0  # Must have positive AC power
MIN_TRAINING_DC_POWER_W = 0  # Must have positive DC power

# Validation period
VALIDATION_MONTH = 2  # February (unseen holdout)


# ─────────────────────────────────────────────────────────────────────────────
# Data Quality Configuration
# ─────────────────────────────────────────────────────────────────────────────

# No configuration needed - data quality guard uses adaptive logic


# ─────────────────────────────────────────────────────────────────────────────
# Attribution Configuration
# ─────────────────────────────────────────────────────────────────────────────

# Minimum expected generation for variance calculation
MIN_EXPECTED_KWH_FOR_VARIANCE = 5

# Variance significance threshold
SIGNIFICANT_VARIANCE_PCT = 40

# Environmental evidence thresholds
HIGH_POA_THRESHOLD_W_M2 = 300

# Equipment evidence thresholds
LOW_DC_POWER_THRESHOLD_KW = 20  # in kW (converted from W in code)
DC_TO_AC_RATIO_LOW = 0.30


# ─────────────────────────────────────────────────────────────────────────────
# Episode Configuration
# ─────────────────────────────────────────────────────────────────────────────

# Expected measurement interval
EXPECTED_INTERVAL_MINUTES = 15

# Minimum expected generation for episode eligibility
MIN_EPISODE_EXPECTED_KWH = 5

# Variance threshold for episode creation
EPISODE_VARIANCE_THRESHOLD_PCT = 40


# ─────────────────────────────────────────────────────────────────────────────
# Recurrence Configuration
# ─────────────────────────────────────────────────────────────────────────────

# Episode count thresholds for recurrence classification
RECURRING_EPISODE_COUNT = 3
STRUCTURAL_EPISODE_COUNT = 8

# Minimum total loss for structural classification
STRUCTURAL_LOSS_KWH = 500

# Temporal separation threshold
MIN_SEPARATION_HOURS = 1


# ─────────────────────────────────────────────────────────────────────────────
# Decision Intelligence Configuration
# ─────────────────────────────────────────────────────────────────────────────

# Recovery thresholds
MIN_RECOVERY_LOSS_KWH = 20
HIGH_PRIORITY_LOSS_KWH = 150
MEDIUM_PRIORITY_LOSS_KWH = 50


# ─────────────────────────────────────────────────────────────────────────────
# Commercial Configuration
# ─────────────────────────────────────────────────────────────────────────────

# IMPORTANT: These are SYNTHETIC TRACE DEMONSTRATION ASSUMPTIONS.
# They are NOT from PVDAQ. Physical generation remains independent
# from commercial settlement.

BASELINE_TARIFF_USD_PER_KWH = 0.055
SETTLEMENT_FACTOR = 0.97
COMMERCIAL_ADJUSTMENT_USD = 0.0


# ─────────────────────────────────────────────────────────────────────────────
# Integrity Check Configuration
# ─────────────────────────────────────────────────────────────────────────────

# Attribution reconciliation tolerance
# This tolerance is ONLY for validation of rounded CSV outputs.
# It does not change any underlying attribution calculation.
RECONCILIATION_TOLERANCE_KWH = 0.10


# ─────────────────────────────────────────────────────────────────────────────
# Utility Functions
# ─────────────────────────────────────────────────────────────────────────────

def get_path_str(path: Path) -> str:
    """Convert Path object to string for compatibility with older code."""
    return str(path)


def ensure_output_dir():
    """Ensure the processed data directory exists."""
    PROCESSED_DATA_DIR.mkdir(parents=True, exist_ok=True)


# ─────────────────────────────────────────────────────────────────────────────
# Configuration Summary
# ─────────────────────────────────────────────────────────────────────────────

def print_config_summary():
    """Print configuration summary for verification."""
    print("=" * 70)
    print("TRACE Data Pipeline Configuration")
    print("=" * 70)
    print()
    print(f"Raw Data Directory:       {RAW_DATA_DIR}")
    print(f"Processed Data Directory: {PROCESSED_DATA_DIR}")
    print()
    print("Expected Generation Model:")
    print(f"  Reference Month:        {REFERENCE_MONTH} (January)")
    print(f"  Validation Month:       {VALIDATION_MONTH} (February)")
    print(f"  Features:               {', '.join(FEATURES)}")
    print(f"  Target:                 {TARGET}")
    print(f"  Model Type:             GradientBoostingRegressor")
    print(f"  Estimators:             {MODEL_CONFIG['n_estimators']}")
    print(f"  Learning Rate:          {MODEL_CONFIG['learning_rate']}")
    print(f"  Max Depth:              {MODEL_CONFIG['max_depth']}")
    print()
    print("Domain Constraints:")
    print(f"  Low Irradiance Threshold:  {LOW_IRRADIANCE_THRESHOLD_W_M2} W/m²")
    print(f"  Nameplate Capacity:        {NAMEPLATE_CAPACITY_KW} kW")
    print()
    print("Attribution Thresholds:")
    print(f"  Significant Variance:      {SIGNIFICANT_VARIANCE_PCT}%")
    print(f"  High POA Threshold:        {HIGH_POA_THRESHOLD_W_M2} W/m²")
    print(f"  Min Expected (variance):   {MIN_EXPECTED_KWH_FOR_VARIANCE} kWh")
    print()
    print("Recurrence Classification:")
    print(f"  Recurring Threshold:       {RECURRING_EPISODE_COUNT} episodes")
    print(f"  Structural Threshold:      {STRUCTURAL_EPISODE_COUNT} episodes")
    print(f"  Structural Loss Min:       {STRUCTURAL_LOSS_KWH} kWh")
    print()
    print("Commercial Assumptions (SYNTHETIC):")
    print(f"  Tariff:                    ${BASELINE_TARIFF_USD_PER_KWH}/kWh")
    print(f"  Settlement Factor:         {SETTLEMENT_FACTOR}")
    print()
    print("=" * 70)
    print()


if __name__ == "__main__":
    # When run directly, print configuration summary
    print_config_summary()
    print("Configuration loaded successfully.")
    print(f"Raw data files found: {len(list(RAW_DATA_DIR.glob('*.csv')))}")
    print(f"Processed data directory exists: {PROCESSED_DATA_DIR.exists()}")
