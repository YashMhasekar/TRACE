# TRACE System Architecture

## Current State Assessment (Pre-Enhancement)

### Overall Architecture

```
RAW DATA (PVDAQ)
    ↓
PREPROCESSING (process_physical_data.py)
    ↓
EXPECTED GENERATION MODEL (build_expected_model.py)
    ↓
DATA QUALITY GUARD (add_data_quality_guard.py)
    ↓
ATTRIBUTION ENGINE (build_attribution_engine.py)
    ↓
EPISODE ATTRIBUTION (build_episode_attribution.py)
    ↓
RECURRENCE ENGINE (build_recurrence_engine.py)
    ↓
DECISION ENGINE (build_decision_engine.py)
    ↓
EVIDENCE CHAIN (build_evidence_chain.py)
    ↓
COMMERCIAL LAYER (build_commercial_layer.py)
    ↓
RECOVERY RECONCILIATION (build_recovery_reconciliation.py)
    ↓
INTEGRITY CHECK (build_integrity_check.py)
    ↓
FastAPI BACKEND → React FRONTEND
```

## Data Flow

### 1. Raw Data
- **Source**: PVDAQ system 1430
- **Period**: January-February 2017
- **Files**: 60 daily CSV files
- **Interval**: 15-minute observations
- **Key Signals**:
  - `ac_power__5074` (kW)
  - `dc_power__5077` (W)
  - `poa_irradiance__5041` (W/m²)
  - `module_temp__5043` (°C)
  - `ambient_temp__5042` (°C)
  - `pr__5047` (performance ratio)

### 2. Expected Generation Model

**Status**: ✓ Working, needs methodology clarification

**Current Implementation**:
- Model: `GradientBoostingRegressor`
- Features: POA irradiance, module temperature
- Training: January 2017 (filtered for operational quality)
- Validation: February 2017 (temporal holdout)
- Domain Constraints: Night detection, capacity cap
- Output: `expected_generation_model.joblib`

**What's Good**:
- Real PV data usage
- Chronological train/test split (no data leakage)
- Physical constraints (night, capacity)
- Proper validation on unseen period

**Needs Improvement**:
- Clarify January is "reference period" not "proven healthy baseline"
- Expose model metrics in structured format
- Fix feature importance language (not "predictive power")
- Separate raw vs constrained predictions for debugging
- Add model evaluation API endpoint

### 3. Data Quality Guard

**Status**: ✓ Excellent implementation

