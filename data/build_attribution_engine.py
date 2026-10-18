"""
build_attribution_engine.py — TRACE Evidence-Weighted Attribution Engine

This engine produces EVIDENCE-WEIGHTED ATTRIBUTION, not causal attribution.

IMPORTANT PRINCIPLES:

1. EVIDENCE SCORES, NOT CAUSAL CLAIMS
   The engine calculates evidence strength for different categories.
   It does NOT claim to prove specific equipment failures or root causes.

2. UNEXPLAINED IS LEGITIMATE
   When evidence is insufficient, the result should be UNEXPLAINED.
   We do NOT force all loss into attributed categories.

3. CONFIDENCE IS SEPARATE FROM ALLOCATION
   Evidence confidence is tracked independently from allocated loss contribution.
   Strong evidence → high confidence, but allocation respects evidence limits.

4. DC → AC EVIDENCE CHAIN
   Pattern analysis uses available signals (POA, DC, AC) to build evidence,
   but does not automatically claim inverter failure without supporting data.
"""

import numpy as np
import pandas as pd

from config import (
    PHYSICAL_QUALITY_PATH,
    OUTPUT_ATTRIBUTION,
    MIN_EXPECTED_KWH_FOR_VARIANCE,
    SIGNIFICANT_VARIANCE_PCT,
    HIGH_POA_THRESHOLD_W_M2,
    LOW_DC_POWER_THRESHOLD_KW,
    DC_TO_AC_RATIO_LOW,
    ensure_output_dir,
)

# Ensure output directory exists
ensure_output_dir()


# ---------------------------------------------------------
# Load dataset
# ---------------------------------------------------------

df = pd.read_csv(PHYSICAL_QUALITY_PATH)

df["measured_on"] = pd.to_datetime(df["measured_on"])
df = df.sort_values("measured_on").reset_index(drop=True)


# ---------------------------------------------------------
# Calculate variance percentage
# ---------------------------------------------------------

df["variance_pct"] = np.nan

valid_expected = (
    df["expected_generation_kwh"].notna()
    & (df["expected_generation_kwh"] > MIN_EXPECTED_KWH_FOR_VARIANCE)
)

df.loc[valid_expected, "variance_pct"] = (
    df.loc[valid_expected, "generation_variance_kwh"]
    / df.loc[valid_expected, "expected_generation_kwh"]
) * 100


# ---------------------------------------------------------
# Candidate evidence signals
# ---------------------------------------------------------

df["high_irradiance"] = (
    df["poa_irradiance__5041"] >= HIGH_POA_THRESHOLD_W_M2
)

df["low_actual_output"] = (
    df["actual_generation_kwh"]
    < (df["expected_generation_kwh"] * 0.60)
)

df["dc_power_available"] = df["dc_power__5077"].notna()

df["dc_power_low"] = (
    df["dc_power__5077"].notna()
    & (df["dc_power__5077"] < LOW_DC_POWER_THRESHOLD_KW * 1000)
)

df["dc_ac_ratio"] = np.nan

valid_ratio = (
    df["dc_power__5077"].notna()
    & df["ac_power__5074"].notna()
    & (df["ac_power__5074"] > 0)
)

df.loc[valid_ratio, "dc_ac_ratio"] = (
    df.loc[valid_ratio, "ac_power__5074"]
    / (df.loc[valid_ratio, "dc_power__5077"] / 1000)
)


# ---------------------------------------------------------
# Identify significant performance observations
# ---------------------------------------------------------

df["significant_gap"] = (
    valid_expected
    & (df["variance_pct"] > SIGNIFICANT_VARIANCE_PCT)
)


# ---------------------------------------------------------
# Create attribution records
#
# IMPORTANT:
# This engine produces EVIDENCE SCORES, not causal claims.
# ---------------------------------------------------------

records = []

