import pandas as pd

from config import (
    PHYSICAL_QUALITY_PATH,
    ATTRIBUTION_PATH,
    EPISODE_ATTRIBUTION_PATH,
    DECISION_INTELLIGENCE_PATH,
    COMMERCIAL_IMPACT_PATH,
    RECOVERY_RECONCILIATION_PATH,
    OUTPUT_EVIDENCE_CHAIN,
    OUTPUT_INTEGRITY_REPORT,
    RECONCILIATION_TOLERANCE_KWH,
    ensure_output_dir,
)

# Ensure output directory exists
ensure_output_dir()


# ---------------------------------------------------------
# Load datasets
# ---------------------------------------------------------

physical = pd.read_csv(PHYSICAL_QUALITY_PATH)

attribution = pd.read_csv(ATTRIBUTION_PATH)

episode_attribution = pd.read_csv(EPISODE_ATTRIBUTION_PATH)

decision = pd.read_csv(DECISION_INTELLIGENCE_PATH)

commercial = pd.read_csv(COMMERCIAL_IMPACT_PATH)

recovery = pd.read_csv(RECOVERY_RECONCILIATION_PATH)

evidence = pd.read_csv(OUTPUT_EVIDENCE_CHAIN)

# Use tolerance from config
TOLERANCE_KWH = RECONCILIATION_TOLERANCE_KWH


# ---------------------------------------------------------
# Integrity checks
# ---------------------------------------------------------

checks = []


def add_check(
    check_name,
    status,
    expected,
    actual,
    description,
):
    checks.append(
        {
            "check_name": check_name,
            "status": status,
            "expected": expected,
            "actual": actual,
            "description": description,
        }
    )


# ---------------------------------------------------------
# CHECK 1
# Physical dataset exists
# ---------------------------------------------------------

physical_rows = len(physical)

add_check(
    "PHYSICAL_DATASET",
    "PASS" if physical_rows > 0 else "FAIL",
    "> 0 rows",
    physical_rows,
    "Physical dataset contains observations.",
)


# ---------------------------------------------------------
# CHECK 2
# Observation-level attribution exists
# ---------------------------------------------------------

attribution_rows = len(attribution)

add_check(
    "OBSERVATION_ATTRIBUTION",
    "PASS" if attribution_rows > 0 else "FAIL",
    "> 0 rows",
    attribution_rows,
    "Observation-level attribution dataset exists.",
)


# ---------------------------------------------------------
# CHECK 3
# Episode attribution exists
# ---------------------------------------------------------

episode_count = len(
    episode_attribution
)

add_check(
    "EPISODE_ATTRIBUTION",
    "PASS" if episode_count > 0 else "FAIL",
    "> 0 episodes",
    episode_count,
    "Episode-level attribution records exist.",
)


# ---------------------------------------------------------
# CHECK 4
# Decision intelligence matches episodes
# ---------------------------------------------------------

decision_count = len(
    decision
)

decision_status = (
    decision_count == episode_count
)

add_check(
    "DECISION_EPISODE_COUNT",
    "PASS" if decision_status else "FAIL",
    episode_count,
    decision_count,
    "Every performance episode has a decision record.",
)


# ---------------------------------------------------------
# CHECK 5
# Evidence chain matches episodes
# ---------------------------------------------------------

evidence_count = len(
    evidence
)

evidence_status = (
    evidence_count == episode_count
)

add_check(
    "EVIDENCE_EPISODE_COUNT",
    "PASS" if evidence_status else "FAIL",
    episode_count,
    evidence_count,
    "Every performance episode has an evidence chain.",
)


# ---------------------------------------------------------
# CHECK 6
# Episode attribution reconciliation
# ---------------------------------------------------------

episode_observed_variance = (
    episode_attribution[
        "observed_variance_kwh"
    ].sum()
)

episode_components = (
    episode_attribution[
        "environmental_kwh"
    ].sum()
    +
    episode_attribution[
        "equipment_conversion_kwh"
    ].sum()
    +
    episode_attribution[
        "data_quality_kwh"
    ].sum()
    +
    episode_attribution[
        "unexplained_kwh"
    ].sum()
)

episode_reconciliation_error = abs(
    episode_observed_variance
    - episode_components
)

