"""
app/core/serialization.py
Serialization boundary utility for the TRACE backend.

Converts NumPy/Pandas scalar and array types to native Python equivalents
before any object is written to MongoDB or returned via the API.

Design principle:
    Computation layer   → Pandas/NumPy (free to use)
           ↓
    make_mongo_safe()   ← single conversion point
           ↓
    Persistence layer   → only JSON/BSON-safe native Python types

Usage:
    from app.core.serialization import make_mongo_safe

    safe = make_mongo_safe(my_dict)
    await collection.update_one(..., {"$set": {"metrics": safe}})
"""

import math
from datetime import datetime, date
from typing import Any

# ---------------------------------------------------------------------------
# Optional imports (graceful fallback if numpy/pandas not installed)
# ---------------------------------------------------------------------------
try:
    import numpy as np
    _HAS_NUMPY = True
except ImportError:  # pragma: no cover
    np = None  # type: ignore
    _HAS_NUMPY = False

try:
    import pandas as pd
    _HAS_PANDAS = True
except ImportError:  # pragma: no cover
    pd = None  # type: ignore
    _HAS_PANDAS = False


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def make_mongo_safe(obj: Any) -> Any:
    """
    Recursively convert an object to a MongoDB/JSON-safe native Python value.

    Handles:
        numpy.bool_        → bool
        numpy.integer      → int
        numpy.floating     → float  (NaN/Inf → None)
        numpy.ndarray      → list   (recursively converted)
        numpy.datetime64   → datetime ISO string
        pandas.Timestamp   → datetime ISO string
        pandas.NA / NaT    → None
        float NaN / Inf    → None
        dict               → recursively converted
        list / tuple       → recursively converted (tuple → list)
        datetime           → unchanged (MongoDB native)
        date               → ISO string
        str/int/float/bool/None/bytes → unchanged

    Args:
        obj: Any Python object, possibly containing NumPy/Pandas scalars.

    Returns:
        A MongoDB/JSON-encodable Python object.
    """
    # ── NumPy types ────────────────────────────────────────────────────────
    if _HAS_NUMPY:
        if isinstance(obj, np.bool_):
            return bool(obj)
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            v = float(obj)
            return None if (math.isnan(v) or math.isinf(v)) else v
        if isinstance(obj, np.ndarray):
            return [make_mongo_safe(x) for x in obj.tolist()]
        if isinstance(obj, np.datetime64):
            # Convert numpy datetime64 to ISO string via pandas if available
            if _HAS_PANDAS:
                return pd.Timestamp(obj).isoformat()
            return str(obj)

    # ── Pandas types ───────────────────────────────────────────────────────
    if _HAS_PANDAS:
        if isinstance(obj, pd.Timestamp):
            return obj.isoformat() if not pd.isna(obj) else None
        # pd.NA, pd.NaT, and any other pandas NA-like
        try:
            if pd.isna(obj):
                return None
        except (TypeError, ValueError):
            pass
        # pandas Series → list
        if isinstance(obj, pd.Series):
            return [make_mongo_safe(x) for x in obj.tolist()]

    # ── Native Python containers ───────────────────────────────────────────
    if isinstance(obj, dict):
        return {k: make_mongo_safe(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [make_mongo_safe(v) for v in obj]

    # ── Native Python scalars ──────────────────────────────────────────────
    if isinstance(obj, bool):
        return obj
    if isinstance(obj, int):
        return obj
    if isinstance(obj, float):
        return None if (math.isnan(obj) or math.isinf(obj)) else obj
    if isinstance(obj, str):
        return obj
    if isinstance(obj, bytes):
        return obj
    if obj is None:
        return None

    # ── Date/datetime ──────────────────────────────────────────────────────
    if isinstance(obj, datetime):
        return obj  # MongoDB stores datetime natively
    if isinstance(obj, date):
        return obj.isoformat()

    # ── Fallback: attempt str() conversion ────────────────────────────────
    # This handles any unexpected type gracefully rather than crashing.
    return str(obj)
