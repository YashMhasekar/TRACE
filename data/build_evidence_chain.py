import pandas as pd

from config import (
    PHYSICAL_QUALITY_PATH,
    ATTRIBUTION_PATH,
    DECISION_INTELLIGENCE_PATH,
    EPISODE_RECURRENCE_PATH,
    OUTPUT_EVIDENCE_CHAIN,
    ensure_output_dir,
)

# Ensure output directory exists
ensure_output_dir()


# ---------------------------------------------------------
# Load datasets
# ---------------------------------------------------------

physical = pd.read_csv(PHYSICAL_QUALITY_PATH)

attribution = pd.read_csv(ATTRIBUTION_PATH)

decision = pd.read_csv(DECISION_INTELLIGENCE_PATH)

recurrence = pd.read_csv(EPISODE_RECURRENCE_PATH)


# ---------------------------------------------------------
# Convert timestamps
# ---------------------------------------------------------

physical["measured_on"] = pd.to_datetime(
    physical["measured_on"]
)

attribution["timestamp"] = pd.to_datetime(
    attribution["timestamp"]
)

decision["timestamp_start"] = pd.to_datetime(
    decision["timestamp_start"]
)

decision["timestamp_end"] = pd.to_datetime(
    decision["timestamp_end"]
)

recurrence["timestamp_start"] = pd.to_datetime(
    recurrence["timestamp_start"]
)

recurrence["timestamp_end"] = pd.to_datetime(
    recurrence["timestamp_end"]
)


# ---------------------------------------------------------
# Build evidence records
# ---------------------------------------------------------

evidence_records = []


