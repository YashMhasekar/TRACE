import numpy as np
import pandas as pd

from config import (
    PHYSICAL_EXPECTED_PATH,
    OUTPUT_EVENTS,
    EXPECTED_INTERVAL_MINUTES,
    ensure_output_dir,
)

# Ensure output directory exists
ensure_output_dir()


# ---------------------------------------------------------
# Configuration
# ---------------------------------------------------------

LOW_OUTPUT_THRESHOLD_PCT = 40
MIN_EXPECTED_KWH = 5


# ---------------------------------------------------------
# Load physical + expected dataset
# ---------------------------------------------------------

df = pd.read_csv(PHYSICAL_EXPECTED_PATH)

df["measured_on"] = pd.to_datetime(df["measured_on"])

df = df.sort_values("measured_on").reset_index(drop=True)


# ---------------------------------------------------------
# Calculate performance variance percentage
# ---------------------------------------------------------

df["variance_pct"] = np.nan

valid = (
    df["expected_generation_kwh"].notna()
    & df["actual_generation_kwh"].notna()
    & (df["expected_generation_kwh"] > MIN_EXPECTED_KWH)
)

df.loc[valid, "variance_pct"] = (
    df.loc[valid, "generation_variance_kwh"]
    / df.loc[valid, "expected_generation_kwh"]
) * 100


# ---------------------------------------------------------
# Identify low-output observations
#
# This is evidence only.
# It does NOT identify the cause.
# ---------------------------------------------------------

df["low_output"] = (
    df["variance_pct"] > LOW_OUTPUT_THRESHOLD_PCT
)


# ---------------------------------------------------------
# Group consecutive low-output observations
#
# A new episode starts when:
#
# 1. The current observation is not low-output
# OR
# 2. There is a timestamp gap
#
# This prevents separate events from being created for
# every 15-minute record in the same continuous episode.
# ---------------------------------------------------------

low_output_df = df[df["low_output"]].copy()

if not low_output_df.empty:

    low_output_df["time_gap_minutes"] = (
        low_output_df["measured_on"]
        .diff()
        .dt.total_seconds()
        .div(60)
    )

    low_output_df["new_episode"] = (
        low_output_df["time_gap_minutes"].isna()
        | (
            low_output_df["time_gap_minutes"]
            > EXPECTED_INTERVAL_MINUTES
        )
    )

    low_output_df["episode_number"] = (
        low_output_df["new_episode"]
        .cumsum()
    )

else:

    low_output_df["episode_number"] = pd.Series(
        dtype="int64"
    )


# ---------------------------------------------------------
# Build event records
# ---------------------------------------------------------

events = []


# ---------------------------------------------------------
# Performance episodes
# ---------------------------------------------------------

if not low_output_df.empty:

    for episode_number, episode in low_output_df.groupby(
        "episode_number"
    ):

        start_time = episode["measured_on"].min()

        end_time = (
            episode["measured_on"].max()
            + pd.Timedelta(
                minutes=EXPECTED_INTERVAL_MINUTES
            )
        )

        duration_minutes = (
            end_time - start_time
        ).total_seconds() / 60

        expected_kwh = episode[
            "expected_generation_kwh"
        ].sum()

        actual_kwh = episode[
            "actual_generation_kwh"
        ].sum()

        variance_kwh = episode[
            "generation_variance_kwh"
        ].sum()

        average_variance_pct = episode[
            "variance_pct"
        ].mean()

        max_variance_pct = episode[
            "variance_pct"
        ].max()

        average_poa = episode[
            "poa_irradiance__5041"
        ].mean()

        average_module_temp = episode[
            "module_temp__5043"
        ].mean()

        average_dc_power = episode[
            "dc_power__5077"
        ].mean()

        average_ac_power = episode[
            "ac_power__5074"
        ].mean()

        average_pr = episode[
            "pr__5047"
        ].mean()

        events.append(
            {
                "event_id": f"PERF-{len(events) + 1:04d}",
                "timestamp_start": start_time,
                "timestamp_end": end_time,
                "asset_id": "SYSTEM-1430",
                "equipment": "PV_SYSTEM",
                "event_type": "LOW_OUTPUT_EPISODE",
                "severity": (
                    "CRITICAL"
                    if max_variance_pct >= 80
                    else "HIGH"
                ),
                "status": "OBSERVED",
                "evidence_source": "PERFORMANCE_MODEL",

                # Episode-level evidence
                "duration_minutes": round(
                    duration_minutes,
                    2,
                ),

                "expected_generation_kwh": round(
                    expected_kwh,
                    3,
                ),

                "actual_generation_kwh": round(
                    actual_kwh,
                    3,
                ),

                "observed_variance_kwh": round(
                    variance_kwh,
                    3,
                ),

                "average_variance_pct": round(
                    average_variance_pct,
                    2,
                ),

                "max_variance_pct": round(
                    max_variance_pct,
                    2,
                ),

                # Environmental / physical evidence
                "average_poa_irradiance": round(
                    average_poa,
                    2,
                ),

                "average_module_temp": round(
                    average_module_temp,
                    2,
                ),

                "average_dc_power": round(
                    average_dc_power,
                    2,
                ),

                "average_ac_power": round(
                    average_ac_power,
                    2,
                ),

                "average_pr": round(
                    average_pr,
                    4,
                ),
            }
        )


# ---------------------------------------------------------
# Missing AC measurement events
#
# These remain individual observations because each missing
# measurement represents a separate data-quality occurrence.
# ---------------------------------------------------------

missing_ac = df[
    df["ac_power__5074"].isna()
]


