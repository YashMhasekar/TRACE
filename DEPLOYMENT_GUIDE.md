# TRACE System - Deployment Guide

## Quick Start

### 1. Verify System Integrity

```bash
# Navigate to data directory
cd "d:\Hackathon\Globathon by GlobeTech Hackathon\Project Folders\Trace\Trace\data"

# Run integrity check
python build_integrity_check.py
```

**Expected Output**:
```
Overall status: PASS
Integrity checks: 19
Failed checks: 0
```

✅ If you see PASS, proceed to step 2.

---

### 2. Start Backend API

```bash
# Navigate to backend directory
cd "d:\Hackathon\Globathon by GlobeTech Hackathon\Project Folders\Trace\Trace\trace-backend"

# Start the API server
uvicorn app.main:app --reload
```

**Expected Output**:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete
```

✅ API server should start without errors.

---

### 3. Verify API Endpoints

Open your browser or use curl:

**Test Health Check**:
```bash
curl http://localhost:8000/health
```

Expected: `{"status": "ok", "mongodb": "connected"}`

**Test Model Evaluation** (NEW):
```bash
curl http://localhost:8000/api/model/evaluation
```

Expected: JSON with model metrics

**Interactive Documentation**:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

---

### 4. Test All Endpoints

Visit http://localhost:8000/docs and test:

✅ `GET /` - Root health check  
✅ `GET /health` - MongoDB connectivity  
✅ `GET /api/overview` - Plant summary  
✅ `GET /api/performance` - Time-series data  
✅ `GET /api/attribution` - Waterfall attribution  
✅ `GET /api/recurrence` - Recurrence analysis  
✅ `GET /api/evidence` - Evidence chains  
✅ `GET /api/commercial` - Financial impact  
✅ `GET /api/recovery` - Recovery opportunities  
✅ `GET /api/operations` - Operations view  
✅ `GET /api/impact_tree` - Impact hierarchy  
✅ `GET /api/predict` - Predictions  
✅ `GET /api/model/evaluation` - **NEW** Model metrics  
✅ `GET /api/ai/questions` - AI questions  
✅ `POST /api/ai/investigate` - AI investigation  

---

### 5. Start Frontend (if available)

```bash
cd trace-frontend
npm install  # if first time
npm run dev
```

Then open: http://localhost:5173

---

## Detailed Deployment Steps

### Prerequisites

**Required**:
- Python 3.12+ (verified installed)
- pip (Python package manager)
- Node.js & npm (for frontend)

**Python Dependencies** (already installed):
```
fastapi
uvicorn[standard]
pymongo[srv]
pydantic
pydantic-settings
python-dotenv
firebase-admin
pandas
joblib
scikit-learn
numpy
```

**Check Installation**:
```bash
python --version
pip list | findstr "fastapi pandas scikit-learn"
```

---

### Environment Configuration

**Backend Configuration** (`trace-backend/.env`):

```env
# MongoDB Atlas connection
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
DATABASE_NAME=trace_db

# Firebase (optional, for auth)
FIREBASE_CREDENTIALS_PATH=../serviceAccountKey.json.json

# API Settings
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

**Note**: Update MongoDB URI with your actual credentials.

---

### Data Pipeline Re-execution (if needed)

If you need to regenerate all data:

```bash
cd data
python run_pipeline.py
```

This will:
1. Validate prerequisites
2. Execute all 12 pipeline steps in order
3. Generate all CSV outputs
4. Create model artifacts
5. Run integrity validation

**Duration**: ~10 seconds  
**Expected Result**: 12/12 steps successful, 19/19 integrity checks passed

---

## Verification Checklist

### Data Pipeline ✓

- [ ] All 12 pipeline scripts updated with config imports
- [ ] No hard-coded paths remain
- [ ] Pipeline executes successfully
- [ ] All 19 integrity checks pass
- [ ] Model evaluation JSON generated

### Backend API ✓

