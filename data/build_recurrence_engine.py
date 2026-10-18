import pandas as pd

from config import (
    EPISODE_ATTRIBUTION_PATH,
    OUTPUT_RECURRENCE_SUMMARY,
    OUTPUT_EPISODE_RECURRENCE,
    RECURRING_EPISODE_COUNT,
    STRUCTURAL_EPISODE_COUNT,
    STRUCTURAL_LOSS_KWH,
    MIN_SEPARATION_HOURS,
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
# Sort chronologically
# ---------------------------------------------------------

episodes = episodes.sort_values(
    "timestamp_start"
).reset_index(drop=True)


# ---------------------------------------------------------
# Time information
# ---------------------------------------------------------

episodes["date"] = (
    episodes[
        "timestamp_start"
    ].dt.date
)

episodes["month"] = (
    episodes[
        "timestamp_start"
    ].dt.to_period("M")
    .astype(str)
)

episodes["week"] = (
    episodes[
        "timestamp_start"
    ].dt.to_period("W")
    .astype(str)
)

episodes["day_of_week"] = (
    episodes[
        "timestamp_start"
    ].dt.day_name()
)

episodes["hour"] = (
    episodes[
        "timestamp_start"
    ].dt.hour
)


# ---------------------------------------------------------
# Determine temporal recurrence
# ---------------------------------------------------------

episodes["previous_episode_end"] = (
    episodes[
        "timestamp_end"
    ].shift(1)
)

episodes["hours_since_previous_episode"] = (
    (
        episodes["timestamp_start"]
        - episodes["previous_episode_end"]
    )
    .dt.total_seconds()
    / 3600
)


episodes["temporally_separate"] = (
    episodes[
        "hours_since_previous_episode"
    ].isna()
    |
    (
        episodes[
            "hours_since_previous_episode"
        ]
        >= MIN_SEPARATION_HOURS
    )
)


# ---------------------------------------------------------
# Category statistics
# ---------------------------------------------------------

category_summary = (
    episodes
    .groupby(
        "primary_evidence_category"
    )
    .agg(
        episode_count=(
            "episode_id",
            "count",
        ),

        total_observed_variance_kwh=(
            "observed_variance_kwh",
            "sum",
        ),

        total_attributed_kwh=(
            "attributed_kwh",
            "sum",
        ),

        total_unexplained_kwh=(
            "unexplained_kwh",
            "sum",
        ),

        average_variance_kwh=(
            "observed_variance_kwh",
            "mean",
        ),

        max_variance_kwh=(
            "observed_variance_kwh",
            "max",
        ),

        average_duration_minutes=(
            "duration_minutes",
            "mean",
        ),
    )
    .reset_index()
)


# ---------------------------------------------------------
# Frequency percentage
# ---------------------------------------------------------

total_episodes = len(episodes)

if total_episodes > 0:

    category_summary[
        "episode_frequency_pct"
    ] = (
        category_summary[
            "episode_count"
        ]
        / total_episodes
        * 100
    )

else:

    category_summary[
        "episode_frequency_pct"
    ] = 0.0


# ---------------------------------------------------------
# Recurrence classification
# ---------------------------------------------------------

def classify_recurrence(row):

    count = row[
        "episode_count"
    ]

    loss = row[
        "total_observed_variance_kwh"
    ]

    if (
        count >= STRUCTURAL_EPISODE_COUNT
        and loss >= STRUCTURAL_LOSS_KWH
    ):

        return "POTENTIALLY_STRUCTURAL"

    if count >= RECURRING_EPISODE_COUNT:

        return "RECURRING"

    if count > 1:

        return "REPEATED"

    return "ISOLATED"


category_summary[
    "recurrence_class"
] = category_summary.apply(
    classify_recurrence,
    axis=1,
)


# ---------------------------------------------------------
# Recurrence score
# ---------------------------------------------------------
#
# Score combines:
# - frequency
# - number of episodes
# - total observed loss
#
# This is a prioritization score, not a causal score.
# ---------------------------------------------------------

def calculate_recurrence_score(row):

    frequency_component = min(
        100,
        row[
            "episode_frequency_pct"
        ] * 2,
    )

    count_component = min(
        100,
        row[
            "episode_count"
        ] * 10,
    )

    loss_component = min(
        100,
        (
            row[
                "total_observed_variance_kwh"
            ]
            / 1000
        )
        * 100,
    )

    score = (
        frequency_component * 0.4
        + count_component * 0.3
        + loss_component * 0.3
    )

    return round(
        min(100, score),
        2,
    )


category_summary[
    "recurrence_score"
] = category_summary.apply(
    calculate_recurrence_score,
    axis=1,
)


# ---------------------------------------------------------
# Recurrence interpretation
# ---------------------------------------------------------

def recurrence_interpretation(row):

    classification = row[
        "recurrence_class"
    ]

    if classification == "POTENTIALLY_STRUCTURAL":

        return (
            "Repeated evidence category with substantial "
            "cumulative performance impact. Investigate "
            "whether a persistent operational or asset-level "
            "condition exists."
        )

    if classification == "RECURRING":

        return (
            "The evidence category appears repeatedly across "
            "multiple performance episodes. Further operational "
            "evidence should be collected to determine whether "
            "the pattern is systematic."
        )

    if classification == "REPEATED":

        return (
            "The evidence category appears more than once, "
            "but the current sample is insufficient to classify "
            "it as a recurring or structural pattern."
        )

    return (
        "The evidence category currently appears isolated."
    )


category_summary[
    "recurrence_interpretation"
] = category_summary.apply(
    recurrence_interpretation,
    axis=1,
)


# ---------------------------------------------------------
# Episode-level recurrence
# ---------------------------------------------------------

category_counts = (
    episodes[
        "primary_evidence_category"
    ]
    .value_counts()
    .to_dict()
)


category_losses = (
    episodes
    .groupby(
        "primary_evidence_category"
    )[
        "observed_variance_kwh"
    ]
    .sum()
    .to_dict()
)


episodes[
    "category_episode_count"
] = episodes[
    "primary_evidence_category"
].map(
    category_counts
)


episodes[
    "category_total_loss_kwh"
] = episodes[
    "primary_evidence_category"
].map(
    category_losses
)


episodes[
    "category_frequency_pct"
] = (
    episodes[
        "category_episode_count"
    ]
    / total_episodes
    * 100
)


# ---------------------------------------------------------
# Episode recurrence state
# ---------------------------------------------------------

def episode_recurrence_state(row):

    count = row[
        "category_episode_count"
    ]

    loss = row[
        "category_total_loss_kwh"
    ]

    if (
        count >= STRUCTURAL_EPISODE_COUNT
        and loss >= STRUCTURAL_LOSS_KWH
    ):

        return "POTENTIALLY_STRUCTURAL"

    if count >= RECURRING_EPISODE_COUNT:

        return "RECURRING"

    if count > 1:

        return "REPEATED"

    return "ISOLATED"


episodes[
    "recurrence_class"
] = episodes.apply(
    episode_recurrence_state,
    axis=1,
)


# ---------------------------------------------------------
# Recurrence-aware action
# ---------------------------------------------------------

def recurrence_action(row):

    classification = row[
        "recurrence_class"
    ]

    category = row[
        "primary_evidence_category"
    ]

    if classification == "POTENTIALLY_STRUCTURAL":

        return (
            "INVESTIGATE_RECURRING_PATTERN"
        )

    if classification == "RECURRING":

        return (
            "REVIEW_REPEATED_EVIDENCE"
        )

    if classification == "REPEATED":

        return (
            "MONITOR_PATTERN"
        )

    if category == "UNEXPLAINED":

        return (
            "COLLECT_MORE_EVIDENCE"
        )

    if category == "DATA_QUALITY":

        return (
            "VALIDATE_MEASUREMENT"
        )

    return (
        "MONITOR_EPISODE"
    )


episodes[
    "recurrence_action"
] = episodes.apply(
    recurrence_action,
    axis=1,
)


# ---------------------------------------------------------
# Select category summary columns
# ---------------------------------------------------------

summary_columns = [

    "primary_evidence_category",

    "episode_count",

    "episode_frequency_pct",

    "total_observed_variance_kwh",

    "total_attributed_kwh",

    "total_unexplained_kwh",

    "average_variance_kwh",

    "max_variance_kwh",

    "average_duration_minutes",

    "recurrence_class",

    "recurrence_score",

    "recurrence_interpretation",
]


category_summary = category_summary[
    summary_columns
].copy()


# ---------------------------------------------------------
# Round summary
# ---------------------------------------------------------

summary_numeric_columns = [

    "episode_frequency_pct",

    "total_observed_variance_kwh",

    "total_attributed_kwh",

    "total_unexplained_kwh",

    "average_variance_kwh",

    "max_variance_kwh",

    "average_duration_minutes",

    "recurrence_score",
]


for column in summary_numeric_columns:

    category_summary[column] = (
        category_summary[column]
        .round(3)
    )


# ---------------------------------------------------------
# Select episode columns
# ---------------------------------------------------------

episode_columns = [

    "episode_id",

    "timestamp_start",

    "timestamp_end",

    "duration_minutes",

    "observed_variance_kwh",

    "attributed_kwh",

    "unexplained_kwh",

    "primary_evidence_category",

    "attribution_confidence",

    "category_episode_count",

    "category_frequency_pct",

    "category_total_loss_kwh",

    "recurrence_class",

    "recurrence_action",
]


episode_recurrence = episodes[
    episode_columns
].copy()


# ---------------------------------------------------------
# Round episode values
# ---------------------------------------------------------

episode_numeric_columns = [

    "duration_minutes",

    "observed_variance_kwh",

    "attributed_kwh",

    "unexplained_kwh",

    "category_frequency_pct",

    "category_total_loss_kwh",
]


for column in episode_numeric_columns:

    episode_recurrence[column] = (
        episode_recurrence[column]
        .round(3)
    )


# ---------------------------------------------------------
# Save outputs
# ---------------------------------------------------------

category_summary.to_csv(
    OUTPUT_RECURRENCE_SUMMARY,
    index=False,
)


episode_recurrence.to_csv(
    OUTPUT_EPISODE_RECURRENCE,
    index=False,
)


# ---------------------------------------------------------
# Report
# ---------------------------------------------------------

print(
    "TRACE Recurrence Engine created."
)

print()

print("Category summary:")
print(OUTPUT_RECURRENCE_SUMMARY)

print()

print("Episode recurrence:")
print(OUTPUT_EPISODE_RECURRENCE)

print()

print(
    "Total performance episodes:",
    total_episodes,
)

print()

print(
    "Recurrence classification:"
)

print(
    category_summary[
        [
            "primary_evidence_category",
            "episode_count",
            "total_observed_variance_kwh",
            "recurrence_class",
            "recurrence_score",
        ]
    ]
    .sort_values(
        "recurrence_score",
        ascending=False,
    )
    .to_string(index=False)
)

print()

print(
    "Recurrence classes:"
)

print(
    category_summary[
        "recurrence_class"
    ]
    .value_counts()
    .to_string()
)

print()

print(
    "Highest recurrence score:"
)

if not category_summary.empty:

    top_category = category_summary.sort_values(
        "recurrence_score",
        ascending=False,
    ).iloc[0]

    print(
        top_category[
            "primary_evidence_category"
        ],
        "-",
        top_category[
            "recurrence_score"
        ],
    )

print()

print(
    "Total observed variance:",
    round(
        episodes[
            "observed_variance_kwh"
        ].sum(),
        2,
    ),
    "kWh",
)

print()

print(
    "Recurrence Engine completed."
)