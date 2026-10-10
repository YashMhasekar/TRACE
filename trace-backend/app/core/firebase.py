"""
firebase.py
Firebase Admin SDK initialisation and ID token verification for TRACE.

The Admin SDK is initialised once at import time using one of two strategies,
controlled by environment variables:

  Strategy A – Service-account JSON file (recommended for local dev):
      FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/serviceAccountKey.json

  Strategy B – Individual credential fields (recommended for CI / cloud):
      FIREBASE_PROJECT_ID=your-project-id
      FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
      FIREBASE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\\n...\\n-----END RSA PRIVATE KEY-----\\n"

Strategy A takes priority when FIREBASE_SERVICE_ACCOUNT_PATH is set.
If neither strategy is configured, startup raises a RuntimeError early so the
problem is surfaced immediately rather than at the first authenticated request.
"""

import json
import os

import firebase_admin
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth, credentials

load_dotenv()

# ---------------------------------------------------------------------------
# Initialise Firebase Admin SDK (runs once at module import)
# ---------------------------------------------------------------------------

def _build_credentials() -> credentials.Base:
    """
    Build Firebase credentials from environment variables.

    Raises:
        RuntimeError: When neither credential strategy is configured.
    """
    sa_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
    if sa_path:
        return credentials.Certificate(sa_path)

    project_id = os.getenv("FIREBASE_PROJECT_ID")
    client_email = os.getenv("FIREBASE_CLIENT_EMAIL")
    private_key = os.getenv("FIREBASE_PRIVATE_KEY")

    if project_id and client_email and private_key:
        # Environment variables store \n as a literal two-character sequence;
        # the JSON parser expects real newlines inside the key string.
        private_key = private_key.replace("\\n", "\n")
        service_account_info = {
            "type": "service_account",
            "project_id": project_id,
            "client_email": client_email,
            "private_key": private_key,
            # Required fields that are not secret but must be present.
            "token_uri": "https://oauth2.googleapis.com/token",
        }
        return credentials.Certificate(service_account_info)

    raise RuntimeError(
        "Firebase Admin SDK is not configured. "
        "Set FIREBASE_SERVICE_ACCOUNT_PATH  or  "
        "FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY "
        "in your .env file."
    )


# Initialise only once; guard against double-initialisation during hot-reloads.
if not firebase_admin._apps:
    _cred = _build_credentials()
    firebase_admin.initialize_app(_cred)


# ---------------------------------------------------------------------------
# Token verification
# ---------------------------------------------------------------------------

def verify_firebase_token(id_token: str) -> dict:
    """
    Verify a Firebase ID token and return the decoded claims.

    Args:
        id_token: The raw JWT string sent by the client.

    Returns:
        A dict of decoded token claims, e.g.::

            {
                "uid":   "abc123",
                "email": "user@example.com",
                "name":  "Alice",          # present only when set in Firebase
                ...
            }

    Raises:
        HTTPException 401: When the token is invalid, expired, or revoked.
    """
    try:
        decoded = auth.verify_id_token(id_token, check_revoked=True)
        return decoded
    except auth.RevokedIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Firebase ID token has been revoked.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Firebase ID token has expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except auth.InvalidIdTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Firebase ID token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------

_bearer_scheme = HTTPBearer(auto_error=True)


def get_current_user(
    credentials_obj: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
) -> dict:
    """
    FastAPI dependency — extract and verify the Firebase ID token from the
    Authorization header.

    Usage::

        @app.get("/protected")
        async def protected_route(user: dict = Depends(get_current_user)):
            return {"uid": user["uid"]}

    Returns:
        Decoded Firebase token claims.

    Raises:
        HTTPException 401: When the Authorization header is missing, malformed,
                           or contains an invalid / expired token.
        HTTPException 403: Automatically raised by HTTPBearer when no
                           Authorization header is provided at all.
    """
    return verify_firebase_token(credentials_obj.credentials)
