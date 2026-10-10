"""
routers/predict.py
POST /api/predict  — run the trained GradientBoostingRegressor model live.
Accepts poa_irradiance and module_temp, returns expected AC power and generation.
"""

from fastapi import APIRouter
from pydantic import BaseModel
import numpy as np
from app.core.data_loader import model

router = APIRouter(prefix="/api", tags=["Model"])

NAMEPLATE_KW   = 720.72
LOW_IRR_THRESH = 10.0
INTERVAL_HRS   = 0.25   # 15-minute intervals


class PredictRequest(BaseModel):
    poa_irradiance: float   # W/m²
    module_temp:    float   # °C


class PredictResponse(BaseModel):
    poa_irradiance:       float
    module_temp:          float
    expected_ac_power_kw: float
    expected_kwh:         float
    note:                 str


@router.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    if req.poa_irradiance < LOW_IRR_THRESH:
        return PredictResponse(
            poa_irradiance=req.poa_irradiance,
            module_temp=req.module_temp,
            expected_ac_power_kw=0.0,
            expected_kwh=0.0,
            note="Below low-irradiance threshold — expected output set to 0.",
        )

    features = np.array([[req.poa_irradiance, req.module_temp]])
    raw_kw   = float(model.predict(features)[0])
    clipped  = float(np.clip(raw_kw, 0.0, NAMEPLATE_KW))
    kwh      = round(clipped * INTERVAL_HRS, 4)

    return PredictResponse(
        poa_irradiance=req.poa_irradiance,
        module_temp=req.module_temp,
        expected_ac_power_kw=round(clipped, 3),
        expected_kwh=kwh,
        note="Predicted by GradientBoostingRegressor trained on January 2017 PVDAQ data.",
    )
