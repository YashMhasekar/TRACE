import numpy as np
import pandas as pd

from config import (
    PHYSICAL_EXPECTED_PATH,
    OUTPUT_PHYSICAL_QUALITY,
    ensure_output_dir,
)

# Ensure output directory exists
ensure_output_dir()


# ---------------------------------------------------------
# Load dataset
# ---------------------------------------------------------

df = pd.read_csv(PHYSICAL_EXPECTED_PATH)

df["measured_on"] = pd.to_datetime(
    df["measured_on"]
)


# ---------------------------------------------------------
# Basic measurement-quality flags
#
# IMPORTANT:
# We do NOT delete suspicious measurements.
# We preserve the raw values and add quality metadata.
# ---------------------------------------------------------

df["ac_measurement_valid"] = (
    df["ac_power__5074"].notna()
    & (df["ac_power__5074"] >= 0)
)

df["dc_measurement_valid"] = (
    df["dc_power__5077"].notna()
    & (df["dc_power__5077"] >= 0)
)

df["poa_measurement_valid"] = (
    df["poa_irradiance__5041"].notna()
    & (df["poa_irradiance__5041"] >= 0)
)

df["module_temperature_valid"] = (
    df["module_temp__5043"].notna()
)

df["pr_measurement_valid"] = (
    df["pr__5047"].notna()
    & (df["pr__5047"] >= 0)
    & (df["pr__5047"] <= 1)
)


# ---------------------------------------------------------
# Production observability
#
# A production observation is considered observable only
# when the primary AC measurement is valid.
#
# This prevents missing AC measurements from being treated
# as confirmed zero production.
# ---------------------------------------------------------

df["production_observable"] = (
    df["ac_measurement_valid"]
)


# ---------------------------------------------------------
# Environmental observability
#
# Expected-generation confidence requires valid irradiance
# and module temperature.
# ---------------------------------------------------------

df["environment_observable"] = (
    df["poa_measurement_valid"]
    & df["module_temperature_valid"]
)


# ---------------------------------------------------------
# Physical measurement quality
#
# GOOD:
#   AC + DC + POA are valid.
#
# DEGRADED:
#   AC is valid but another physical sensor is suspicious
#   or unavailable.
#
# POOR:
#   AC measurement itself is unavailable/invalid.
# ---------------------------------------------------------

df["measurement_quality"] = "GOOD"

degraded = (
    df["ac_measurement_valid"]
    & (
        ~df["dc_measurement_valid"]
        | ~df["poa_measurement_valid"]
        | ~df["module_temperature_valid"]
    )
)

poor = ~df["ac_measurement_valid"]

df.loc[degraded, "measurement_quality"] = "DEGRADED"

df.loc[poor, "measurement_quality"] = "POOR"


# ---------------------------------------------------------
# Production evidence quality
#
# This is specifically about whether we can trust an
# observed production value for attribution.
# ---------------------------------------------------------

df["production_evidence_quality"] = "HIGH"

df.loc[
    ~df["environment_observable"],
    "production_evidence_quality",
] = "MEDIUM"

df.loc[
    ~df["production_observable"],
    "production_evidence_quality",
] = "LOW"


# ---------------------------------------------------------
# Data-quality reason
#
# Keep the explanation explicit.
# ---------------------------------------------------------

df["data_quality_reason"] = "VALID_MEASUREMENTS"


df.loc[
    ~df["ac_measurement_valid"],
    "data_quality_reason",
] = "MISSING_OR_INVALID_AC_POWER"


df.loc[
    df["ac_measurement_valid"]
    & ~df["dc_measurement_valid"],
    "data_quality_reason",
] = "INVALID_OR_MISSING_DC_POWER"


df.loc[
    df["ac_measurement_valid"]
    & df["dc_measurement_valid"]
    & ~df["poa_measurement_valid"],
    "data_quality_reason",
] = "INVALID_OR_MISSING_POA_IRRADIANCE"


df.loc[
    df["ac_measurement_valid"]
    & df["dc_measurement_valid"]
    & df["poa_measurement_valid"]
    & ~df["module_temperature_valid"],
    "data_quality_reason",
] = "MISSING_MODULE_TEMPERATURE"


# ---------------------------------------------------------
# More precise quality flags
#
# These preserve multiple problems simultaneously.
# ---------------------------------------------------------

df["quality_flag_ac"] = np.where(
    df["ac_measurement_valid"],
    "VALID",
    "INVALID_OR_MISSING",
)

df["quality_flag_dc"] = np.where(
    df["dc_measurement_valid"],
    "VALID",
    "INVALID_OR_MISSING",
)

df["quality_flag_poa"] = np.where(
    df["poa_measurement_valid"],
    "VALID",
    "INVALID_OR_MISSING",
)

df["quality_flag_temperature"] = np.where(
    df["module_temperature_valid"],
    "VALID",
    "INVALID_OR_MISSING",
)

df["quality_flag_pr"] = np.where(
    df["pr_measurement_valid"],
    "VALID",
    "INVALID_OR_MISSING",
)


# ---------------------------------------------------------
# Confirmed performance-gap eligibility
#
# A gap can only enter causal attribution when:
#
# 1. Expected generation exists
# 2. Actual AC measurement is observable
# 3. Environmental inputs used for expectation are valid
#
# We do NOT require DC to be valid because a missing DC
# sensor should reduce confidence rather than erase a valid
# AC production observation.
# ---------------------------------------------------------

df["attribution_eligible"] = (
    df["expected_generation_kwh"].notna()
    & df["actual_generation_kwh"].notna()
    & df["production_observable"]
    & df["environment_observable"]
)


# ---------------------------------------------------------
# Attribution confidence
# ---------------------------------------------------------

df["attribution_confidence"] = "LOW"

df.loc[
    df["attribution_eligible"]
    & df["dc_measurement_valid"],
    "attribution_confidence",
] = "HIGH"

df.loc[
    df["attribution_eligible"]
    & ~df["dc_measurement_valid"],
    "attribution_confidence",
] = "MEDIUM"


# ---------------------------------------------------------
# Measurement uncertainty flag
#
# This is important for Proof Mode.
# ---------------------------------------------------------

df["measurement_uncertainty"] = (
    ~df["production_observable"]
    | ~df["environment_observable"]
)


# ---------------------------------------------------------
# Save
# ---------------------------------------------------------

df.to_csv(OUTPUT_PHYSICAL_QUALITY, index=False)


# ---------------------------------------------------------
# Report
# ---------------------------------------------------------

print("TRACE Data Quality Guard created.")
print()

print("Output:")
print(OUTPUT_PHYSICAL_QUALITY)

print()

print("Rows:", len(df))

print()

print("Measurement quality:")
print(
    df["measurement_quality"]
    .value_counts()
    .to_string()
)

print()

print("Production observable:")
print(
    df["production_observable"]
    .value_counts()
    .to_string()
)

print()

print("Attribution eligible:")
print(
    df["attribution_eligible"]
    .value_counts()
    .to_string()
)

print()

print("Attribution confidence:")
print(
    df["attribution_confidence"]
    .value_counts()
    .to_string()
)

print()

print("Data quality reasons:")
print(
    df["data_quality_reason"]
    .value_counts()
    .to_string()
)