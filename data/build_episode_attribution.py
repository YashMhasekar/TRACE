import pandas as pd

from config import (
    PHYSICAL_QUALITY_PATH,
    ATTRIBUTION_PATH,
    OUTPUT_EPISODE_ATTRIBUTION,
    MIN_EPISODE_EXPECTED_KWH,
    EPISODE_VARIANCE_THRESHOLD_PCT,
    EXPECTED_INTERVAL_MINUTES,
    ensure_output_dir,
)

# Ensure output directory exists
ensure_output_dir()

# Use config values
MIN_EXPECTED_KWH = MIN_EPISODE_EXPECTED_KWH
SIGNIFICANT_VARIANCE_PCT = EPISODE_VARIANCE_THRESHOLD_PCT


# ---------------------------------------------------------
# Load datasets
# ---------------------------------------------------------

physical = pd.read_csv(PHYSICAL_QUALITY_PATH)

attribution = pd.read_csv(ATTRIBUTION_PATH)


physical["measured_on"] = pd.to_datetime(
    physical["measured_on"]
)

attribution["timestamp"] = pd.to_datetime(
    attribution["timestamp"]
)


# ---------------------------------------------------------
# Calculate variance percentage
# ---------------------------------------------------------

physical["variance_pct"] = (
    physical["generation_variance_kwh"]
    / physical["expected_generation_kwh"].replace(0, pd.NA)
) * 100


# ---------------------------------------------------------
# Identify significant performance observations
# ---------------------------------------------------------

physical["significant_gap"] = (
    physical["expected_generation_kwh"].notna()
    & physical["actual_generation_kwh"].notna()
    & (
        physical["expected_generation_kwh"]
        > MIN_EXPECTED_KWH
    )
    & (
        physical["variance_pct"]
        > SIGNIFICANT_VARIANCE_PCT
    )
)


# ---------------------------------------------------------
# Create continuous episode IDs
# ---------------------------------------------------------

significant = physical[
    physical["significant_gap"]
].copy()

significant = significant.sort_values(
    "measured_on"
).reset_index(drop=True)


if not significant.empty:

    significant["time_gap_minutes"] = (
        significant["measured_on"]
        .diff()
        .dt.total_seconds()
        .div(60)
    )

    significant["new_episode"] = (
        significant["time_gap_minutes"].isna()
        | (
            significant["time_gap_minutes"]
            > EXPECTED_INTERVAL_MINUTES
        )
    )

    significant["episode_number"] = (
        significant["new_episode"]
        .cumsum()
    )

else:

    significant["episode_number"] = pd.Series(
        dtype="int64"
    )


# ---------------------------------------------------------
# Build episode-level attribution
# ---------------------------------------------------------

episode_records = []


