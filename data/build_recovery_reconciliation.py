import pandas as pd

from config import (
    PHYSICAL_QUALITY_PATH,
    DECISION_INTELLIGENCE_PATH,
    COMMERCIAL_IMPACT_PATH,
    OUTPUT_RECOVERY_RECONCILIATION,
    ensure_output_dir,
)

# Ensure output directory exists
ensure_output_dir()


# ---------------------------------------------------------
# Load datasets
# ---------------------------------------------------------

physical = pd.read_csv(PHYSICAL_QUALITY_PATH)

decision = pd.read_csv(DECISION_INTELLIGENCE_PATH)

commercial = pd.read_csv(COMMERCIAL_IMPACT_PATH)


# ---------------------------------------------------------
# Calculate period-level physical gap
# ---------------------------------------------------------

valid_physical = physical[
    physical["attribution_eligible"] == True
].copy()


expected_generation_kwh = (
    valid_physical[
        "expected_generation_kwh"
    ].sum()
)


actual_generation_kwh = (
    valid_physical[
        "actual_generation_kwh"
    ].sum()
)


period_generation_gap_kwh = (
    expected_generation_kwh
    - actual_generation_kwh
)


# ---------------------------------------------------------
# Raw episode recovery
# ---------------------------------------------------------

raw_episode_recovery_kwh = (
    decision[
        "recovery_potential_kwh"
    ].sum()
)


# ---------------------------------------------------------
# Positive recovery cap
# ---------------------------------------------------------

positive_generation_gap_kwh = max(
    0.0,
    period_generation_gap_kwh,
)


# ---------------------------------------------------------
# Reconciled recovery
# ---------------------------------------------------------
#
# Recovery cannot exceed the period-level generation
# shortfall.
#
# This prevents episode-level opportunities from
# overstating total recoverable generation.
# ---------------------------------------------------------

reconciled_recovery_kwh = min(
    raw_episode_recovery_kwh,
    positive_generation_gap_kwh,
)


# ---------------------------------------------------------
# Unreconciled recovery opportunity
# ---------------------------------------------------------

unreconciled_recovery_kwh = max(
    0.0,
    raw_episode_recovery_kwh
    - reconciled_recovery_kwh,
)


# ---------------------------------------------------------
# Recovery reconciliation percentage
# ---------------------------------------------------------

if raw_episode_recovery_kwh > 0:

    recovery_reconciliation_pct = (
        reconciled_recovery_kwh
        / raw_episode_recovery_kwh
    ) * 100

else:

    recovery_reconciliation_pct = 0.0


# ---------------------------------------------------------
# Commercial assumptions
# ---------------------------------------------------------
#
# Read tariff and settlement factor from the commercial
# layer instead of hardcoding them again.
# ---------------------------------------------------------

tariff_usd_per_kwh = float(
    commercial.iloc[0][
        "tariff_usd_per_kwh"
    ]
)


settlement_factor = float(
    commercial.iloc[0][
        "settlement_factor"
    ]
)


# ---------------------------------------------------------
# Reconciled recovery revenue
# ---------------------------------------------------------

reconciled_recovery_revenue_usd = (
    reconciled_recovery_kwh
    * tariff_usd_per_kwh
    * settlement_factor
)


unreconciled_recovery_revenue_usd = (
    unreconciled_recovery_kwh
    * tariff_usd_per_kwh
    * settlement_factor
)


# ---------------------------------------------------------
# Reconciled recovery share of period gap
# ---------------------------------------------------------

if positive_generation_gap_kwh > 0:

    recovery_share_of_generation_gap_pct = (
        reconciled_recovery_kwh
        / positive_generation_gap_kwh
    ) * 100

else:

    recovery_share_of_generation_gap_pct = 0.0


# ---------------------------------------------------------
# Recovery status
# ---------------------------------------------------------

if period_generation_gap_kwh <= 0:

    recovery_status = (
        "NO_NET_GENERATION_SHORTFALL"
    )

elif raw_episode_recovery_kwh <= positive_generation_gap_kwh:

    recovery_status = (
        "FULLY_RECONCILED"
    )

