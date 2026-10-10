"""
routers/model.py
GET /api/model/evaluation  — Model evaluation metrics and metadata
"""

import json
import os
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/model", tags=["Model"])


@router.get("/evaluation")
def get_model_evaluation():
    """
    Return structured model evaluation data.

    This endpoint exposes the expected generation model's:
    - Training and validation metrics (MAE, RMSE, R², nMAE)
    - Feature importance (tree-based Gini importance)
    - Domain constraints configuration
    - Model metadata and methodology notes

    The data comes from model_evaluation.json created during
    the expected generation model training process.
    """

    # Path to model evaluation JSON
    eval_path = os.path.abspath(
        os.path.join(
            os.path.dirname(__file__),
            "..", "..", "..", "data", "processed", "model_evaluation.json"
        )
    )

    if not os.path.exists(eval_path):
        raise HTTPException(
            status_code=404,
            detail={
                "error": "Model evaluation file not found",
                "message": (
                    "The model_evaluation.json file does not exist. "
                    "This file is created when build_expected_model.py runs. "
                    "Please ensure the data pipeline has been executed."
                ),
                "expected_path": eval_path,
            }
        )

    try:
        with open(eval_path, 'r') as f:
            evaluation_data = json.load(f)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Failed to load model evaluation",
                "message": str(e),
            }
        )

    # Add methodology notes for frontend display
    evaluation_data["methodology_notes"] = {
        "reference_period": (
            "The training period uses January 2017 data after operational-quality "
            "filtering. This is a REFERENCE TRAINING PERIOD, not a proven "
            "'healthy baseline.' The model learns normal operating patterns from "
            "filtered reference data."
        ),
        "validation_type": (
            "Temporal holdout validation using February 2017 as an unseen test "
            "period. This demonstrates temporal generalization WITHIN THIS PLANT. "
            "It does NOT demonstrate cross-plant generalization."
        ),
        "feature_importance": (
            "Feature importance values represent tree-based Gini importance "
            "(mean decrease in impurity), NOT causal influence or 'predictive power.' "
            "These indicate which features the model relies on most heavily for "
            "making predictions."
        ),
        "domain_constraints": (
            "Physical constraints (night detection, capacity caps) are applied "
            "POST-PREDICTION to prevent physically impossible outputs. The model "
            "makes unconstrained predictions first, then domain constraints are "
            "applied."
        ),
    }

    return evaluation_data
