"""
database.py
Async MongoDB client using PyMongo Async (AsyncMongoClient).
Connects to MongoDB Atlas via the MONGODB_URI environment variable.
"""

import os
from dotenv import load_dotenv
from pymongo import AsyncMongoClient

load_dotenv()

MONGODB_URI: str | None = os.getenv("MONGODB_URI")
MONGODB_DATABASE: str | None = os.getenv("MONGODB_DATABASE")

if not MONGODB_URI:
    raise RuntimeError("MONGODB_URI is not set. Check your .env file.")

if not MONGODB_DATABASE:
    raise RuntimeError("MONGODB_DATABASE is not set. Check your .env file.")

# Module-level references — populated during app startup via init_db().
_client: AsyncMongoClient | None = None
db = None


def init_db() -> None:
    """Create the AsyncMongoClient and assign the module-level db object."""
    global _client, db
    _client = AsyncMongoClient(MONGODB_URI)
    db = _client[MONGODB_DATABASE]


async def close_db() -> None:
    """Close the AsyncMongoClient cleanly on application shutdown."""
    global _client
    if _client is not None:
        await _client.close()
        _client = None


async def ping_db() -> bool:
    """
    Send a ping command to MongoDB Atlas to verify the connection.

    Returns True when Atlas responds successfully.
    Raises an exception on failure so /health can catch and report it.
    """
    await _client.admin.command({"ping": 1})
    return True