for _, episode in decision.iterrows():

    episode_id = episode[
        "episode_id"
    ]

    start_time = episode[
        "timestamp_start"
    ]

    end_time = episode[
        "timestamp_end"
    ]


    # -----------------------------------------------------
    # Get physical observations belonging to episode
    # -----------------------------------------------------

    episode_physical = physical[
        (
            physical["measured_on"]
            >= start_time
        )
        &
        (
            physical["measured_on"]
            < end_time
        )
    ].copy()


    # -----------------------------------------------------
    # Get observation-level attribution
    # -----------------------------------------------------

    episode_attribution = attribution[
        attribution["timestamp"].isin(
            episode_physical[
                "measured_on"
            ]
        )
    ].copy()


    # -----------------------------------------------------
    # Physical evidence
    # -----------------------------------------------------

    observation_count = len(
        episode_physical
    )

    expected_kwh = episode[
        "expected_generation_kwh"
    ]

    actual_kwh = episode[
        "actual_generation_kwh"
    ]

    variance_kwh = episode[
        "observed_variance_kwh"
    ]


    # -----------------------------------------------------
    # Measurement availability
    # -----------------------------------------------------

    if observation_count > 0:

        ac_valid_pct = (
            episode_physical[
                "ac_power__5074"
            ]
            .notna()
            .mean()
            * 100
        )

        dc_valid_pct = (
            episode_physical[
                "dc_power__5077"
            ]
            .notna()
            .mean()
            * 100
        )

        poa_valid_pct = (
            episode_physical[
                "poa_irradiance__5041"
            ]
            .notna()
            .mean()
            * 100
        )

        temperature_valid_pct = (
            episode_physical[
                "module_temp__5043"
            ]
            .notna()
            .mean()
            * 100
        )

        pr_valid_pct = (
            episode_physical[
                "pr__5047"
            ]
            .notna()
            .mean()
            * 100
        )

    else:

        ac_valid_pct = 0
        dc_valid_pct = 0
        poa_valid_pct = 0
        temperature_valid_pct = 0
        pr_valid_pct = 0


    # -----------------------------------------------------
    # Environmental evidence
    # -----------------------------------------------------

    if observation_count > 0:

        average_poa = (
            episode_physical[
                "poa_irradiance__5041"
            ].mean()
        )

        minimum_poa = (
            episode_physical[
                "poa_irradiance__5041"
            ].min()
        )

        maximum_poa = (
            episode_physical[
                "poa_irradiance__5041"
            ].max()
        )

        average_module_temp = (
            episode_physical[
                "module_temp__5043"
            ].mean()
        )

    else:

        average_poa = None
        minimum_poa = None
        maximum_poa = None
        average_module_temp = None


    # -----------------------------------------------------
    # Electrical / conversion evidence
    # -----------------------------------------------------

    if observation_count > 0:

        average_dc_power = (
            episode_physical[
                "dc_power__5077"
            ].mean()
        )

        minimum_dc_power = (
            episode_physical[
                "dc_power__5077"
            ].min()
        )

        maximum_dc_power = (
            episode_physical[
                "dc_power__5077"
            ].max()
        )

        average_ac_power = (
            episode_physical[
                "ac_power__5074"
            ].mean()
        )

        minimum_ac_power = (
            episode_physical[
                "ac_power__5074"
            ].min()
        )

        maximum_ac_power = (
            episode_physical[
                "ac_power__5074"
            ].max()
        )

    else:

        average_dc_power = None
        minimum_dc_power = None
        maximum_dc_power = None
        average_ac_power = None
        minimum_ac_power = None
        maximum_ac_power = None


    # -----------------------------------------------------
    # Attribution evidence
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

        attribution_observation_count = (
            len(episode_attribution)
        )

    else:

        environmental_kwh = 0
        equipment_kwh = 0
        data_quality_kwh = 0
        unexplained_kwh = variance_kwh
        attribution_observation_count = 0


    # -----------------------------------------------------
    # Evidence contribution percentages
    # -----------------------------------------------------

    if variance_kwh > 0:

        environmental_pct = (
            environmental_kwh
            / variance_kwh
            * 100
        )

        equipment_pct = (
            equipment_kwh
            / variance_kwh
            * 100
        )

        data_quality_pct = (
            data_quality_kwh
            / variance_kwh
            * 100
        )

        unexplained_pct = (
            unexplained_kwh
            / variance_kwh
            * 100
        )

    else:

        environmental_pct = 0
        equipment_pct = 0
        data_quality_pct = 0
        unexplained_pct = 0


    # -----------------------------------------------------
    # Recurrence evidence
    # -----------------------------------------------------

    recurrence_match = recurrence[
        recurrence["episode_id"]
        == episode_id
    ]

    if not recurrence_match.empty:

        recurrence_row = (
            recurrence_match.iloc[0]
        )

        recurrence_class = (
            recurrence_row[
                "recurrence_class"
            ]
        )

        category_episode_count = (
            recurrence_row[
                "category_episode_count"
            ]
        )

        category_frequency_pct = (
            recurrence_row[
                "category_frequency_pct"
            ]
        )

        category_total_loss_kwh = (
            recurrence_row[
                "category_total_loss_kwh"
            ]
        )

        recurrence_action = (
            recurrence_row[
                "recurrence_action"
            ]
        )

    else:

        recurrence_class = "UNKNOWN"
        category_episode_count = 0
        category_frequency_pct = 0
        category_total_loss_kwh = 0
        recurrence_action = "REVIEW"


    # -----------------------------------------------------
    # Evidence quality
    # -----------------------------------------------------

    evidence_values = [
        ac_valid_pct,
        dc_valid_pct,
        poa_valid_pct,
        temperature_valid_pct,
    ]

    evidence_completeness_pct = (
        sum(evidence_values)
        / len(evidence_values)
    )


    # -----------------------------------------------------
    # Evidence status
    # -----------------------------------------------------

    if (
        episode["attribution_confidence"]
        == "HIGH"
        and evidence_completeness_pct
        >= 75
    ):

        evidence_status = "STRONG"

    elif (
        episode["attribution_confidence"]
        in ["HIGH", "MEDIUM"]
        and evidence_completeness_pct
        >= 50
    ):

        evidence_status = "MODERATE"

    else:

        evidence_status = "LIMITED"


    # -----------------------------------------------------
    # Build human-readable proof statement
    # -----------------------------------------------------

    proof_statement = (
        f"{episode_id}: Expected generation was "
        f"{expected_kwh:.2f} kWh and actual generation "
        f"was {actual_kwh:.2f} kWh, producing an observed "
        f"variance of {variance_kwh:.2f} kWh. "
        f"The primary evidence category was "
        f"{episode['primary_evidence_category']} "
        f"with {episode['attribution_confidence'].lower()} "
        f"confidence. "
        f"Current evidence status is {evidence_status.lower()}. "
        f"TRACE classifies the recurrence state as "
        f"{recurrence_class.lower()}."
    )


    # -----------------------------------------------------
    # Evidence limitations
    # -----------------------------------------------------

    limitations = []

    if ac_valid_pct < 100:

        limitations.append(
            "AC measurement is incomplete."
        )

    if dc_valid_pct < 100:

        limitations.append(
            "DC measurement is incomplete."
        )

    if poa_valid_pct < 100:

        limitations.append(
            "POA irradiance measurement is incomplete."
        )

    if episode[
        "primary_evidence_category"
    ] == "EQUIPMENT_CONVERSION":

        limitations.append(
            "Current data supports equipment/conversion "
            "evidence but does not prove a specific "
            "equipment failure."
        )

    if episode[
        "primary_evidence_category"
    ] == "UNEXPLAINED":

        limitations.append(
            "Current evidence is insufficient to establish "
            "a dominant cause."
        )

    if episode[
        "primary_evidence_category"
    ] == "DATA_QUALITY":

        limitations.append(
            "Measurement quality prevents treating the "
            "observed gap as confirmed production loss."
        )

    if not limitations:

        limitations.append(
            "No major evidence limitation detected."
        )


    evidence_records.append(
        {

            # ---------------------------------------------
            # Identity
            # ---------------------------------------------

            "episode_id": episode_id,

            "timestamp_start": start_time,

            "timestamp_end": end_time,

            "duration_minutes": episode[
                "duration_minutes"
            ],

            "observation_count": observation_count,

            # ---------------------------------------------
            # Performance evidence
            # ---------------------------------------------

            "expected_generation_kwh": expected_kwh,

            "actual_generation_kwh": actual_kwh,

            "observed_variance_kwh": variance_kwh,

            "variance_pct": episode[
                "variance_pct"
            ],

            # ---------------------------------------------
            # Measurement evidence
            # ---------------------------------------------

            "ac_valid_pct": ac_valid_pct,

            "dc_valid_pct": dc_valid_pct,

            "poa_valid_pct": poa_valid_pct,

            "temperature_valid_pct": (
                temperature_valid_pct
            ),

            "pr_valid_pct": pr_valid_pct,

            "evidence_completeness_pct": (
                evidence_completeness_pct
            ),

            "evidence_status": evidence_status,

            # ---------------------------------------------
            # Environmental evidence
            # ---------------------------------------------

            "average_poa_irradiance": average_poa,

            "minimum_poa_irradiance": minimum_poa,

            "maximum_poa_irradiance": maximum_poa,

            "average_module_temperature": (
                average_module_temp
            ),

            # ---------------------------------------------
            # Electrical evidence
            # ---------------------------------------------

            "average_dc_power": average_dc_power,

            "minimum_dc_power": minimum_dc_power,

            "maximum_dc_power": maximum_dc_power,

            "average_ac_power": average_ac_power,

            "minimum_ac_power": minimum_ac_power,

            "maximum_ac_power": maximum_ac_power,

            # ---------------------------------------------
            # Attribution evidence
            # ---------------------------------------------

            "attribution_observation_count": (
                attribution_observation_count
            ),

            "environmental_kwh": (
                environmental_kwh
            ),

            "equipment_conversion_kwh": (
                equipment_kwh
            ),

            "data_quality_kwh": (
                data_quality_kwh
            ),

            "unexplained_kwh": (
                unexplained_kwh
            ),

            "environmental_pct": (
                environmental_pct
            ),

            "equipment_conversion_pct": (
                equipment_pct
            ),

            "data_quality_pct": (
                data_quality_pct
            ),

            "unexplained_pct": (
                unexplained_pct
            ),

            # ---------------------------------------------
            # Decision evidence
            # ---------------------------------------------

            "primary_evidence_category": episode[
                "primary_evidence_category"
            ],

            "attribution_confidence": episode[
                "attribution_confidence"
            ],

            "explainability": episode[
                "explainability"
            ],

            "controllability": episode[
                "controllability"
            ],

            "recoverability": episode[
                "recoverability"
            ],

            "recovery_potential_kwh": episode[
                "recovery_potential_kwh"
            ],

            "priority": episode[
                "priority"
            ],

            "recommended_action": episode[
                "recommended_action"
            ],

            # ---------------------------------------------
            # Recurrence evidence
            # ---------------------------------------------

            "recurrence_class": recurrence_class,

            "category_episode_count": (
                category_episode_count
            ),

            "category_frequency_pct": (
                category_frequency_pct
            ),

            "category_total_loss_kwh": (
                category_total_loss_kwh
            ),

            "recurrence_action": recurrence_action,

            # ---------------------------------------------
            # Proof
            # ---------------------------------------------

            "evidence_status": evidence_status,

            "proof_statement": proof_statement,

            "evidence_limitations": (
                " ".join(limitations)
            ),

        }
    )


