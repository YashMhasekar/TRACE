import pandas as pd

from config import (
    PHYSICAL_QUALITY_PATH,
    DECISION_INTELLIGENCE_PATH,
    OUTPUT_COMMERCIAL_IMPACT,
    OUTPUT_EPISODE_FINANCIAL,
    BASELINE_TARIFF_USD_PER_KWH,
    SETTLEMENT_FACTOR,
    COMMERCIAL_ADJUSTMENT_USD,
    ensure_output_dir,
)

# Ensure output directory exists
ensure_output_dir()


# ---------------------------------------------------------
# Load datasets
# ---------------------------------------------------------

physical = pd.read_csv(PHYSICAL_QUALITY_PATH)

decision = pd.read_csv(DECISION_INTELLIGENCE_PATH)


physical["measured_on"] = pd.to_datetime(
    physical["measured_on"]
)

decision["timestamp_start"] = pd.to_datetime(
    decision["timestamp_start"]
)


# ---------------------------------------------------------
# Aggregate physical performance
# ---------------------------------------------------------

valid_physical = physical[
    physical["attribution_eligible"] == True
].copy()


expected_generation_kwh = (
    valid_physical[
        "expected_generation_kwh"
    ]
    .sum()
)

actual_generation_kwh = (
    valid_physical[
        "actual_generation_kwh"
    ]
    .sum()
)

generation_gap_kwh = (
    expected_generation_kwh
    - actual_generation_kwh
)


# ---------------------------------------------------------
# Baseline commercial value
# ---------------------------------------------------------

baseline_energy_value_usd = (
    expected_generation_kwh
    * BASELINE_TARIFF_USD_PER_KWH
)


# ---------------------------------------------------------
# Settlement calculation
# ---------------------------------------------------------
#
# Settlement is calculated independently from the
# baseline.
#
# Baseline:
#     expected generation × baseline tariff
#
# Settlement:
#     actual generation × settlement factor × tariff
# ---------------------------------------------------------

settled_generation_kwh = (
    actual_generation_kwh
    * SETTLEMENT_FACTOR
)

actual_settlement_value_usd = (
    settled_generation_kwh
    * BASELINE_TARIFF_USD_PER_KWH
)


# ---------------------------------------------------------
# Generation-driven revenue impact
# ---------------------------------------------------------

generation_driven_revenue_loss_usd = (
    generation_gap_kwh
    * BASELINE_TARIFF_USD_PER_KWH
    * SETTLEMENT_FACTOR
)


# ---------------------------------------------------------
# Commercial adjustment
# ---------------------------------------------------------

commercial_driven_revenue_impact_usd = (
    COMMERCIAL_ADJUSTMENT_USD
)


# ---------------------------------------------------------
# Total revenue gap
# ---------------------------------------------------------

total_revenue_gap_usd = (
    generation_driven_revenue_loss_usd
    + commercial_driven_revenue_impact_usd
)


# ---------------------------------------------------------
# Recovery potential
# ---------------------------------------------------------

total_recovery_potential_kwh = (
    decision[
        "recovery_potential_kwh"
    ]
    .sum()
)


recovery_revenue_potential_usd = (
    total_recovery_potential_kwh
    * BASELINE_TARIFF_USD_PER_KWH
    * SETTLEMENT_FACTOR
)


# ---------------------------------------------------------
# Generation vs commercial percentages
# ---------------------------------------------------------

if abs(total_revenue_gap_usd) > 0:

    generation_driven_pct = (
        generation_driven_revenue_loss_usd
        / total_revenue_gap_usd
    ) * 100

    commercial_driven_pct = (
        commercial_driven_revenue_impact_usd
        / total_revenue_gap_usd
    ) * 100

else:

    generation_driven_pct = 0.0
    commercial_driven_pct = 0.0


# ---------------------------------------------------------
# Commercial summary
# ---------------------------------------------------------

