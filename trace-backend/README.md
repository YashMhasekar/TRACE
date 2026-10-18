# TRACE Backend

FastAPI backend for the TRACE application.

## Architecture

```
React + Firebase Auth  →  FastAPI  →  MongoDB Atlas
```

- **React** handles the UI and calls this API with Firebase ID tokens (auth added later).
- **FastAPI** processes all business logic and talks to the database.
- **MongoDB Atlas** is the sole data store.
- **Firebase** is used only for authentication on the frontend.

## Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Framework  | FastAPI                             |
| Server     | Uvicorn                             |
| Database   | MongoDB Atlas (via Motor / PyMongo) |
| Validation | Pydantic v2                         |
| Config     | python-dotenv                       |

## Getting Started

### 1. Create and activate a virtual environment

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in your MongoDB Atlas connection string and database name.

### 4. Run the development server

```bash
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`.

## Endpoints

| Method | Path      | Description                        |
|--------|-----------|------------------------------------|
| GET    | `/`       | Liveness check                     |
| GET    | `/health` | MongoDB Atlas connectivity check   |

## Interactive Docs

FastAPI auto-generates interactive documentation:

- Swagger UI: `http://localhost:8000/docs`
- ReDoc:       `http://localhost:8000/redoc`