# ---------------------------------------------------------
# Create DataFrame
# ---------------------------------------------------------

evidence_df = pd.DataFrame(
    evidence_records
)


# ---------------------------------------------------------
# Remove duplicate evidence_status column
# ---------------------------------------------------------

evidence_df = evidence_df.loc[
    :,
    ~evidence_df.columns.duplicated()
]


# ---------------------------------------------------------
# Round numeric values
# ---------------------------------------------------------

numeric_columns = [
    "duration_minutes",
    "expected_generation_kwh",
    "actual_generation_kwh",
    "observed_variance_kwh",
    "variance_pct",
    "ac_valid_pct",
    "dc_valid_pct",
    "poa_valid_pct",
    "temperature_valid_pct",
    "pr_valid_pct",
    "evidence_completeness_pct",
    "average_poa_irradiance",
    "minimum_poa_irradiance",
    "maximum_poa_irradiance",
    "average_module_temperature",
    "average_dc_power",
    "minimum_dc_power",
    "maximum_dc_power",
    "average_ac_power",
    "minimum_ac_power",
    "maximum_ac_power",
    "environmental_kwh",
    "equipment_conversion_kwh",
    "data_quality_kwh",
    "unexplained_kwh",
    "environmental_pct",
    "equipment_conversion_pct",
    "data_quality_pct",
    "unexplained_pct",
    "recovery_potential_kwh",
    "category_frequency_pct",
    "category_total_loss_kwh",
]


