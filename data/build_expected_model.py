"""
build_expected_model.py — TRACE Expected Generation Model

This script builds the TRACE Expected Generation Engine using a
GradientBoostingRegressor trained on a reference period from January 2017.

IMPORTANT METHODOLOGY NOTES:

1. REFERENCE PERIOD, NOT "HEALTHY BASELINE"
   January is used as a REFERENCE TRAINING PERIOD after operational-quality
   filtering. This does NOT mean January is proven to be a "healthy baseline."
   The model learns normal operating patterns from filtered January data.

2. TEMPORAL VALIDATION
   February is used as an unseen temporal holdout for validation.
   This demonstrates temporal generalization WITHIN THIS PLANT.
   It does NOT demonstrate cross-plant generalization.

3. FEATURE IMPORTANCE
   Feature importance values represent tree-based feature importance
   (Gini importance / mean decrease in impurity), NOT causal influence
   or "predictive power."

4. DOMAIN CONSTRAINTS
   Physical constraints (night detection, capacity caps) are applied
   POST-PREDICTION to prevent physically impossible outputs.
"""

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from config import (
    PHYSICAL_DATA_PATH,
    OUTPUT_PHYSICAL_EXPECTED,
    EXPECTED_GENERATION_MODEL_PATH,
    REFERENCE_MONTH,
    VALIDATION_MONTH,
    FEATURES,
    TARGET,
    MODEL_CONFIG,
    LOW_IRRADIANCE_THRESHOLD_W_M2,
    NAMEPLATE_CAPACITY_KW,
    MIN_TRAINING_POA_W_M2,
    MIN_TRAINING_AC_POWER_KW,
    MIN_TRAINING_DC_POWER_W,
    ensure_output_dir,
)

# Ensure output directory exists
ensure_output_dir()


# ---------------------------------------------------------
# Load physical dataset
# ---------------------------------------------------------

df = pd.read_csv(PHYSICAL_DATA_PATH)
df["measured_on"] = pd.to_datetime(df["measured_on"])


# ---------------------------------------------------------
# Create reference dataset
#
# January is used ONLY for learning operating patterns from
# a reference period after operational-quality filtering.
#
# This is NOT a proven "healthy baseline."
# ---------------------------------------------------------

reference = df[
    [
        "measured_on",
        "poa_irradiance__5041",
        "module_temp__5043",
        "ac_power__5074",
        "dc_power__5077",
    ]
].dropna()

reference = reference[
    (reference["measured_on"].dt.month == REFERENCE_MONTH)
    & (reference["poa_irradiance__5041"] > MIN_TRAINING_POA_W_M2)
    & (reference["ac_power__5074"] > MIN_TRAINING_AC_POWER_KW)
    & (reference["dc_power__5077"] > MIN_TRAINING_DC_POWER_W)
]


# ---------------------------------------------------------
# Train model using reference period only
# ---------------------------------------------------------

model = GradientBoostingRegressor(**MODEL_CONFIG)

model.fit(
    reference[FEATURES],
    reference[TARGET],
)


# ---------------------------------------------------------
# Reference period training performance
# ---------------------------------------------------------

train_prediction = model.predict(reference[FEATURES])

train_mae = mean_absolute_error(reference[TARGET], train_prediction)
train_rmse = np.sqrt(mean_squared_error(reference[TARGET], train_prediction))
train_r2 = r2_score(reference[TARGET], train_prediction)

# Calculate nMAE (normalized MAE)
train_mean_actual = reference[TARGET].mean()
train_nmae_pct = (train_mae / train_mean_actual) * 100 if train_mean_actual > 0 else 0


# ---------------------------------------------------------
# Predict expected AC power (raw model output)
#
# Only rows with valid environmental inputs can receive
# an expected value.
# ---------------------------------------------------------

df["expected_ac_power_kw_raw"] = pd.NA

valid_prediction = (
    df["poa_irradiance__5041"].notna()
    & df["module_temp__5043"].notna()
)

df.loc[valid_prediction, "expected_ac_power_kw_raw"] = model.predict(
    df.loc[valid_prediction, FEATURES]
)


# ---------------------------------------------------------
# Domain constraint layer
#
# Apply physical constraints to prevent impossible outputs:
# 1. At very low irradiance (<10 W/m²), expected power = 0 kW
# 2. Clip negative predictions to 0
# 3. Clip above-nameplate predictions to capacity
#
# We keep BOTH raw and constrained predictions for debugging.
# ---------------------------------------------------------