- [ ] Backend starts without errors
- [ ] All existing endpoints working
- [ ] NEW model evaluation endpoint working
- [ ] Data loader successfully imports CSVs
- [ ] Model file loaded correctly

### Configuration ✓

- [ ] `config.py` contains all parameters
- [ ] Relative paths used throughout
- [ ] Thresholds documented
- [ ] Commercial assumptions labeled synthetic

### Documentation ✓

- [ ] `ARCHITECTURE.md` - Current state
- [ ] `IMPROVEMENTS.md` - Detailed changes
- [ ] `IMPLEMENTATION_SUMMARY.md` - Executive summary
- [ ] `PIPELINE_SUCCESS.md` - Execution results
- [ ] `DEPLOYMENT_GUIDE.md` - This document

---

## Troubleshooting

### Issue: Pipeline fails at Episode Attribution

**Symptom**: `FileNotFoundError` for `trace_physical_quality.csv`

**Solution**: Ensure steps 1-3 completed successfully:
```bash
python process_physical_data.py
python build_expected_model.py
python add_data_quality_guard.py
```

---

### Issue: Backend fails to start

**Symptom**: `ModuleNotFoundError` or import errors

**Solution 1 - Check dependencies**:
```bash
cd trace-backend
pip install -r requirements.txt
```

**Solution 2 - Verify data files exist**:
```bash
dir ..\data\processed\*.csv
```

Should show 14 CSV files.

---

### Issue: Model evaluation endpoint returns 404

**Symptom**: `GET /api/model/evaluation` returns "Model evaluation file not found"

**Solution**: Run the expected generation model script:
```bash
cd data
python build_expected_model.py
```

Verify file created:
```bash
dir processed\model_evaluation.json
```

---

### Issue: Frontend cannot connect to API

**Symptom**: CORS errors or connection refused

**Solution 1 - Check CORS settings** in `trace-backend/app/main.py`:
```python
allow_origins=[
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
```

**Solution 2 - Verify backend is running**:
```bash
curl http://localhost:8000/health
```

---

### Issue: MongoDB connection fails

**Symptom**: Health check shows `"mongodb": "unreachable"`

**Solution 1 - Check MongoDB URI** in `.env`:
```env
MONGODB_URI=mongodb+srv://...
```

**Solution 2 - Test connection separately** (optional):
The API will still work for reading CSV data even if MongoDB is unreachable. MongoDB is only used for user sessions and auth.

---

## Performance Optimization

### Data Loading

**Current**: CSVs loaded once at startup (efficient)

**Memory Usage**: ~50-100 MB for all datasets

**Optimization**: If memory becomes an issue, consider:
- Loading on-demand instead of at startup
- Using parquet instead of CSV
- Implementing caching layer

### API Response Time

**Current**: Sub-second for most endpoints

**Optimization**: If needed, add:
- Response caching
- Database indexing
- Connection pooling

---

## Production Deployment Recommendations

### 1. Environment Variables

Move all secrets to environment variables:
- MongoDB URI
- Firebase credentials
- API keys (if adding external services)

### 2. Process Manager

Use a process manager for reliability:
```bash
# Using PM2 (Node.js process manager)
pm2 start "uvicorn app.main:app --host 0.0.0.0 --port 8000"

# Or using systemd (Linux)
# Create a systemd service file
```

### 3. Reverse Proxy