for _, row in df[df["significant_gap"]].iterrows():

    expected_kwh = float(row["expected_generation_kwh"])
    actual_kwh = float(row["actual_generation_kwh"])
    variance_kwh = float(row["generation_variance_kwh"])
    variance_pct = float(row["variance_pct"])

    # -----------------------------------------------------
    # Environmental evidence
    #
    # Low irradiance provides stronger environmental evidence.
    # High irradiance reduces environmental evidence.
    # -----------------------------------------------------

    environmental_evidence = 0.0

    if pd.notna(row["poa_irradiance__5041"]):
        poa = float(row["poa_irradiance__5041"])
        
        if poa < 100:
            environmental_evidence += 0.60
        elif poa < 300:
            environmental_evidence += 0.30
        else:
            # High irradiance reduces environmental evidence
            environmental_evidence += 0.05

    environmental_confidence = 0.70 if environmental_evidence > 0.30 else 0.40

    # -----------------------------------------------------
    # Equipment / conversion evidence
    #
    # Pattern: High POA + Low AC output + Low DC
    # This suggests equipment/conversion-side issue.
    #
    # IMPORTANT: This is EVIDENCE, not a diagnosis of
    # specific equipment failure.
    # -----------------------------------------------------

    equipment_evidence = 0.0

    # High irradiance pattern
    if row["high_irradiance"]:
        equipment_evidence += 0.25

    # Significant variance
    if variance_pct >= 60:
        equipment_evidence += 0.25
    elif variance_pct >= 40:
        equipment_evidence += 0.15

    # DC power evidence
    if pd.notna(row["dc_power__5077"]):
        dc_power_w = float(row["dc_power__5077"])
        
        if dc_power_w < 20000:
            equipment_evidence += 0.25
        elif dc_power_w < 50000:
            equipment_evidence += 0.15
    
    # DC/AC conversion efficiency
    if pd.notna(row.get("dc_ac_ratio")):
        dc_ac_ratio = float(row["dc_ac_ratio"])
        
        if dc_ac_ratio < DC_TO_AC_RATIO_LOW:
            equipment_evidence += 0.15

    equipment_confidence = 0.75 if equipment_evidence > 0.50 else 0.50

    # -----------------------------------------------------
    # Data quality evidence
    # -----------------------------------------------------

    data_quality_evidence = 0.0

    if not row["production_observable"]:
        data_quality_evidence += 0.80

    if not row["environment_observable"]:
        data_quality_evidence += 0.40

    if not row["dc_measurement_valid"]:
        data_quality_evidence += 0.20

    if row["measurement_quality"] == "POOR":
        data_quality_evidence += 0.30

    data_quality_evidence = min(data_quality_evidence, 1.0)
    data_quality_confidence = 0.90 if data_quality_evidence > 0.70 else 0.60

    # -----------------------------------------------------
    # Calculate unexplained evidence
    #
    # IMPORTANT CHANGE: Instead of starting at fixed 0.60,
    # we calculate unexplained based on evidence strength.
    #
    # Strong evidence → low unexplained
    # Weak evidence → high unexplained
    # -----------------------------------------------------

    total_evidence = environmental_evidence + equipment_evidence + data_quality_evidence
    
    # If total evidence is weak, unexplained should be significant
    if total_evidence < 0.30:
        unexplained_evidence = 0.70
    elif total_evidence < 0.60:
        unexplained_evidence = 0.50
    elif total_evidence < 0.90:
        unexplained_evidence = 0.30
    else:
        unexplained_evidence = 0.15

    # Adjust based on measurement quality
    if row["measurement_quality"] == "GOOD":
        unexplained_evidence *= 0.80
    elif row["measurement_quality"] == "POOR":
        unexplained_evidence = max(unexplained_evidence, 0.50)

    unexplained_confidence = 0.30  # Unexplained has inherently low confidence

    # -----------------------------------------------------
    # Evidence summary
    # -----------------------------------------------------

    evidence_scores = {
        "ENVIRONMENTAL": environmental_evidence,
        "EQUIPMENT_CONVERSION": equipment_evidence,
        "DATA_QUALITY": data_quality_evidence,
        "UNEXPLAINED": unexplained_evidence,
    }

    evidence_confidences = {
        "ENVIRONMENTAL": environmental_confidence,
        "EQUIPMENT_CONVERSION": equipment_confidence,
        "DATA_QUALITY": data_quality_confidence,
        "UNEXPLAINED": unexplained_confidence,
    }

    # -----------------------------------------------------
    # If data quality is poor, reduce physical evidence
    # -----------------------------------------------------------------

    if row["measurement_quality"] == "POOR":
        evidence_scores["DATA_QUALITY"] = min(evidence_scores["DATA_QUALITY"] + 0.30, 1.0)
        evidence_scores["EQUIPMENT_CONVERSION"] *= 0.30
        evidence_scores["ENVIRONMENTAL"] *= 0.50

    # -----------------------------------------------------
    # Convert evidence scores into normalized weights
    # for loss allocation
    # -----------------------------------------------------

    total_score = sum(evidence_scores.values())

    if total_score > 0:
        allocation_weights = {
            key: value / total_score
            for key, value in evidence_scores.items()
        }
    else:
        # If no evidence, allocate fully to unexplained
        allocation_weights = {
            "ENVIRONMENTAL": 0.0,
            "EQUIPMENT_CONVERSION": 0.0,
            "DATA_QUALITY": 0.0,
            "UNEXPLAINED": 1.0,
        }

    # -----------------------------------------------------
    # Allocate loss based on weights
    # -----------------------------------------------------

    data_quality_kwh = variance_kwh * allocation_weights["DATA_QUALITY"]
    environmental_kwh = variance_kwh * allocation_weights["ENVIRONMENTAL"]
    equipment_kwh = variance_kwh * allocation_weights["EQUIPMENT_CONVERSION"]
    unexplained_kwh = variance_kwh * allocation_weights["UNEXPLAINED"]

    attributed_kwh = data_quality_kwh + environmental_kwh + equipment_kwh

    reconciliation_error = variance_kwh - (attributed_kwh + unexplained_kwh)

    # -----------------------------------------------------
    # Attribution confidence
    #
    # Based on measurement quality and evidence strength
    # -----------------------------------------------------

    if (
        row["measurement_quality"] == "GOOD"
        and row["dc_measurement_valid"]
        and row["environment_observable"]
        and total_evidence > 0.70
    ):
        confidence = "HIGH"
    elif (
        row["production_observable"]
        and row["environment_observable"]
        and total_evidence > 0.40
    ):
        confidence = "MEDIUM"
    else:
        confidence = "LOW"

    # -----------------------------------------------------
    # Primary evidence category
    # -----------------------------------------------------

    primary_category = max(allocation_weights, key=allocation_weights.get)

    # -----------------------------------------------------
    # Store record
    # -----------------------------------------------------

    records.append(
        {
            "timestamp": row["measured_on"],

            # Performance
            "expected_generation_kwh": round(expected_kwh, 3),
            "actual_generation_kwh": round(actual_kwh, 3),
            "observed_variance_kwh": round(variance_kwh, 3),
            "variance_pct": round(variance_pct, 2),

            # Physical evidence
            "poa_irradiance": round(float(row["poa_irradiance__5041"]), 2)
                if pd.notna(row["poa_irradiance__5041"]) else None,
            "dc_power": round(float(row["dc_power__5077"]), 2)
                if pd.notna(row["dc_power__5077"]) else None,
            "ac_power": round(float(row["ac_power__5074"]), 2)
                if pd.notna(row["ac_power__5074"]) else None,
            "dc_ac_ratio": round(row["dc_ac_ratio"], 3)
                if pd.notna(row.get("dc_ac_ratio")) else None,

            # Measurement quality
            "measurement_quality": row["measurement_quality"],

            # Attribution
            "attribution_confidence": confidence,
            "primary_evidence_category": primary_category,

            # Evidence scores (for transparency)
            "environmental_evidence_score": round(environmental_evidence, 3),
            "equipment_evidence_score": round(equipment_evidence, 3),
            "data_quality_evidence_score": round(data_quality_evidence, 3),
            "unexplained_evidence_score": round(unexplained_evidence, 3),

            # Evidence confidences (for transparency)
            "environmental_confidence": round(environmental_confidence, 2),
            "equipment_confidence": round(equipment_confidence, 2),
            "data_quality_confidence": round(data_quality_confidence, 2),

            # Allocation weights
            "environmental_weight": round(allocation_weights["ENVIRONMENTAL"], 4),
            "equipment_conversion_weight": round(allocation_weights["EQUIPMENT_CONVERSION"], 4),
            "data_quality_weight": round(allocation_weights["DATA_QUALITY"], 4),
            "unexplained_weight": round(allocation_weights["UNEXPLAINED"], 4),

            # Allocated loss
            "environmental_kwh": round(environmental_kwh, 3),
            "equipment_conversion_kwh": round(equipment_kwh, 3),
            "data_quality_kwh": round(data_quality_kwh, 3),
            "attributed_kwh": round(attributed_kwh, 3),
            "unexplained_kwh": round(unexplained_kwh, 3),

            # Reconciliation
            "reconciliation_error_kwh": round(reconciliation_error, 6),
        }
    )