df["expected_ac_power_kw"] = df["expected_ac_power_kw_raw"].copy()

# Low irradiance constraint
low_irradiance = (
    df["poa_irradiance__5041"].notna()
    & (df["poa_irradiance__5041"] < LOW_IRRADIANCE_THRESHOLD_W_M2)
)
df.loc[low_irradiance, "expected_ac_power_kw"] = 0

# Convert to numeric and apply capacity constraints
df["expected_ac_power_kw"] = pd.to_numeric(
    df["expected_ac_power_kw"],
    errors="coerce",
)

df["expected_ac_power_kw"] = (
    df["expected_ac_power_kw"]
    .clip(lower=0, upper=NAMEPLATE_CAPACITY_KW)
)

# Domain constraint flags
df["domain_constraint_applied"] = False
df.loc[low_irradiance, "domain_constraint_applied"] = True
df.loc[
    (df["expected_ac_power_kw_raw"] < 0) | (df["expected_ac_power_kw_raw"] > NAMEPLATE_CAPACITY_KW),
    "domain_constraint_applied"
] = True


# ---------------------------------------------------------
# Convert expected power to 15-minute energy
# ---------------------------------------------------------

df["expected_generation_kwh"] = (
    df["expected_ac_power_kw"] * 0.25
)


# ---------------------------------------------------------
# Actual generation
#
# AC power is kW.
# Each record represents 15 minutes = 0.25 hour.
# ---------------------------------------------------------

df["actual_generation_kwh"] = (
    df["ac_power__5074"].fillna(0) * 0.25
)


# ---------------------------------------------------------
# Generation variance
#
# Positive = expected production was higher than actual.
# ---------------------------------------------------------

df["generation_variance_kwh"] = (
    df["expected_generation_kwh"]
    - df["actual_generation_kwh"]
)


# ---------------------------------------------------------
# Model evaluation on validation period (February)
#
# February is NEVER used for training.
#
# Evaluation is performed only in the same valid operating
# region used for model training to ensure fair comparison.
# ---------------------------------------------------------

validation = df[
    [
        "measured_on",
        "poa_irradiance__5041",
        "module_temp__5043",
        "ac_power__5074",
        "dc_power__5077",
    ]
].dropna()

validation = validation[
    (validation["measured_on"].dt.month == VALIDATION_MONTH)
    & (validation["poa_irradiance__5041"] > MIN_TRAINING_POA_W_M2)
    & (validation["ac_power__5074"] > MIN_TRAINING_AC_POWER_KW)
    & (validation["dc_power__5077"] > MIN_TRAINING_DC_POWER_W)
]

validation_prediction = model.predict(validation[FEATURES])

test_mae = mean_absolute_error(validation[TARGET], validation_prediction)
test_rmse = np.sqrt(mean_squared_error(validation[TARGET], validation_prediction))
test_r2 = r2_score(validation[TARGET], validation_prediction)

# Calculate nMAE for validation
test_mean_actual = validation[TARGET].mean()
test_nmae_pct = (test_mae / test_mean_actual) * 100 if test_mean_actual > 0 else 0


# ---------------------------------------------------------
# Feature importance
#
# IMPORTANT: This represents tree-based feature importance
# (Gini importance), NOT causal influence or predictive power.
# ---------------------------------------------------------

feature_importance = dict(zip(FEATURES, model.feature_importances_))


# ---------------------------------------------------------
# Save model
# ---------------------------------------------------------

joblib.dump(model, EXPECTED_GENERATION_MODEL_PATH)


# ---------------------------------------------------------
# Save final physical dataset
# ---------------------------------------------------------

df.to_csv(OUTPUT_PHYSICAL_EXPECTED, index=False)


# ---------------------------------------------------------
# Create structured model evaluation output
# ---------------------------------------------------------