Use nginx or similar:
```nginx
location /api {
    proxy_pass http://localhost:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

### 4. SSL/TLS

Enable HTTPS for production:
- Use Let's Encrypt certificates
- Configure SSL in nginx/reverse proxy
- Update CORS origins to HTTPS URLs

### 5. Monitoring

Add monitoring tools:
- Application logs
- Performance metrics
- Error tracking (e.g., Sentry)
- Uptime monitoring

### 6. Database

For production, consider:
- MongoDB Atlas (already configured)
- Regular backups
- Replica sets for redundancy
- Proper indexing

### 7. Scaling

If traffic increases:
- Load balancer across multiple API instances
- CDN for static frontend assets
- Database read replicas

---

## API Documentation

### Model Evaluation Endpoint (NEW)

**Endpoint**: `GET /api/model/evaluation`

**Description**: Returns comprehensive model evaluation data including training metrics, validation metrics, feature importance, and methodology notes.

**Response Schema**:
```json
{
  "model_metadata": {
    "model_name": "string",
    "model_type": "string",
    "training_period": "string",
    "training_period_label": "string",
    "validation_period": "string",
    "validation_period_label": "string",
    "validation_type": "string",
    "features": ["string"],
    "target": "string"
  },
  "model_parameters": {
    "n_estimators": "number",
    "learning_rate": "number",
    "max_depth": "number",
    "random_state": "number"
  },
  "training_metrics": {
    "observations": "number",
    "mae_kw": "number",
    "rmse_kw": "number",
    "r2": "number",
    "nmae_percent": "number",
    "mean_actual_kw": "number"
  },
  "validation_metrics": {
    "observations": "number",
    "mae_kw": "number",
    "rmse_kw": "number",
    "r2": "number",
    "nmae_percent": "number",
    "mean_actual_kw": "number"
  },
  "feature_importance": {
    "feature_name": "number"
  },
  "domain_constraints": {
    "low_irradiance_threshold_w_m2": "number",
    "nameplate_capacity_kw": "number",
    "constraints_applied_count": "number"
  },
  "output_statistics": {
    "total_observations": "number",
    "expected_generation_available": "number",
    "variance_available": "number",
    "domain_constrained_observations": "number"
  },
  "methodology_notes": {
    "reference_period": "string",
    "validation_type": "string",
    "feature_importance": "string",
    "domain_constraints": "string"
  }
}
```

**Example Usage**:
```bash
curl http://localhost:8000/api/model/evaluation | python -m json.tool
```

**Frontend Integration**:
```javascript
// Fetch model evaluation
const response = await fetch('http://localhost:8000/api/model/evaluation');
const modelData = await response.json();

// Display metrics
console.log('Training R²:', modelData.training_metrics.r2);
console.log('Validation MAE:', modelData.validation_metrics.mae_kw, 'kW');
console.log('POA Importance:', modelData.feature_importance.poa_irradiance__5041);
```

---

## Configuration Reference

### Model Configuration (`data/config.py`)

```python
# Reference period (NOT "healthy baseline")
REFERENCE_MONTH = 1  # January

# Validation period
VALIDATION_MONTH = 2  # February

# Model parameters
MODEL_CONFIG = {
    "n_estimators": 150,
    "learning_rate": 0.05,
    "max_depth": 3,
    "random_state": 42,
}

# Features
FEATURES = [
    "poa_irradiance__5041",
    "module_temp__5043",
]

# Domain constraints
LOW_IRRADIANCE_THRESHOLD_W_M2 = 10
NAMEPLATE_CAPACITY_KW = 720.72
```

### Attribution Configuration

```python
# Variance thresholds
SIGNIFICANT_VARIANCE_PCT = 40
MIN_EXPECTED_KWH_FOR_VARIANCE = 5

# Evidence thresholds
HIGH_POA_THRESHOLD_W_M2 = 300
LOW_DC_POWER_THRESHOLD_KW = 20
```

### Recurrence Configuration

```python
# Episode count thresholds
RECURRING_EPISODE_COUNT = 3
STRUCTURAL_EPISODE_COUNT = 8
STRUCTURAL_LOSS_KWH = 500

# Temporal separation
MIN_SEPARATION_HOURS = 1
```

### Commercial Configuration (SYNTHETIC)

```python
# IMPORTANT: These are demonstration values
BASELINE_TARIFF_USD_PER_KWH = 0.055
SETTLEMENT_FACTOR = 0.97
COMMERCIAL_ADJUSTMENT_USD = 0.0
```

---

## Testing Procedures

### 1. Unit Testing (Recommended)

Create test files in `trace-backend/tests/`:

```python
# tests/test_model_evaluation.py
def test_model_evaluation_endpoint():
    response = client.get("/api/model/evaluation")
    assert response.status_code == 200
    data = response.json()
    assert "model_metadata" in data
    assert "training_metrics" in data
    assert "validation_metrics" in data
