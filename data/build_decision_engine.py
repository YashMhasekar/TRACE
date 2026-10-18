import pandas as pd

from config import (
    EPISODE_ATTRIBUTION_PATH,
    OUTPUT_DECISION_INTELLIGENCE,
    MIN_RECOVERY_LOSS_KWH,
    HIGH_PRIORITY_LOSS_KWH,
    MEDIUM_PRIORITY_LOSS_KWH,
    ensure_output_dir,
)

# Ensure output directory exists
ensure_output_dir()


# ---------------------------------------------------------
# Load episode attribution
# ---------------------------------------------------------

episodes = pd.read_csv(EPISODE_ATTRIBUTION_PATH)

episodes["timestamp_start"] = pd.to_datetime(
    episodes["timestamp_start"]
)

episodes["timestamp_end"] = pd.to_datetime(
    episodes["timestamp_end"]
)


# ---------------------------------------------------------
# Helper functions
# ---------------------------------------------------------

def determine_explainability(row):
    """
    Determine whether the observed variance has enough
    evidence to explain the episode.

    This does NOT mean the physical cause is proven.
    It only indicates that TRACE has evidence supporting
    an attribution category.
    """

    if row["observed_variance_kwh"] <= 0:
        return "NO"

    if row["attribution_confidence"] == "LOW":
        return "PARTIAL"

    if row["primary_evidence_category"] == "UNEXPLAINED":
        return "NO"

    if row["unexplained_pct"] >= 50:
        return "PARTIAL"

    return "YES"


def determine_controllability(row):
    """
    Determine whether the evidence currently suggests that
    the loss could potentially be influenced by an operational
    or management action.

    We deliberately avoid claiming that a specific action
    will fix the problem because the current dataset does not
    contain maintenance/work-order/grid evidence.
    """

    category = row["primary_evidence_category"]

    if category == "DATA_QUALITY":
        return "NO"

    if category == "UNEXPLAINED":
        return "UNKNOWN"

    if row["attribution_confidence"] == "LOW":
        return "UNKNOWN"

    if category == "EQUIPMENT_CONVERSION":
        return "POTENTIALLY_CONTROLLABLE"

    if category == "ENVIRONMENTAL":
        return "CONDITIONALLY_CONTROLLABLE"

    return "UNKNOWN"


def determine_recoverability(row):
    """
    Determine whether the episode represents a plausible
    recovery opportunity.

    This is intentionally conservative.
    """

    loss = row["observed_variance_kwh"]
    category = row["primary_evidence_category"]

    if loss < MIN_RECOVERY_LOSS_KWH:
        return "LOW"

    if category == "DATA_QUALITY":
        return "NOT_ESTABLISHED"

    if category == "UNEXPLAINED":
        return "NOT_ESTABLISHED"

    if row["attribution_confidence"] == "LOW":
        return "NOT_ESTABLISHED"

    if category == "EQUIPMENT_CONVERSION":
        return "POTENTIAL"

    if category == "ENVIRONMENTAL":
        return "CONDITIONALLY_POTENTIAL"

    return "NOT_ESTABLISHED"


def calculate_recovery_potential(row):
    """
    Estimate the recoverable portion of the observed loss.

    IMPORTANT:
    This is a decision-support estimate, NOT a measured
    financial or engineering recovery value.

    We use the attributed portion rather than the entire
    observed variance.
    """

    category = row["primary_evidence_category"]

    if category in ["DATA_QUALITY", "UNEXPLAINED"]:
        return 0.0

    if row["attribution_confidence"] == "LOW":
        return 0.0

    return max(
        0.0,
        row["attributed_kwh"],
    )


def determine_priority(row):
    """
    Prioritize episodes using:
    - recovery potential
    - evidence confidence
    - explainability
    """

    recovery = row["recovery_potential_kwh"]
    confidence = row["attribution_confidence"]
    explainability = row["explainability"]

    if (
        recovery >= HIGH_PRIORITY_LOSS_KWH
        and confidence == "HIGH"
        and explainability == "YES"
    ):
        return "HIGH"

    if (
        recovery >= MEDIUM_PRIORITY_LOSS_KWH
        and confidence in ["HIGH", "MEDIUM"]
        and explainability in ["YES", "PARTIAL"]
    ):
        return "MEDIUM"

    if recovery > 0:
        return "LOW"

    return "MONITOR"