# ---------------------------------------------------------
# Create final attribution dataset
# ---------------------------------------------------------

attribution_df = pd.DataFrame(records)


# ---------------------------------------------------------
# Save
# ---------------------------------------------------------

attribution_df.to_csv(OUTPUT_ATTRIBUTION, index=False)


# ---------------------------------------------------------
# Report
# ---------------------------------------------------------

print("=" * 70)
print("TRACE EVIDENCE-WEIGHTED ATTRIBUTION ENGINE")
print("=" * 70)
print()

print("Output:", OUTPUT_ATTRIBUTION)
print()

print(f"Significant observations: {len(attribution_df):,}")
print()

if not attribution_df.empty:

    print("PRIMARY EVIDENCE CATEGORIES")
    print("-" * 70)
    print(attribution_df["primary_evidence_category"].value_counts().to_string())
    print()

    print("ATTRIBUTION CONFIDENCE")
    print("-" * 70)
    print(attribution_df["attribution_confidence"].value_counts().to_string())
    print()

    print("LOSS ALLOCATION")
    print("-" * 70)
    print(f"Observed variance:     {attribution_df['observed_variance_kwh'].sum():10,.2f} kWh")
    print(f"Environmental:         {attribution_df['environmental_kwh'].sum():10,.2f} kWh")
    print(f"Equipment/Conversion:  {attribution_df['equipment_conversion_kwh'].sum():10,.2f} kWh")
    print(f"Data Quality:          {attribution_df['data_quality_kwh'].sum():10,.2f} kWh")
    print(f"Attributed (total):    {attribution_df['attributed_kwh'].sum():10,.2f} kWh")
    print(f"Unexplained:           {attribution_df['unexplained_kwh'].sum():10,.2f} kWh")
    print()

    unexplained_pct = (attribution_df['unexplained_kwh'].sum() / 
                      attribution_df['observed_variance_kwh'].sum() * 100)
    print(f"Unexplained percentage: {unexplained_pct:.1f}%")
    print()

    print("RECONCILIATION")
    print("-" * 70)
    max_error = attribution_df["reconciliation_error_kwh"].abs().max()
    print(f"Maximum reconciliation error: {max_error:.6f} kWh")
    print()

print("=" * 70)
print("TRACE Evidence-Weighted Attribution Engine created successfully.")
print("=" * 70)