```

### 2. Integration Testing

Test complete data flow:
1. Run pipeline
2. Start backend
3. Call all endpoints
4. Verify responses

### 3. Load Testing (Optional)

Use tools like Apache Bench or Locust:
```bash
ab -n 1000 -c 10 http://localhost:8000/api/overview
```

---

## Maintenance

### Regular Tasks

**Daily**:
- Monitor API logs
- Check system health

**Weekly**:
- Review error logs
- Monitor performance metrics

**Monthly**:
- Review model performance
- Update documentation if needed

**Quarterly**:
- Consider model retraining with new data
- Review and update thresholds
- Performance optimization review

### Data Updates

To update with new PVDAQ data:

1. Add new CSV files to `data/pvdaq_raw/`
2. Run pipeline: `python run_pipeline.py`
3. Restart backend API
4. Verify integrity checks pass

### Model Retraining

To retrain with different parameters:

1. Edit `data/config.py` - Update `MODEL_CONFIG`
2. Run: `python build_expected_model.py`
3. Verify: `type processed\model_evaluation.json`
4. Restart backend API

---

## Security Considerations

### API Security

**Current**: Basic CORS protection

**Recommended for Production**:
- API key authentication
- Rate limiting
- Input validation
- SQL injection protection (if using SQL)
- XSS protection

### Data Security

- MongoDB authentication enabled
- Firebase credentials secured
- Environment variables for secrets
- No hard-coded credentials

### Network Security

- HTTPS in production
- Firewall rules
- VPN for administrative access (if needed)

---

## Support & Resources

### Documentation Files

- `ARCHITECTURE.md` - System architecture
- `IMPROVEMENTS.md` - What was improved
- `IMPLEMENTATION_SUMMARY.md` - Executive summary
- `PIPELINE_SUCCESS.md` - Pipeline results
- `DEPLOYMENT_GUIDE.md` - This document

### Configuration Files

- `data/config.py` - Central configuration
- `trace-backend/.env` - Environment variables
- `trace-backend/requirements.txt` - Python dependencies

### Key Scripts

- `data/run_pipeline.py` - Master orchestration
- `data/build_expected_model.py` - Model training
- `data/build_integrity_check.py` - Validation
- `trace-backend/app/main.py` - API entry point

---

## Success Criteria

✅ **Pipeline**: 12/12 steps successful  
✅ **Integrity**: 19/19 checks passed  
✅ **API**: All endpoints responsive  
✅ **Model**: Evaluation accessible via API  
✅ **Documentation**: Complete and accurate  
✅ **Configuration**: Portable and maintainable  

---

## Deployment Checklist

### Pre-Deployment

- [ ] Run `python run_pipeline.py` successfully
- [ ] Verify `model_evaluation.json` exists
- [ ] All integrity checks pass
- [ ] Environment variables configured
- [ ] Dependencies installed

### Deployment

- [ ] Backend starts without errors
- [ ] All API endpoints respond correctly
- [ ] Frontend connects to backend
- [ ] CORS configured properly
- [ ] MongoDB connection working

### Post-Deployment

- [ ] Test all endpoints manually
- [ ] Verify model evaluation endpoint
- [ ] Check logs for errors
- [ ] Monitor performance
- [ ] Document any issues

### Production Only

- [ ] HTTPS enabled
- [ ] Monitoring configured
- [ ] Backups scheduled
- [ ] Process manager configured
- [ ] Reverse proxy configured
- [ ] Security measures in place

---

**Last Updated**: 2026-10-09  
**Version**: 1.0 (Production-Ready)  
**Status**: ✅ OPERATIONAL