**Current Implementation**:
- Preserves raw values (doesn't delete suspicious data)
- Adds quality metadata flags
- Distinguishes:
  - Production observable
  - Environment observable
  - Attribution eligible
  - Measurement uncertainty

**What's Good**:
- Non-destructive quality flagging
- Explicit quality classification (GOOD/DEGRADED/POOR)
- Clear attribution confidence levels
- Transparent data quality reasoning

**No Major Changes Needed**: This is already production-grade

### 4. Attribution Engine

**Status**: ⚠️ Working but needs methodological corrections

**Current Implementation**:
- Categories: EQUIPMENT_CONVERSION, ENVIRONMENTAL, DATA_QUALITY, UNEXPLAINED
- Evidence scoring based on signal patterns
- Reconciliation: attributed + unexplained = observed

**What's Good**:
- Evidence-based approach (not claiming causation)
- DC/AC evidence analysis
- Reconciliation enforcement
- Confidence scoring

**Needs Improvement**:
- Fix unexplained starting at fixed 0.60 prior
- Separate evidence confidence from allocated contribution
- Strengthen DC→AC evidence chain logic
- Never force 100% attribution when evidence is weak
- Allow significant UNEXPLAINED allocation when appropriate
- Add anomaly detection integration point (TSPulse)

### 5. Episode Attribution

**Status**: ✓ Good implementation

**Current Implementation**:
- Groups consecutive significant performance gaps
- Aggregates observation-level attribution to episodes
- Maintains reconciliation at episode level

**What's Good**:
- Continuous episode detection
- Proper temporal grouping
- Weighted confidence aggregation

**Minor Improvements**:
- Add signal signature comparison between episodes

### 6. Recurrence Engine

**Status**: ✓ Good structure, needs evidence strengthening

**Current Implementation**:
- Classification: ISOLATED → REPEATED → RECURRING → POTENTIALLY_STRUCTURAL
- Frequency-based recurrence scoring
- Episode count thresholds

**What's Good**:
- Progressive classification system
- Frequency + loss combined scoring
- Clear recurrence interpretation

**Needs Improvement**:
- Add signal signature similarity check
- Validate episodes actually represent same phenomenon
- Consider temporal separation pattern
- Add evidence consistency metric

### 7. Decision Engine (Recoverability)

**Status**: ✓ Excellent conceptual framework

**Current Implementation**:
- Explainability: evidence sufficiency
- Controllability: operational influence potential
- Recoverability: recovery opportunity assessment
- Priority: decision-support ranking

**What's Good**:
- Clear distinction between dimensions
- Conservative recoverability assessment
- Doesn't claim guaranteed recovery
- Uses "POTENTIALLY_CONTROLLABLE" (appropriate caution)

**Minor Improvements**:
- Add scenario simulation support
- Strengthen controllability evidence

### 8. Commercial Layer

**Status**: ✓ Good, properly labeled synthetic

**Current Implementation**:
- Tariff: $0.055/kWh (synthetic assumption)
- Settlement factor: 0.97 (synthetic assumption)
- Revenue impact calculation
- Episode-level financial translation

**What's Good**:
- Clearly labeled as "SYNTHETIC_TRACE_ASSUMPTION"
- Proper separation from physical generation
- Configurable assumptions

**No Major Changes Needed**: Already transparent

### 9. Recovery Reconciliation

**Status**: ✓ Excellent implementation

**Current Implementation**:
- Caps episode recovery at period-level gap
- Prevents over-claiming recovery
- Tracks unreconciled recovery
- Clear reconciliation status

**What's Good**:
- Conservative recovery capping
- Transparent unreconciled tracking
- Clear reconciliation rules

**No Changes Needed**: This is production-grade

### 10. Integrity Check

**Status**: ✓ Excellent validation layer

**Current Implementation**:
- 19 integrity checks
- Reconciliation validation
- Data quality protection
- Recovery cap enforcement
- Evidence chain completeness

**What's Good**:
- Comprehensive validation
- Tolerance-aware checking
- Explicit PASS/FAIL status
- Protection against silent errors

**No Major Changes Needed**: Already production-grade

## API Architecture

### Current Endpoints

```
GET  /                    → Health check
GET  /health              → MongoDB connectivity
GET  /api/auth/me         → Current user

GET  /api/overview        → Plant summary + KPIs
GET  /api/performance     → Time-series performance
GET  /api/attribution     → Waterfall attribution
GET  /api/recurrence      → Recurrence analysis
GET  /api/evidence        → Evidence chains
GET  /api/commercial      → Financial impact
GET  /api/recovery        → Recovery opportunities
GET  /api/operations      → Operational view
GET  /api/impact_tree     → Impact hierarchy
GET  /api/predict         → Model predictions

GET  /api/ai/questions    → Suggested questions
POST /api/ai/investigate  → AI-powered investigation
```

### Data Loading

**Pattern**: Single CSV load at startup (efficient)
- All routers import from `data_loader.py`
- No CSV read more than once
- Pandas DataFrames held in memory

**Status**: ✓ Efficient architecture

## Critical Issues Found

### 1. Hard-Coded Paths (P0 - Blocking Portability)
**Location**: All data pipeline scripts
**Issue**: `C:\Users\Yash\Desktop\Trace\...` paths everywhere
**Impact**: Cannot run on other machines/environments
**Fix**: Use relative paths or environment variables

### 2. Model Validation Language (P1 - Methodological Correctness)
**Location**: Model documentation, comments
**Issue**: January called "healthy baseline" without proof
**Impact**: Overstates confidence in baseline quality
**Fix**: Call it "reference training period after operational-quality filtering"

### 3. Feature Importance Language (P1 - Methodological Correctness)
**Location**: Model interpretation
**Issue**: Feature importance called "predictive power"
**Impact**: Suggests causal interpretation
**Fix**: "Tree-based feature importance" or "model contribution"

### 4. Attribution Unexplained Prior (P1 - Technical)
**Location**: `build_attribution_engine.py`
**Issue**: Starts unexplained at fixed 0.60
**Impact**: Appears arbitrary, not evidence-driven
**Fix**: Calculate from evidence strength or remove fixed prior

### 5. Missing Model Evaluation API (P1 - Completeness)
**Location**: No API endpoint
**Issue**: Model metrics not exposed to frontend
**Impact**: Cannot verify model performance from UI
**Fix**: Add `/api/model/evaluation` endpoint

### 6. No Configuration Management (P2 - Maintainability)
**Location**: Magic numbers throughout code
**Issue**: Thresholds hard-coded in scripts
**Impact**: Difficult to tune or experiment
**Fix**: Create config files

### 7. No Test Suite (P2 - Quality Assurance)
**Location**: No test directory
**Issue**: No automated validation of calculations
**Impact**: Risk of regression when changing code
**Fix**: Add pytest test suite

### 8. No Pipeline Orchestration (P2 - Usability)
**Location**: No single entry point
**Issue**: Must run 11 scripts manually in order
**Impact**: Error-prone, difficult to reproduce
**Fix**: Create master pipeline script

## What Is Already Excellent

1. **Data Quality Guard**: Non-destructive, transparent, production-ready
2. **Recovery Reconciliation**: Conservative, well-designed, prevents over-claiming
3. **Integrity Check**: Comprehensive validation, proper tolerance handling
4. **Evidence Framework**: Clear separation of evidence vs causation
5. **Decision Intelligence**: Conservative language (POTENTIALLY_CONTROLLABLE)
6. **API Architecture**: Clean separation, efficient data loading
7. **Commercial Transparency**: Clearly labeled synthetic assumptions

## Validation Results

### Model Performance (from existing code output)
- Training Period: January 2017
- Test Period: February 2017 (unseen)
- Validation Type: Temporal holdout (within-plant)
- Test observations: Several thousand 15-min intervals
- Metrics: MAE, R², calculated on holdout

### Data Integrity (from integrity_check.py)
- 19 automated checks
- Reconciliation tolerance: 0.10 kWh
- Attribution reconciliation: Enforced
- Recovery cap: Enforced
- Evidence completeness: Validated

## Technology Stack

### Backend
- Framework: FastAPI
- ML: scikit-learn (GradientBoostingRegressor)
- Data: pandas, numpy
- Model Persistence: joblib
- Database: MongoDB Atlas (user/session data)
- Auth: Firebase (frontend only)

### Frontend
- Framework: React
- Auth: Firebase ID tokens
- API: REST (fetch to FastAPI)

### Data Pipeline
- Language: Python 3.x
- Dependencies: pandas, numpy, scikit-learn, joblib

## Next Steps (Priority Order)

### P0 - Correctness
1. Fix hard-coded paths → relative/environment-based
2. Fix model validation language → "reference period"
3. Fix feature importance language → "tree-based importance"
4. Fix attribution unexplained prior → evidence-driven

### P1 - Completeness
5. Add model evaluation API endpoint
6. Strengthen attribution evidence logic
7. Improve recurrence evidence consistency
8. Add configuration management

### P2 - Quality
9. Add comprehensive test suite
10. Add pipeline orchestration script
11. Add structured logging
12. Add progress reporting

### P3 - Optional Enhancements
13. Chronos-2 integration (forecasting cross-check)
14. TSPulse integration (anomaly detection)
15. BGE-M3 integration (historical similarity)
16. Vector search (MongoDB Atlas)

## Key Architectural Principles

1. **Preserve Good Work**: The expected-generation model is solid
2. **Evidence Over Causation**: Never claim causal proof without support
3. **Conservative Recovery**: Never over-claim recoverability
4. **Transparent Assumptions**: Label synthetic/assumed values clearly
5. **Non-Destructive**: Preserve raw data, add quality metadata
6. **Reconciliation**: Enforce mathematical consistency
7. **Explainability**: Allow UNEXPLAINED when evidence insufficient
8. **Backward Compatible**: Don't break existing API contracts

## File Organization

```
Trace/
├── data/
│   ├── pvdaq_raw/              # Raw PVDAQ CSVs (60 files)
│   ├── processed/              # Pipeline outputs (14 CSVs + model)
│   ├── process_physical_data.py
│   ├── build_expected_model.py
│   ├── add_data_quality_guard.py
│   ├── build_attribution_engine.py
│   ├── build_episode_attribution.py
│   ├── build_recurrence_engine.py
│   ├── build_decision_engine.py
│   ├── build_evidence_chain.py
│   ├── build_commercial_layer.py
│   ├── build_recovery_reconciliation.py
│   ├── build_integrity_check.py
│   └── create_event_dataset.py
├── trace-backend/
│   ├── app/
│   │   ├── core/
│   │   │   ├── database.py
│   │   │   ├── data_loader.py
│   │   │   └── firebase.py
│   │   ├── routers/
│   │   │   ├── overview.py
│   │   │   ├── performance.py
│   │   │   ├── attribution.py
│   │   │   ├── recurrence.py
│   │   │   ├── evidence.py
│   │   │   ├── commercial.py
│   │   │   ├── recovery.py
│   │   │   ├── operations.py
│   │   │   ├── impact_tree.py
│   │   │   ├── predict.py
│   │   │   └── ai.py
│   │   └── main.py
│   ├── requirements.txt
│   └── .env
└── trace-frontend/
    └── (React application)
```

## Conclusion

**Current Status**: The TRACE system has excellent foundational architecture with strong data quality management, reconciliation enforcement, and conservative decision-making. The expected-generation model is scientifically sound with proper temporal validation.

**Primary Needs**:
1. Path portability fixes
2. Methodological language corrections
3. Attribution logic refinement
4. API completeness (model evaluation endpoint)
5. Test coverage

**Assessment**: This is a solid V1 implementation that needs targeted improvements, not a complete rewrite. The core architecture is production-ready.