add_check(
    "EPISODE_ATTRIBUTION_RECONCILIATION",
    (
        "PASS"
        if episode_reconciliation_error
        <= TOLERANCE_KWH
        else "FAIL"
    ),
    f"≤ {TOLERANCE_KWH} kWh error",
    round(
        episode_reconciliation_error,
        6,
    ),
    "Observed episode variance equals attributed components plus unexplained variance within rounding tolerance.",
)


# ---------------------------------------------------------
# CHECK 7
# Observation attribution reconciliation
# ---------------------------------------------------------

observation_variance = (
    attribution[
        "observed_variance_kwh"
    ].sum()
)

observation_components = (
    attribution[
        "environmental_kwh"
    ].sum()
    +
    attribution[
        "equipment_conversion_kwh"
    ].sum()
    +
    attribution[
        "data_quality_kwh"
    ].sum()
    +
    attribution[
        "unexplained_kwh"
    ].sum()
)

observation_reconciliation_error = abs(
    observation_variance
    - observation_components
)

add_check(
    "OBSERVATION_ATTRIBUTION_RECONCILIATION",
    (
        "PASS"
        if observation_reconciliation_error
        <= TOLERANCE_KWH
        else "FAIL"
    ),
    f"≤ {TOLERANCE_KWH} kWh error",
    round(
        observation_reconciliation_error,
        6,
    ),
    "Observation-level attribution reconciles to observed variance within rounding tolerance.",
)


# ---------------------------------------------------------
# CHECK 8
# Episode and observation variance totals
# ---------------------------------------------------------

variance_difference = abs(
    episode_observed_variance
    - observation_variance
)

add_check(
    "EPISODE_VS_OBSERVATION_VARIANCE",
    (
        "PASS"
        if variance_difference
        <= TOLERANCE_KWH
        else "FAIL"
    ),
    f"≤ {TOLERANCE_KWH} kWh difference",
    round(
        variance_difference,
        6,
    ),
    "Episode-level variance matches observation-level variance within rounding tolerance.",
)


# ---------------------------------------------------------
# CHECK 9
# Recovery does not exceed period gap
# ---------------------------------------------------------

period_gap = float(
    recovery.iloc[0][
        "positive_generation_gap_kwh"
    ]
)

reconciled_recovery = float(
    recovery.iloc[0][
        "reconciled_recovery_kwh"
    ]
)

recovery_excess = (
    reconciled_recovery
    - period_gap
)

add_check(
    "RECOVERY_CAP",
    (
        "PASS"
        if recovery_excess
        <= TOLERANCE_KWH
        else "FAIL"
    ),
    f"≤ {period_gap:.3f} kWh",
    round(
        reconciled_recovery,
        3,
    ),
    "Reconciled recovery cannot exceed the positive period-level generation gap.",
)


# ---------------------------------------------------------
# CHECK 10
# Raw recovery >= reconciled recovery
# ---------------------------------------------------------

raw_recovery = float(
    recovery.iloc[0][
        "raw_episode_recovery_kwh"
    ]
)

raw_recovery_status = (
    raw_recovery
    + TOLERANCE_KWH
    >= reconciled_recovery
)

add_check(
    "RECOVERY_DIRECTION",
    "PASS" if raw_recovery_status else "FAIL",
    f">= {reconciled_recovery:.3f} kWh",
    round(
        raw_recovery,
        3,
    ),
    "Reconciled recovery cannot exceed raw episode recovery.",
)


# ---------------------------------------------------------
# CHECK 11
# Commercial generation gap
# ---------------------------------------------------------

commercial_expected = float(
    commercial.iloc[0][
        "expected_generation_kwh"
    ]
)

commercial_actual = float(
    commercial.iloc[0][
        "actual_generation_kwh"
    ]
)

commercial_gap = float(
    commercial.iloc[0][
        "generation_gap_kwh"
    ]
)

commercial_gap_calculated = (
    commercial_expected
    - commercial_actual
)

commercial_gap_error = abs(
    commercial_gap
    - commercial_gap_calculated
)

add_check(
    "COMMERCIAL_GENERATION_GAP",
    (
        "PASS"
        if commercial_gap_error
        <= TOLERANCE_KWH
        else "FAIL"
    ),
    "Expected - Actual",
    round(
        commercial_gap,
        3,
    ),
    "Commercial generation gap matches expected minus actual generation.",
)