def determine_action_state(row):
    """
    Translate the decision state into a practical next step.
    """

    category = row["primary_evidence_category"]

    if category == "DATA_QUALITY":
        return "VALIDATE_MEASUREMENT"

    if category == "UNEXPLAINED":
        return "COLLECT_MORE_EVIDENCE"

    if category == "EQUIPMENT_CONVERSION":
        return "INVESTIGATE_ASSET_PERFORMANCE"

    if category == "ENVIRONMENTAL":
        return "REVIEW_ENVIRONMENTAL_IMPACT"

    return "REVIEW"


# ---------------------------------------------------------
# Explainability
# ---------------------------------------------------------

episodes["explainability"] = episodes.apply(
    determine_explainability,
    axis=1,
)


# ---------------------------------------------------------
# Controllability
# ---------------------------------------------------------

episodes["controllability"] = episodes.apply(
    determine_controllability,
    axis=1,
)


# ---------------------------------------------------------
# Recoverability
# ---------------------------------------------------------

episodes["recoverability"] = episodes.apply(
    determine_recoverability,
    axis=1,
)


# ---------------------------------------------------------
# Recovery potential
# ---------------------------------------------------------

episodes["recovery_potential_kwh"] = episodes.apply(
    calculate_recovery_potential,
    axis=1,
)


# ---------------------------------------------------------
# Priority
# ---------------------------------------------------------

episodes["priority"] = episodes.apply(
    determine_priority,
    axis=1,
)


# ---------------------------------------------------------
# Recommended action state
# ---------------------------------------------------------

episodes["recommended_action"] = episodes.apply(
    determine_action_state,
    axis=1,
)


# ---------------------------------------------------------
# Evidence completeness
# ---------------------------------------------------------

def calculate_evidence_completeness(row):

    valid_fields = [
        row["ac_valid_pct"],
        row["dc_valid_pct"],
        row["poa_valid_pct"],
    ]

    valid_fields = [
        value
        for value in valid_fields
        if pd.notna(value)
    ]

    if not valid_fields:
        return 0.0

    return round(
        sum(valid_fields) / len(valid_fields),
        2,
    )


episodes["evidence_completeness_pct"] = episodes.apply(
    calculate_evidence_completeness,
    axis=1,
)


# ---------------------------------------------------------
# Decision explanation
# ---------------------------------------------------------

def create_decision_reason(row):

    category = row["primary_evidence_category"]
    confidence = row["attribution_confidence"]
    priority = row["priority"]

    if category == "EQUIPMENT_CONVERSION":

        return (
            f"Observed performance gap is primarily associated "
            f"with equipment/conversion evidence with "
            f"{confidence.lower()} attribution confidence. "
            f"Further asset-level operational evidence is "
            f"required before assigning a specific equipment cause."
        )

    if category == "ENVIRONMENTAL":

        return (
            f"Observed performance gap is primarily associated "
            f"with environmental evidence with "
            f"{confidence.lower()} attribution confidence."
        )

    if category == "DATA_QUALITY":

        return (
            "The observed gap contains insufficient measurement "
            "evidence. Validate the underlying measurements before "
            "treating the episode as a confirmed production loss."
        )

    if category == "UNEXPLAINED":

        return (
            "The current evidence does not sufficiently explain "
            "the observed performance gap. Additional evidence "
            "should be collected."
        )

    return (
        f"Episode classified with {priority.lower()} priority."
    )


episodes["decision_reason"] = episodes.apply(
    create_decision_reason,
    axis=1,
)


# ---------------------------------------------------------
# Recovery percentage
# ---------------------------------------------------------

episodes["recovery_potential_pct"] = (
    episodes["recovery_potential_kwh"]
    / episodes["observed_variance_kwh"]
    .replace(0, pd.NA)
) * 100