for column in numeric_columns:

    if column in evidence_df.columns:

        evidence_df[column] = (
            evidence_df[column]
            .round(3)
        )


# ---------------------------------------------------------
# Save
# ---------------------------------------------------------

evidence_df.to_csv(
    OUTPUT_EVIDENCE_CHAIN,
    index=False,
)


# ---------------------------------------------------------
# Report
# ---------------------------------------------------------

print(
    "TRACE Evidence & Proof Chain created."
)

print()

print("Output:")
print(OUTPUT_EVIDENCE_CHAIN)

print()

print(
    "Evidence records:",
    len(evidence_df),
)

print()

print(
    "Evidence status:"
)

print(
    evidence_df[
        "evidence_status"
    ]
    .value_counts()
    .to_string()
)

print()

print(
    "Primary evidence categories:"
)

print(
    evidence_df[
        "primary_evidence_category"
    ]
    .value_counts()
    .to_string()
)

print()

print(
    "Average evidence completeness:",
    round(
        evidence_df[
            "evidence_completeness_pct"
        ].mean(),
        2,
    ),
    "%",
)

print()

print(
    "High-confidence episodes:",
    (
        evidence_df[
            "attribution_confidence"
        ]
        == "HIGH"
    ).sum(),
)

print(
    "Medium-confidence episodes:",
    (
        evidence_df[
            "attribution_confidence"
        ]
        == "MEDIUM"
    ).sum(),
)

print(
    "Low-confidence episodes:",
    (
        evidence_df[
            "attribution_confidence"
        ]
        == "LOW"
    ).sum(),
)

print()

print(
    "Top 10 proof records:"
)

print(
    evidence_df.sort_values(
        "observed_variance_kwh",
        ascending=False,
    )[
        [
            "episode_id",
            "observed_variance_kwh",
            "primary_evidence_category",
            "attribution_confidence",
            "evidence_status",
            "recurrence_class",
            "priority",
        ]
    ]
    .head(10)
    .to_string(index=False)
)

print()

print(
    "Evidence & Proof Chain completed."
)