# ---------------------------------------------------------
# CHECK 12
# Revenue calculation
# ---------------------------------------------------------

tariff = float(
    commercial.iloc[0][
        "tariff_usd_per_kwh"
    ]
)

settlement_factor = float(
    commercial.iloc[0][
        "settlement_factor"
    ]
)

reported_revenue_loss = float(
    commercial.iloc[0][
        "generation_driven_revenue_loss_usd"
    ]
)

calculated_revenue_loss = (
    commercial_gap
    * tariff
    * settlement_factor
)

revenue_error = abs(
    reported_revenue_loss
    - calculated_revenue_loss
)

add_check(
    "GENERATION_REVENUE_CALCULATION",
    (
        "PASS"
        if revenue_error <= 0.01
        else "FAIL"
    ),
    "Generation gap × tariff × settlement factor",
    round(
        reported_revenue_loss,
        2,
    ),
    "Generation-driven revenue impact matches commercial assumptions.",
)


# ---------------------------------------------------------
# CHECK 13
# Evidence chain completeness
# ---------------------------------------------------------

evidence_ids = set(
    evidence[
        "episode_id"
    ].astype(str)
)

decision_ids = set(
    decision[
        "episode_id"
    ].astype(str)
)

missing_evidence_ids = (
    decision_ids
    - evidence_ids
)

add_check(
    "EVIDENCE_CHAIN_COMPLETENESS",
    (
        "PASS"
        if len(missing_evidence_ids) == 0
        else "FAIL"
    ),
    "0 missing episode IDs",
    len(missing_evidence_ids),
    "Every decision episode has a corresponding evidence chain.",
)


# ---------------------------------------------------------
# CHECK 14
# No DATA_QUALITY episode treated as confirmed
# ---------------------------------------------------------

data_quality_episodes = episode_attribution[
    episode_attribution[
        "primary_evidence_category"
    ]
    == "DATA_QUALITY"
]

invalid_data_quality = 0

if not data_quality_episodes.empty:

    for _, row in data_quality_episodes.iterrows():

        matching = decision[
            decision[
                "episode_id"
            ]
            == row[
                "episode_id"
            ]
        ]

        if not matching.empty:

            recoverability = matching.iloc[0][
                "recoverability"
            ]

            if recoverability not in [
                "NOT_ESTABLISHED",
                "LOW",
            ]:

                invalid_data_quality += 1


add_check(
    "DATA_QUALITY_PROTECTION",
    (
        "PASS"
        if invalid_data_quality == 0
        else "FAIL"
    ),
    "0 incorrectly recoverable data-quality episodes",
    invalid_data_quality,
    "Data-quality evidence must not automatically become confirmed recoverable production loss.",
)


# ---------------------------------------------------------
# CHECK 15
# No silent unexplained variance
# ---------------------------------------------------------

unexplained_total = (
    episode_attribution[
        "unexplained_kwh"
    ].sum()
)

unexplained_is_explicit = (
    "unexplained_kwh"
    in episode_attribution.columns
)

add_check(
    "NO_SILENT_LEFTOVER",
    (
        "PASS"
        if unexplained_is_explicit
        else "FAIL"
    ),
    "Explicit unexplained_kwh field",
    round(
        unexplained_total,
        3,
    ),
    "Unexplained variance remains explicitly represented rather than silently assigned.",
)


# ---------------------------------------------------------
# CHECK 16
# Reconciliation errors stored in episode dataset
# ---------------------------------------------------------

stored_reconciliation_error = (
    episode_attribution[
        "reconciliation_error_kwh"
    ]
    .abs()
    .max()
)

add_check(
    "STORED_RECONCILIATION_ERROR",
    (
        "PASS"
        if stored_reconciliation_error
        <= TOLERANCE_KWH
        else "FAIL"
    ),
    f"≤ {TOLERANCE_KWH} kWh",
    round(
        stored_reconciliation_error,
        6,
    ),
    "Stored episode reconciliation error remains within tolerance.",
)


# ---------------------------------------------------------
# CHECK 17
# Expected generation should not be negative
# ---------------------------------------------------------