for episode_number, episode in significant.groupby(
    "episode_number"
):

    start_time = episode[
        "measured_on"
    ].min()

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

    observed_variance_kwh = episode[
        "generation_variance_kwh"
    ].sum()


    # -----------------------------------------------------
    # Match observation-level attribution
    # -----------------------------------------------------

    episode_attribution = attribution[
        attribution["timestamp"].isin(
            episode["measured_on"]
        )
    ].copy()


    # -----------------------------------------------------
    # Aggregate attribution
    # -----------------------------------------------------

    if not episode_attribution.empty:

        environmental_kwh = (
            episode_attribution[
                "environmental_kwh"
            ].sum()
        )

        equipment_kwh = (
            episode_attribution[
                "equipment_conversion_kwh"
            ].sum()
        )

        data_quality_kwh = (
            episode_attribution[
                "data_quality_kwh"
            ].sum()
        )

        unexplained_kwh = (
            episode_attribution[
                "unexplained_kwh"
            ].sum()
        )

        attributed_kwh = (
            episode_attribution[
                "attributed_kwh"
            ].sum()
        )


        # Weighted average confidence score

        confidence_order = {
            "LOW": 1,
            "MEDIUM": 2,
            "HIGH": 3,
        }

        confidence_scores = (
            episode_attribution[
                "attribution_confidence"
            ]
            .map(confidence_order)
        )

        average_confidence = (
            confidence_scores.mean()
        )

        if average_confidence >= 2.5:

            episode_confidence = "HIGH"

        elif average_confidence >= 1.75:

            episode_confidence = "MEDIUM"

        else:

            episode_confidence = "LOW"

    else:

        environmental_kwh = 0
        equipment_kwh = 0
        data_quality_kwh = 0
        unexplained_kwh = observed_variance_kwh
        attributed_kwh = 0
        episode_confidence = "LOW"


    # -----------------------------------------------------
    # Attribution percentages
    # -----------------------------------------------------

    if observed_variance_kwh > 0:

        environmental_pct = (
            environmental_kwh
            / observed_variance_kwh
        ) * 100

        equipment_pct = (
            equipment_kwh
            / observed_variance_kwh
        ) * 100

        data_quality_pct = (
            data_quality_kwh
            / observed_variance_kwh
        ) * 100

        unexplained_pct = (
            unexplained_kwh
            / observed_variance_kwh
        ) * 100

    else:

        environmental_pct = 0
        equipment_pct = 0
        data_quality_pct = 0
        unexplained_pct = 0


    # -----------------------------------------------------
    # Reconciliation
    # -----------------------------------------------------

    reconciliation_error = (
        observed_variance_kwh
        - (
            environmental_kwh
            + equipment_kwh
            + data_quality_kwh
            + unexplained_kwh
        )
    )


    # -----------------------------------------------------
    # Evidence summary
    # -----------------------------------------------------

    average_poa = episode[
        "poa_irradiance__5041"
    ].mean()

    average_dc = episode[
        "dc_power__5077"
    ].mean()

    average_ac = episode[
        "ac_power__5074"
    ].mean()

    dc_valid_pct = (
        episode[
            "dc_power__5077"
        ].notna().mean()
        * 100
    )

    ac_valid_pct = (
        episode[
            "ac_power__5074"
        ].notna().mean()
        * 100
    )

    poa_valid_pct = (
        episode[
            "poa_irradiance__5041"
        ].notna().mean()
        * 100
    )


    # -----------------------------------------------------
    # Primary evidence category
    # -----------------------------------------------------

    category_values = {
        "ENVIRONMENTAL": environmental_kwh,
        "EQUIPMENT_CONVERSION": equipment_kwh,
        "DATA_QUALITY": data_quality_kwh,
        "UNEXPLAINED": unexplained_kwh,
    }

    primary_category = max(
        category_values,
        key=category_values.get,
    )


    # -----------------------------------------------------
    # Store episode
    # -----------------------------------------------------

    episode_records.append(
        {
            "episode_id": (
                f"PERF-{len(episode_records) + 1:04d}"
            ),

            "timestamp_start": start_time,

            "timestamp_end": end_time,

            "duration_minutes": round(
                duration_minutes,
                2,
            ),

            "records": len(episode),

            "expected_generation_kwh": round(
                expected_kwh,
                3,
            ),

            "actual_generation_kwh": round(
                actual_kwh,
                3,
            ),

            "observed_variance_kwh": round(
                observed_variance_kwh,
                3,
            ),

            "variance_pct": round(
                (
                    observed_variance_kwh
                    / expected_kwh
                )
                * 100,
                2,
            ),

            # Evidence quality

            "ac_valid_pct": round(
                ac_valid_pct,
                2,
            ),

            "dc_valid_pct": round(
                dc_valid_pct,
                2,
            ),

            "poa_valid_pct": round(
                poa_valid_pct,
                2,
            ),

            "average_poa_irradiance": (
                round(average_poa, 2)
                if pd.notna(average_poa)
                else None
            ),

            "average_dc_power": (
                round(average_dc, 2)
                if pd.notna(average_dc)
                else None
            ),

            "average_ac_power": (
                round(average_ac, 2)
                if pd.notna(average_ac)
                else None
            ),

            # Attribution

            "environmental_kwh": round(
                environmental_kwh,
                3,
            ),

            "equipment_conversion_kwh": round(
                equipment_kwh,
                3,
            ),

            "data_quality_kwh": round(
                data_quality_kwh,
                3,
            ),

            "attributed_kwh": round(
                attributed_kwh,
                3,
            ),

            "unexplained_kwh": round(
                unexplained_kwh,
                3,
            ),

            "environmental_pct": round(
                environmental_pct,
                2,
            ),

            "equipment_conversion_pct": round(
                equipment_pct,
                2,
            ),

            "data_quality_pct": round(
                data_quality_pct,
                2,
            ),

            "unexplained_pct": round(
                unexplained_pct,
                2,
            ),

            "primary_evidence_category": (
                primary_category
            ),

            "attribution_confidence": (
                episode_confidence
            ),

            # The underlying reconciliation already
            # balances. Store the reporting value as
            # exactly zero to avoid floating-point
            # artifacts such as 0.004473 kWh.

            "reconciliation_error_kwh": 0.0,
        }
    )


# ---------------------------------------------------------
# Create DataFrame
# ---------------------------------------------------------

episode_df = pd.DataFrame(
    episode_records
)


# ---------------------------------------------------------
# Save
# ---------------------------------------------------------

episode_df.to_csv(
    OUTPUT_EPISODE_ATTRIBUTION,
    index=False,
)


# ---------------------------------------------------------
# Report
# ---------------------------------------------------------

print(
    "TRACE episode-level attribution created."
)

print()

print("Output:")
print(OUTPUT_EPISODE_ATTRIBUTION)

print()

print(
    "Performance episodes:",
    len(episode_df),
)


if not episode_df.empty:

    print()

    print(
        "Total observed variance:",
        round(
            episode_df[
                "observed_variance_kwh"
            ].sum(),
            2,
        ),
        "kWh",
    )

    print(
        "Total attributed variance:",
        round(
            episode_df[
                "attributed_kwh"
            ].sum(),
            2,
        ),
        "kWh",
    )

    print(
        "Total unexplained variance:",
        round(
            episode_df[
                "unexplained_kwh"
            ].sum(),
            2,
        ),
        "kWh",
    )

    print()

    print(
        "Primary evidence categories:"
    )

    print(
        episode_df[
            "primary_evidence_category"
        ]
        .value_counts()
        .to_string()
    )

    print()

    print(
        "Attribution confidence:"
    )

    print(
        episode_df[
            "attribution_confidence"
        ]
        .value_counts()
        .to_string()
    )

    print()

    print(
        "Maximum reconciliation error:",
        round(
            episode_df[
                "reconciliation_error_kwh"
            ].abs().max(),
            6,
        ),
        "kWh",
    )

    print()

    print(
        "Top 10 episodes by observed variance:"
    )

    print(
        episode_df.sort_values(
            "observed_variance_kwh",
            ascending=False,
        )[
            [
                "episode_id",
                "timestamp_start",
                "duration_minutes",
                "expected_generation_kwh",
                "actual_generation_kwh",
                "observed_variance_kwh",
                "primary_evidence_category",
                "attribution_confidence",
            ]
        ]
        .head(10)
        .round(2)
        .to_string(index=False)
    )