else:

    recovery_status = (
        "CAPPED_TO_PERIOD_GAP"
    )


# ---------------------------------------------------------
# Build summary
# ---------------------------------------------------------

summary = pd.DataFrame(
    [
        {
            "period_start": valid_physical[
                "measured_on"
            ].min()
            if "measured_on" in valid_physical.columns
            else None,

            "period_end": valid_physical[
                "measured_on"
            ].max()
            if "measured_on" in valid_physical.columns
            else None,

            "expected_generation_kwh": round(
                expected_generation_kwh,
                3,
            ),

            "actual_generation_kwh": round(
                actual_generation_kwh,
                3,
            ),

            "period_generation_gap_kwh": round(
                period_generation_gap_kwh,
                3,
            ),

            "raw_episode_recovery_kwh": round(
                raw_episode_recovery_kwh,
                3,
            ),

            "positive_generation_gap_kwh": round(
                positive_generation_gap_kwh,
                3,
            ),

            "reconciled_recovery_kwh": round(
                reconciled_recovery_kwh,
                3,
            ),

            "unreconciled_recovery_kwh": round(
                unreconciled_recovery_kwh,
                3,
            ),

            "recovery_reconciliation_pct": round(
                recovery_reconciliation_pct,
                2,
            ),

            "recovery_share_of_generation_gap_pct": round(
                recovery_share_of_generation_gap_pct,
                2,
            ),

            "tariff_usd_per_kwh": round(
                tariff_usd_per_kwh,
                6,
            ),

            "settlement_factor": round(
                settlement_factor,
                4,
            ),

            "reconciled_recovery_revenue_usd": round(
                reconciled_recovery_revenue_usd,
                2,
            ),

            "unreconciled_recovery_revenue_usd": round(
                unreconciled_recovery_revenue_usd,
                2,
            ),

            "recovery_status": recovery_status,

            "reconciliation_rule": (
                "Episode recovery is capped at the "
                "positive period-level generation gap."
            ),

            "data_source": (
                "TRACE_DERIVED"
            ),
        }
    ]
)


# ---------------------------------------------------------
# Save
# ---------------------------------------------------------

summary.to_csv(
    OUTPUT_RECOVERY_RECONCILIATION,
    index=False,
)


# ---------------------------------------------------------
# Report
# ---------------------------------------------------------

print(
    "TRACE Recovery Reconciliation Engine created."
)

print()

print("Output:")
print(OUTPUT_RECOVERY_RECONCILIATION)

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
    "Period generation gap:",
    round(
        period_generation_gap_kwh,
        2,
    ),
    "kWh",
)

print()

print(
    "Raw episode recovery:",
    round(
        raw_episode_recovery_kwh,
        2,
    ),
    "kWh",
)

print(
    "Positive generation gap:",
    round(
        positive_generation_gap_kwh,
        2,
    ),
    "kWh",
)

print(
    "Reconciled recovery:",
    round(
        reconciled_recovery_kwh,
        2,
    ),
    "kWh",
)

print(
    "Unreconciled recovery:",
    round(
        unreconciled_recovery_kwh,
        2,
    ),
    "kWh",
)

print()

print(
    "Recovery reconciliation:",
    round(
        recovery_reconciliation_pct,
        2,
    ),
    "%",
)

print(
    "Recovery share of generation gap:",
    round(
        recovery_share_of_generation_gap_pct,
        2,
    ),
    "%",
)

print()

print(
    "Tariff:",
    tariff_usd_per_kwh,
    "USD/kWh",
)

print(
    "Settlement factor:",
    settlement_factor,
)

print()

print(
    "Reconciled recovery revenue:",
    round(
        reconciled_recovery_revenue_usd,
        2,
    ),
    "USD",
)

print(
    "Unreconciled recovery revenue:",
    round(
        unreconciled_recovery_revenue_usd,
        2,
    ),
    "USD",
)

print()

print(
    "Recovery status:",
    recovery_status
)

print()

print(
    "Recovery reconciliation completed."
)