negative_expected_count = (
    physical[
        "expected_generation_kwh"
    ]
    .dropna()
    .lt(0)
    .sum()
)

add_check(
    "NON_NEGATIVE_EXPECTED_GENERATION",
    (
        "PASS"
        if negative_expected_count == 0
        else "FAIL"
    ),
    "0 negative expected-generation records",
    int(
        negative_expected_count
    ),
    "Expected generation must be non-negative.",
)


# ---------------------------------------------------------
# CHECK 18
# Actual generation should not be negative
# ---------------------------------------------------------

negative_actual_count = (
    physical[
        "actual_generation_kwh"
    ]
    .dropna()
    .lt(0)
    .sum()
)

add_check(
    "NON_NEGATIVE_ACTUAL_GENERATION",
    (
        "PASS"
        if negative_actual_count == 0
        else "FAIL"
    ),
    "0 negative actual-generation records",
    int(
        negative_actual_count
    ),
    "Actual generation must be non-negative.",
)


# ---------------------------------------------------------
# CHECK 19
# Duplicate episode IDs
# ---------------------------------------------------------

duplicate_episode_ids = (
    episode_attribution[
        "episode_id"
    ]
    .duplicated()
    .sum()
)

add_check(
    "UNIQUE_EPISODE_IDS",
    (
        "PASS"
        if duplicate_episode_ids == 0
        else "FAIL"
    ),
    "0 duplicate episode IDs",
    int(
        duplicate_episode_ids
    ),
    "Each performance episode must have one unique identifier.",
)


# ---------------------------------------------------------
# Overall status
# ---------------------------------------------------------

failed_checks = sum(
    1
    for check in checks
    if check["status"] == "FAIL"
)

total_checks = len(checks)

overall_status = (
    "PASS"
    if failed_checks == 0
    else "FAIL"
)


# ---------------------------------------------------------
# Add summary rows
# ---------------------------------------------------------

report_df = pd.DataFrame(
    checks
)


summary_rows = pd.DataFrame(
    [
        {
            "check_name": "TOTAL_CHECKS",
            "status": "INFO",
            "expected": total_checks,
            "actual": total_checks,
            "description": (
                "Total integrity checks executed."
            ),
        },
        {
            "check_name": "FAILED_CHECKS",
            "status": (
                "PASS"
                if failed_checks == 0
                else "FAIL"
            ),
            "expected": 0,
            "actual": failed_checks,
            "description": (
                "Number of failed integrity checks."
            ),
        },
        {
            "check_name": "OVERALL_STATUS",
            "status": overall_status,
            "expected": "PASS",
            "actual": overall_status,
            "description": (
                "Overall TRACE data integrity status."
            ),
        },
    ]
)


report_df = pd.concat(
    [
        report_df,
        summary_rows,
    ],
    ignore_index=True,
)


# ---------------------------------------------------------
# Save report
# ---------------------------------------------------------

report_df.to_csv(
    OUTPUT_INTEGRITY_REPORT,
    index=False,
)


# ---------------------------------------------------------
# Terminal report
# ---------------------------------------------------------

print(
    "TRACE Data Integrity Check completed."
)

print()

print(
    "Output:"
)

print(
    OUTPUT_INTEGRITY_REPORT
)

print()

print(
    "Integrity checks:",
    total_checks,
)

print(
    "Failed checks:",
    failed_checks,
)

print()

print(
    "Overall status:",
    overall_status,
)

print()

print(
    "CHECK RESULTS"
)

print(
    report_df[
        [
            "check_name",
            "status",
        ]
    ]
    .to_string(index=False)
)

print()

print(
    "TRACE DATA INTEGRITY CHECK"
)

if overall_status == "PASS":

    print(
        "[PASS] All integrity checks passed."
    )

    print(
        "[PASS] No silent leftover."
    )

    print(
        "[PASS] Attribution reconciles."
    )

    print(
        "[PASS] Recovery is capped."
    )

    print(
        "[PASS] Evidence chain is complete."
    )

    print(
        "[PASS] Data-quality protection is active."
    )

else:

    print(
        "[FAIL] One or more integrity checks failed."
    )

    print(
        "Review the failed checks above."
    )

print()

print(
    "TRACE Integrity Engine completed."
)