summary = pd.DataFrame(
    [
        {
            "period_start": physical[
                "measured_on"
            ].min(),

            "period_end": physical[
                "measured_on"
            ].max(),

            "expected_generation_kwh": round(
                expected_generation_kwh,
                3,
            ),

            "actual_generation_kwh": round(
                actual_generation_kwh,
                3,
            ),

            "generation_gap_kwh": round(
                generation_gap_kwh,
                3,
            ),

            "tariff_usd_per_kwh": (
                BASELINE_TARIFF_USD_PER_KWH
            ),

            "settlement_factor": (
                SETTLEMENT_FACTOR
            ),

            "baseline_energy_value_usd": round(
                baseline_energy_value_usd,
                2,
            ),

            "settled_generation_kwh": round(
                settled_generation_kwh,
                3,
            ),

            "actual_settlement_value_usd": round(
                actual_settlement_value_usd,
                2,
            ),

            "generation_driven_revenue_loss_usd": round(
                generation_driven_revenue_loss_usd,
                2,
            ),

            "commercial_driven_revenue_impact_usd": round(
                commercial_driven_revenue_impact_usd,
                2,
            ),

            "total_revenue_gap_usd": round(
                total_revenue_gap_usd,
                2,
            ),

            "generation_driven_pct": round(
                generation_driven_pct,
                2,
            ),

            "commercial_driven_pct": round(
                commercial_driven_pct,
                2,
            ),

            "recovery_potential_kwh": round(
                total_recovery_potential_kwh,
                3,
            ),

            "recovery_revenue_potential_usd": round(
                recovery_revenue_potential_usd,
                2,
            ),

            "commercial_data_source": (
                "SYNTHETIC_TRACE_ASSUMPTION"
            ),
        }
    ]
)


# ---------------------------------------------------------
# Episode-level financial impact
# ---------------------------------------------------------

episode_financial = decision[
    [
        "episode_id",
        "timestamp_start",
        "timestamp_end",
        "observed_variance_kwh",
        "recovery_potential_kwh",
        "primary_evidence_category",
        "attribution_confidence",
        "priority",
    ]
].copy()


episode_financial[
    "generation_revenue_impact_usd"
] = (
    episode_financial[
        "observed_variance_kwh"
    ]
    * BASELINE_TARIFF_USD_PER_KWH
    * SETTLEMENT_FACTOR
)


episode_financial[
    "recovery_revenue_potential_usd"
] = (
    episode_financial[
        "recovery_potential_kwh"
    ]
    * BASELINE_TARIFF_USD_PER_KWH
    * SETTLEMENT_FACTOR
)


episode_financial[
    "generation_revenue_impact_usd"
] = (
    episode_financial[
        "generation_revenue_impact_usd"
    ]
    .round(2)
)


episode_financial[
    "recovery_revenue_potential_usd"
] = (
    episode_financial[
        "recovery_revenue_potential_usd"
    ]
    .round(2)
)


# ---------------------------------------------------------
# Save episode financial data
# ---------------------------------------------------------

episode_financial.to_csv(
    OUTPUT_EPISODE_FINANCIAL,
    index=False,
)


# ---------------------------------------------------------
# Save commercial summary
# ---------------------------------------------------------

summary.to_csv(
    OUTPUT_COMMERCIAL_IMPACT,
    index=False,
)


# ---------------------------------------------------------
# Report
# ---------------------------------------------------------

print(
    "TRACE Commercial & Settlement Layer created."
)

print()

print("Summary output:")
print(OUTPUT_COMMERCIAL_IMPACT)

print()

print("Episode financial output:")
print(OUTPUT_EPISODE_FINANCIAL)

print()

print(
    "Commercial data source:",
    "SYNTHETIC_TRACE_ASSUMPTION",
)

print()

print(
    "Expected generation:",
    round(
        expected_generation_kwh,
        2,
    ),
    "kWh",
)

print(
    "Actual generation:",
    round(
        actual_generation_kwh,
        2,
    ),
    "kWh",
)

print(
    "Generation gap:",
    round(
        generation_gap_kwh,
        2,
    ),
    "kWh",
)

print()

print(
    "Tariff:",
    BASELINE_TARIFF_USD_PER_KWH,
    "USD/kWh",
)

print(
    "Settlement factor:",
    SETTLEMENT_FACTOR,
)

print()

print(
    "Baseline energy value:",
    round(
        baseline_energy_value_usd,
        2,
    ),
    "USD",
)

print(
    "Actual settlement value:",
    round(
        actual_settlement_value_usd,
        2,
    ),
    "USD",
)

print()

print(
    "Generation-driven revenue loss:",
    round(
        generation_driven_revenue_loss_usd,
        2,
    ),
    "USD",
)

print(
    "Commercial-driven revenue impact:",
    round(
        commercial_driven_revenue_impact_usd,
        2,
    ),
    "USD",
)

print(
    "Total revenue gap:",
    round(
        total_revenue_gap_usd,
        2,
    ),
    "USD",
)

print()

print(
    "Generation-driven:",
    round(
        generation_driven_pct,
        2,
    ),
    "%",
)

print(
    "Commercial-driven:",
    round(
        commercial_driven_pct,
        2,
    ),
    "%",
)

print()

print(
    "Recovery potential:",
    round(
        total_recovery_potential_kwh,
        2,
    ),
    "kWh",
)

print(
    "Recovery revenue potential:",
    round(
        recovery_revenue_potential_usd,
        2,
    ),
    "USD",
)

print()

print(
    "Commercial & settlement layer completed."
)