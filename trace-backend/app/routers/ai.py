"""
routers/ai.py
──────────────────────────────────────────────────────────────────────────────
TRACE AI Investigator API — powered by xAI Grok.

Endpoints
─────────
  GET  /api/ai/questions        → list of suggested investigation questions
  POST /api/ai/chat             → full conversation endpoint (JSON, returns
                                  complete reply after Grok finishes)
  POST /api/ai/chat/stream      → streaming endpoint (SSE, streams tokens
                                  as they arrive from Grok)
  POST /api/ai/investigate      → legacy single-question endpoint (kept for
                                  backward compatibility with existing frontend)

Chat message schema
───────────────────
  POST body: { "messages": [{"role": "user"|"assistant", "content": "..."}] }
  Response:  { "reply": "...", "model": "grok-3-mini" }

The streaming endpoint returns:
  Content-Type: text/event-stream
  data: <token>\n\n
  data: [DONE]\n\n
"""

import logging
import os

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.services.grok_client import chat, chat_stream

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["AI Investigator"])

# ── Suggested questions ────────────────────────────────────────────────────
SUGGESTED_QUESTIONS = [
    "Why did we miss our generation target?",
    "What was the largest controllable loss this period?",
    "Which performance problem is recurring?",
    "How much generation is realistically recoverable?",
    "Is the revenue gap driven by generation or commercial terms?",
    "What evidence supports the equipment attribution?",
    "What would a 30% improvement in equipment performance recover?",
    "Show me the top 3 episodes by financial impact.",
    "How confident is TRACE in its attribution?",
    "What should we prioritise to maximise recovery?",
]


# ── Request / response models ──────────────────────────────────────────────

class ChatMessage(BaseModel):
    role:    str = Field(..., pattern="^(user|assistant)$")
    content: str = Field(..., min_length=1)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(..., min_length=1)


class InvestigateRequest(BaseModel):
    """Legacy single-question schema — kept for backward compat."""
    question: str


# ── Helper: grok_key_present ───────────────────────────────────────────────

def _grok_available() -> bool:
    return bool(os.getenv("GROQ_API_KEY", "").strip())


# ── GET /api/ai/questions ──────────────────────────────────────────────────

@router.get("/questions")
def get_questions():
    return {"suggestedQuestions": SUGGESTED_QUESTIONS}


# ── POST /api/ai/chat ──────────────────────────────────────────────────────

@router.post("/chat")
def chat_endpoint(req: ChatRequest):
    """
    Full-conversation endpoint.
    Sends the entire message history to Grok and returns the complete reply.
    """
    if not _grok_available():
        raise HTTPException(
            status_code=503,
            detail=(
                "GROQ_API_KEY is not configured. "
                "Set it in .env: GROQ_API_KEY=gsk_..."
            ),
        )
    try:
        msgs = [{"role": m.role, "content": m.content} for m in req.messages]
        reply = chat(msgs)
        return {
            "reply": reply,
            "model": os.getenv("GROQ_MODEL", "openai/gpt-oss-120b"),
        }
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Grok chat error: %s", exc)
        raise HTTPException(status_code=500, detail="AI service error") from exc


# ── POST /api/ai/chat/stream ───────────────────────────────────────────────

@router.post("/chat/stream")
async def chat_stream_endpoint(req: ChatRequest):
    """
    Streaming conversation endpoint.
    Returns Server-Sent Events — each event is a text chunk.
    Final event is: data: [DONE]
    """
    if not _grok_available():
        raise HTTPException(
            status_code=503,
            detail="GROQ_API_KEY is not configured.",
        )

    msgs = [{"role": m.role, "content": m.content} for m in req.messages]

    async def event_generator():
        try:
            async for chunk in chat_stream(msgs):
                # Escape newlines inside the SSE data field
                safe = chunk.replace("\n", "\\n")
                yield f"data: {safe}\n\n"
        except Exception as exc:
            logger.exception("Grok stream error: %s", exc)
            yield f"data: [ERROR] {exc}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":            "no-cache",
            "X-Accel-Buffering":        "no",       # disable nginx buffering
            "Access-Control-Allow-Origin": "*",
        },
    )


# ── POST /api/ai/investigate (legacy — redirects to chat) ─────────────────

@router.post("/investigate")
def investigate_legacy(req: InvestigateRequest):
    """
    Legacy endpoint kept for backward compat with old frontend.
    Wraps the question as a single-turn conversation and calls Grok.
    Falls back to a structured stub when Grok is unavailable.
    """
    if not _grok_available():
        # Graceful fallback when no API key is set
        return _stub_response(req.question)

    try:
        reply = chat([{"role": "user", "content": req.question}])
        return {
            "question":           req.question,
            "summary":            reply,
            "primaryCauses":      [],
            "evidenceIds":        [],
            "confidence":         None,
            "recommendedActions": [],
            "caveat":             (
                "Response generated by TRACE AI Investigator (Grok). "
                "Attribution is evidence-based, not a confirmed causal diagnosis."
            ),
        }
    except Exception as exc:
        logger.exception("Legacy investigate error: %s", exc)
        return _stub_response(req.question)


def _stub_response(question: str) -> dict:
    """Minimal structured response when Groq is unavailable."""
    return {
        "question":           question,
        "summary":            (
            "TRACE AI Investigator is currently unavailable (GROQ_API_KEY not configured). "
            "Please check the backend configuration and try again."
        ),
        "primaryCauses":      [],
        "evidenceIds":        [],
        "confidence":         None,
        "recommendedActions": [
            "Set GROQ_API_KEY=gsk_... in trace-backend/.env",
            "Restart the FastAPI server.",
        ],
        "caveat":             "AI service offline — no Groq API key found.",
    }