episodes["recovery_potential_pct"] = (
    episodes["recovery_potential_pct"]
    .fillna(0)
    .round(2)
)


# ---------------------------------------------------------
# Select final columns
# ---------------------------------------------------------

decision_columns = [

    # Identity
    "episode_id",
    "timestamp_start",
    "timestamp_end",

    # Performance
    "duration_minutes",
    "records",
    "expected_generation_kwh",
    "actual_generation_kwh",
    "observed_variance_kwh",
    "variance_pct",

    # Evidence
    "primary_evidence_category",
    "attribution_confidence",
    "evidence_completeness_pct",

    # Attribution
    "attributed_kwh",
    "unexplained_kwh",
    "environmental_kwh",
    "equipment_conversion_kwh",
    "data_quality_kwh",

    # Decision intelligence
    "explainability",
    "controllability",
    "recoverability",
    "recovery_potential_kwh",
    "recovery_potential_pct",
    "priority",

    # Action
    "recommended_action",
    "decision_reason",

    # Reconciliation
    "reconciliation_error_kwh",
]


decision_df = episodes[
    decision_columns
].copy()


# ---------------------------------------------------------
# Rounding
# ---------------------------------------------------------

numeric_columns = [
    "duration_minutes",
    "expected_generation_kwh",
    "actual_generation_kwh",
    "observed_variance_kwh",
    "variance_pct",
    "evidence_completeness_pct",
    "attributed_kwh",
    "unexplained_kwh",
    "environmental_kwh",
    "equipment_conversion_kwh",
    "data_quality_kwh",
    "recovery_potential_kwh",
    "recovery_potential_pct",
    "reconciliation_error_kwh",
]

for column in numeric_columns:

    decision_df[column] = (
        decision_df[column]
        .round(3)
    )


# ---------------------------------------------------------
# Save
# ---------------------------------------------------------

decision_df.to_csv(
    OUTPUT_DECISION_INTELLIGENCE,
    index=False,
)


# ---------------------------------------------------------
# Report
# ---------------------------------------------------------

print(
    "TRACE Decision Intelligence Engine created."
)

print()

print("Output:")
print(OUTPUT_DECISION_INTELLIGENCE)

print()

print(
    "Performance episodes:",
    len(decision_df),
)

print()

print(
    "Total observed variance:",
    round(
        decision_df[
            "observed_variance_kwh"
        ].sum(),
        2,
    ),
    "kWh",
)

print(
    "Total recovery potential:",
    round(
        decision_df[
            "recovery_potential_kwh"
        ].sum(),
        2,
    ),
    "kWh",
)

print()

print(
    "Explainability:"
)

print(
    decision_df[
        "explainability"
    ]
    .value_counts()
    .to_string()
)

print()

print(
    "Controllability:"
)

print(
    decision_df[
        "controllability"
    ]
    .value_counts()
    .to_string()
)

print()

print(
    "Recoverability:"
)

print(
    decision_df[
        "recoverability"
    ]
    .value_counts()
    .to_string()
)

print()

print(
    "Priority:"
)

print(
    decision_df[
        "priority"
    ]
    .value_counts()
    .to_string()
)

print()

print(
    "Recommended actions:"
)

print(
    decision_df[
        "recommended_action"
    ]
    .value_counts()
    .to_string()
)

print()

print(
    "Maximum reconciliation error:",
    decision_df[
        "reconciliation_error_kwh"
    ]
    .abs()
    .max(),
    "kWh",
)

print()

print(
    "Top 10 recovery opportunities:"
)

print(
    decision_df.sort_values(
        "recovery_potential_kwh",
        ascending=False,
    )[
        [
            "episode_id",
            "observed_variance_kwh",
            "attributed_kwh",
            "primary_evidence_category",
            "attribution_confidence",
            "explainability",
            "controllability",
            "recoverability",
            "recovery_potential_kwh",
            "priority",
        ]
    ]
    .head(10)
    .to_string(index=False)
)