model_evaluation = {
    "model_metadata": {
        "model_name": "TRACE Expected Generation Model",
        "model_type": "GradientBoostingRegressor",
        "training_period": f"{REFERENCE_MONTH:02d}/2017",
        "training_period_label": "January 2017 reference period (quality-filtered)",
        "validation_period": f"{VALIDATION_MONTH:02d}/2017",
        "validation_period_label": "February 2017 unseen holdout",
        "validation_type": "temporal_holdout_within_plant",
        "features": FEATURES,
        "target": TARGET,
    },
    "model_parameters": MODEL_CONFIG,
    "training_metrics": {
        "observations": len(reference),
        "mae_kw": round(train_mae, 3),
        "rmse_kw": round(train_rmse, 3),
        "r2": round(train_r2, 4),
        "nmae_percent": round(train_nmae_pct, 2),
        "mean_actual_kw": round(train_mean_actual, 2),
    },
    "validation_metrics": {
        "observations": len(validation),
        "mae_kw": round(test_mae, 3),
        "rmse_kw": round(test_rmse, 3),
        "r2": round(test_r2, 4),
        "nmae_percent": round(test_nmae_pct, 2),
        "mean_actual_kw": round(test_mean_actual, 2),
    },
    "feature_importance": {
        feature: round(importance, 4)
        for feature, importance in feature_importance.items()
    },
    "domain_constraints": {
        "low_irradiance_threshold_w_m2": LOW_IRRADIANCE_THRESHOLD_W_M2,
        "nameplate_capacity_kw": NAMEPLATE_CAPACITY_KW,
        "constraints_applied_count": int(df["domain_constraint_applied"].sum()),
    },
    "output_statistics": {
        "total_observations": len(df),
        "expected_generation_available": int(df["expected_generation_kwh"].notna().sum()),
        "variance_available": int(df["generation_variance_kwh"].notna().sum()),
        "domain_constrained_observations": int(df["domain_constraint_applied"].sum()),
    },
}

# Save model evaluation as JSON
import json
model_eval_path = EXPECTED_GENERATION_MODEL_PATH.parent / "model_evaluation.json"
with open(model_eval_path, 'w') as f:
    json.dump(model_evaluation, f, indent=2)


# ---------------------------------------------------------
# Report
# ---------------------------------------------------------

print("=" * 70)
print("TRACE EXPECTED GENERATION MODEL")
print("=" * 70)
print()

print("Model Type: GradientBoostingRegressor")
print(f"Features: {', '.join(FEATURES)}")
print(f"Target: {TARGET}")
print()

print("TRAINING PERIOD (Reference Period)")
print("-" * 70)
print(f"Period: January 2017 (Month {REFERENCE_MONTH})")
print(f"Note: This is a REFERENCE TRAINING PERIOD after quality filtering,")
print(f"      NOT a proven 'healthy baseline'.")
print(f"Training observations: {len(reference):,}")
print()
print("Training Metrics:")
print(f"  MAE:  {train_mae:8.3f} kW")
print(f"  RMSE: {train_rmse:8.3f} kW")
print(f"  R²:   {train_r2:8.4f}")
print(f"  nMAE: {train_nmae_pct:8.2f}%")
print()

print("VALIDATION PERIOD (Unseen Holdout)")
print("-" * 70)
print(f"Period: February 2017 (Month {VALIDATION_MONTH})")
print(f"Validation Type: Temporal holdout within plant")
print(f"Test observations: {len(validation):,}")
print()
print("Validation Metrics:")
print(f"  MAE:  {test_mae:8.3f} kW")
print(f"  RMSE: {test_rmse:8.3f} kW")
print(f"  R²:   {test_r2:8.4f}")
print(f"  nMAE: {test_nmae_pct:8.2f}%")
print()

print("FEATURE IMPORTANCE (Tree-Based)")
print("-" * 70)
print("Note: These represent Gini importance (mean decrease in impurity),")
print("      NOT causal influence or 'predictive power'.")
print()
for feature, importance in sorted(feature_importance.items(), key=lambda x: x[1], reverse=True):
    print(f"  {feature:30s}: {importance:6.2%}")
print()

print("DOMAIN CONSTRAINTS")
print("-" * 70)
print(f"Low irradiance threshold: {LOW_IRRADIANCE_THRESHOLD_W_M2} W/m²")
print(f"Nameplate capacity cap:   {NAMEPLATE_CAPACITY_KW} kW")
print(f"Observations constrained: {df['domain_constraint_applied'].sum():,}")
print()

print("OUTPUT DATASET")
print("-" * 70)
print(f"File: {OUTPUT_PHYSICAL_EXPECTED}")
print(f"Total observations: {len(df):,}")
print(f"Expected generation available: {df['expected_generation_kwh'].notna().sum():,}")
print(f"Variance available: {df['generation_variance_kwh'].notna().sum():,}")
print()

print("MODEL ARTIFACTS")
print("-" * 70)
print(f"Model file: {EXPECTED_GENERATION_MODEL_PATH}")
print(f"Evaluation JSON: {model_eval_path}")
print()

print("=" * 70)
print("TRACE Expected Generation Model created successfully.")
print("=" * 70)