for _, row in missing_ac.iterrows():

    events.append(
        {
            "event_id": f"DATA-{len(events) + 1:04d}",
            "timestamp_start": row["measured_on"],
            "timestamp_end": (
                row["measured_on"]
                + pd.Timedelta(
                    minutes=EXPECTED_INTERVAL_MINUTES
                )
            ),
            "asset_id": "SYSTEM-1430",
            "equipment": "AC_MEASUREMENT",
            "event_type": "MISSING_AC_MEASUREMENT",
            "severity": "MEDIUM",
            "status": "OBSERVED",
            "evidence_source": "DATA_QUALITY",
            "duration_minutes": 15,
            "expected_generation_kwh": None,
            "actual_generation_kwh": None,
            "observed_variance_kwh": None,
            "average_variance_pct": None,
            "max_variance_pct": None,
            "average_poa_irradiance": (
                row["poa_irradiance__5041"]
                if pd.notna(
                    row["poa_irradiance__5041"]
                )
                else None
            ),
            "average_module_temp": (
                row["module_temp__5043"]
                if pd.notna(
                    row["module_temp__5043"]
                )
                else None
            ),
            "average_dc_power": (
                row["dc_power__5077"]
                if pd.notna(
                    row["dc_power__5077"]
                )
                else None
            ),
            "average_ac_power": None,
            "average_pr": (
                row["pr__5047"]
                if pd.notna(row["pr__5047"])
                else None
            ),
        }
    )


# ---------------------------------------------------------
# Irradiance sensor anomalies
# ---------------------------------------------------------

invalid_irradiance = df[
    df["poa_irradiance__5041"] < 0
]


for _, row in invalid_irradiance.iterrows():

    events.append(
        {
            "event_id": f"SENSOR-{len(events) + 1:04d}",
            "timestamp_start": row["measured_on"],
            "timestamp_end": (
                row["measured_on"]
                + pd.Timedelta(
                    minutes=EXPECTED_INTERVAL_MINUTES
                )
            ),
            "asset_id": "SYSTEM-1430",
            "equipment": "POA_SENSOR",
            "event_type": "IRRADIANCE_SENSOR_ANOMALY",
            "severity": "MEDIUM",
            "status": "OBSERVED",
            "evidence_source": "SENSOR_VALIDATION",
            "duration_minutes": 15,
            "expected_generation_kwh": None,
            "actual_generation_kwh": None,
            "observed_variance_kwh": None,
            "average_variance_pct": None,
            "max_variance_pct": None,
            "average_poa_irradiance": round(
                float(row["poa_irradiance__5041"]),
                2,
            ),
            "average_module_temp": None,
            "average_dc_power": None,
            "average_ac_power": (
                row["ac_power__5074"]
                if pd.notna(
                    row["ac_power__5074"]
                )
                else None
            ),
            "average_pr": None,
        }
    )


# ---------------------------------------------------------
# Suspicious PR events
# ---------------------------------------------------------

suspicious_pr = df[
    df["pr__5047"] > 1
]


for _, row in suspicious_pr.iterrows():

    events.append(
        {
            "event_id": f"METRIC-{len(events) + 1:04d}",
            "timestamp_start": row["measured_on"],
            "timestamp_end": (
                row["measured_on"]
                + pd.Timedelta(
                    minutes=EXPECTED_INTERVAL_MINUTES
                )
            ),
            "asset_id": "SYSTEM-1430",
            "equipment": "PERFORMANCE_METRIC",
            "event_type": "SUSPICIOUS_PR",
            "severity": "MEDIUM",
            "status": "OBSERVED",
            "evidence_source": "PERFORMANCE_METRIC",
            "duration_minutes": 15,
            "expected_generation_kwh": None,
            "actual_generation_kwh": None,
            "observed_variance_kwh": None,
            "average_variance_pct": None,
            "max_variance_pct": None,
            "average_poa_irradiance": (
                row["poa_irradiance__5041"]
                if pd.notna(
                    row["poa_irradiance__5041"]
                )
                else None
            ),
            "average_module_temp": (
                row["module_temp__5043"]
                if pd.notna(
                    row["module_temp__5043"]
                )
                else None
            ),
            "average_dc_power": (
                row["dc_power__5077"]
                if pd.notna(
                    row["dc_power__5077"]
                )
                else None
            ),
            "average_ac_power": (
                row["ac_power__5074"]
                if pd.notna(
                    row["ac_power__5074"]
                )
                else None
            ),
            "average_pr": round(
                float(row["pr__5047"]),
                4,
            ),
        }
    )


# ---------------------------------------------------------
# Create final event DataFrame
# ---------------------------------------------------------

events_df = pd.DataFrame(events)


# ---------------------------------------------------------
# Sort chronologically
# ---------------------------------------------------------

if not events_df.empty:

    events_df = events_df.sort_values(
        "timestamp_start"
    ).reset_index(drop=True)


# ---------------------------------------------------------
# Save
# ---------------------------------------------------------

events_df.to_csv(
    OUTPUT_EVENTS,
    index=False,
)


# ---------------------------------------------------------
# Report
# ---------------------------------------------------------

print("TRACE event evidence dataset created.")
print()

print("Output:")
print(OUTPUT_EVENTS)

print()

print("Total events:", len(events_df))

print()

print("Event types:")

if not events_df.empty:

    print(
        events_df["event_type"]
        .value_counts()
        .to_string()
    )

print()

print("Low-output episodes:")

print(
    (
        events_df["event_type"]
        == "LOW_OUTPUT_EPISODE"
    ).sum()
)

print()

print("Columns:")
print(
    ", ".join(events_df.columns)
)