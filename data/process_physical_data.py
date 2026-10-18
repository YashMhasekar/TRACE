import glob
import pandas as pd

from config import (
    RAW_PVDAQ_PATTERN,
    OUTPUT_PHYSICAL_DATA,
    ensure_output_dir,
)

# Ensure output directory exists
ensure_output_dir()

# Load all raw daily files
files = sorted(glob.glob(RAW_PVDAQ_PATTERN))

df = pd.concat(
    [pd.read_csv(file) for file in files],
    ignore_index=True,
)

# Convert timestamp
df["measured_on"] = pd.to_datetime(df["measured_on"])

# Sort chronologically
df = df.sort_values("measured_on").reset_index(drop=True)


# ---------------------------------------------------------
# Actual generation
# AC power is in kW and each record represents 15 minutes.
# Energy = Power × Time
# ---------------------------------------------------------

df["actual_generation_kwh"] = (
    df["ac_power__5074"].fillna(0) * 0.25
)


# ---------------------------------------------------------
# Data quality flags
# ---------------------------------------------------------

df["data_quality_flag"] = "OK"

df.loc[
    df["ac_power__5074"].isna(),
    "data_quality_flag"
] = "MISSING_AC_POWER"

df.loc[
    (df["poa_irradiance__5041"] < 0)
    & df["poa_irradiance__5041"].notna(),
    "data_quality_flag"
] = "INVALID_IRRADIANCE"

df.loc[
    (df["pr__5047"] > 1)
    & df["pr__5047"].notna(),
    "data_quality_flag"
] = "SUSPICIOUS_PR"


# ---------------------------------------------------------
# Keep the important physical evidence
# ---------------------------------------------------------

output_columns = [
    "measured_on",
    "system_id",

    # Primary physical output
    "ac_power__5074",
    "actual_generation_kwh",

    # Environmental evidence
    "poa_irradiance__5041",
    "ambient_temp__5042",
    "module_temp__5043",

    # Electrical evidence
    "dc_power__5077",
    "dc_current__5076",
    "dc_voltage__5075",

    # Raw meter evidence
    "kwh_gross__5045",
    "kwh_net__5046",

    # Existing performance signal
    "pr__5047",

    # TRACE data-quality layer
    "data_quality_flag",
]

physical_df = df[output_columns]


# Save
physical_df.to_csv(OUTPUT_PHYSICAL_DATA, index=False)


print("Physical dataset created successfully.")
print("Rows:", len(physical_df))
print("Columns:", len(physical_df.columns))
print("Output:", OUTPUT_PHYSICAL_DATA)
print("\nData quality:")
print(physical_df["data_quality_flag"].value_counts())