"""
services/grok_client.py
──────────────────────────────────────────────────────────────────────────────
Groq API client for the TRACE AI Investigator.

Uses the official `groq` Python SDK (pip install groq).
API key: GROQ_API_KEY=gsk_... from .env
Model:   GROQ_MODEL (default: llama-3.3-70b-versatile)

Architecture
────────────
  build_trace_context()  →  compact factual snapshot of all TRACE DataFrames,
                             injected as the system prompt for every call.
  chat()                 →  blocking call, returns full reply string.
  chat_stream()          →  async generator yielding streamed text chunks.
"""

from __future__ import annotations

import os
import logging
from typing import AsyncGenerator

import pandas as pd
from groq import Groq, AsyncGroq

from app.core.data_loader import (
    commercial_df,
    decision_df,
    episode_attr_df,
    episode_financial_df,
    recurrence_summary_df,
    recovery_df,
    physical_expected_df,
    integrity_df,
)

logger = logging.getLogger(__name__)

# ── Config ─────────────────────────────────────────────────────────────────
def get_groq_api_key() -> str:
    key = os.getenv("GROQ_API_KEY", "").strip()
    if not key:
        raise RuntimeError("GROQ_API_KEY is not set. Add it to .env: GROQ_API_KEY=gsk_...")
    return key

def get_groq_model() -> str:
    # Tested reference model from test_groq.py
    return os.getenv("GROQ_MODEL", "openai/gpt-oss-120b").strip() or "openai/gpt-oss-120b"

_MAX_TOKENS = int(os.getenv("GROQ_MAX_TOKENS", "1500"))
_TEMPERATURE = float(os.getenv("GROQ_TEMPERATURE", "0.2"))

# ── TRACE system identity ──────────────────────────────────────────────────
_TRACE_IDENTITY = """You are the TRACE AI Investigator, an expert assistant embedded in the
TRACE energy performance attribution platform.

TRACE analyses real solar PV telemetry from NREL PVDAQ System 1430
(January–February 2017, 15-minute intervals) to answer:
  "Why did the plant miss its expected generation target?"

You ONLY answer questions about:
  • Performance gaps (expected vs actual generation)
  • Attribution causes (Equipment, Environmental, Data Quality, Unexplained)
  • Evidence supporting each attribution
  • Recurrence patterns
  • Recoverability and recovery simulation
  • Commercial / revenue impact of losses

Rules:
  1. Base every answer on the TRACE DATA CONTEXT provided below — never invent numbers.
  2. Always state when a figure is a model estimate, not a confirmed measurement.
  3. Keep responses concise and structured: lead with the key finding, then detail.
  4. If the question is outside TRACE data scope, say so and suggest the closest TRACE question.
  5. Attribution is evidence-weighted — NOT proof of physical causality.
  6. Commercial figures use synthetic assumptions (tariff $0.055/kWh) — always label them.
  7. Format responses with **bold** for key figures and bullet points for lists.
"""


def _safe_float(val, default: float = 0.0) -> float:
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


def _safe_int(val, default: int = 0) -> int:
    try:
        return int(val)
    except (TypeError, ValueError):
        return default


def _label(cat: str) -> str:
    return {
        "EQUIPMENT_CONVERSION": "Equipment / Conversion Loss",
        "ENVIRONMENTAL":        "Environmental (Irradiance / Temperature)",
        "DATA_QUALITY":         "Data Quality Gap",
        "UNEXPLAINED":          "Unexplained Loss",
    }.get(str(cat), str(cat).replace("_", " ").title())


# ── Context builder ────────────────────────────────────────────────────────
def build_trace_context() -> str:
    """
    Assembles a compact, token-efficient factual snapshot of the TRACE
    analysis results to inject into every Groq conversation.
    """
    lines: list[str] = ["=== TRACE DATA CONTEXT (grounded in real PVDAQ data) ===\n"]

    # 1. Commercial summary
    try:
        c = commercial_df.iloc[0]
        lines.append("── COMMERCIAL SUMMARY ──")
        lines.append(f"  Generation gap:          {_safe_float(c.get('generation_gap_kwh')):,.1f} kWh")
        lines.append(f"  Revenue gap (synthetic): ${_safe_float(c.get('total_revenue_gap_usd')):,.2f}")
        lines.append(f"  Recovery potential:      {_safe_float(c.get('recovery_potential_kwh')):,.1f} kWh")
        lines.append(f"  Recovery revenue:        ${_safe_float(c.get('recovery_revenue_potential_usd')):,.2f}")
        lines.append(f"  Generation-driven:       {_safe_float(c.get('generation_driven_pct')):,.1f}%")
        lines.append(f"  Commercial-driven:       {_safe_float(c.get('commercial_driven_pct')):,.1f}%")
        lines.append(f"  Tariff (synthetic):      ${_safe_float(c.get('tariff_usd_per_kwh')):.4f}/kWh")
        lines.append("")
    except Exception as exc:
        logger.warning("Context build — commercial: %s", exc)

    # 2. Attribution by category
    try:
        lines.append("── ATTRIBUTION BY EVIDENCE CATEGORY ──")
        agg = recurrence_summary_df.sort_values("total_observed_variance_kwh", ascending=False)
        for _, row in agg.iterrows():
            cat  = _label(row.get("primary_evidence_category", ""))
            loss = _safe_float(row.get("total_observed_variance_kwh"))
            ep   = _safe_int(row.get("episode_count"))
            freq = _safe_float(row.get("episode_frequency_pct"))
            recl = str(row.get("recurrence_class", "")).replace("_", " ").title()
            lines.append(f"  {cat}: {loss:,.1f} kWh ({ep} episodes, {freq:.1f}%) — {recl}")
        lines.append("")
    except Exception as exc:
        logger.warning("Context build — attribution: %s", exc)

    # 3. Top controllable losses (top 5)
    try:
        lines.append("── TOP CONTROLLABLE EPISODES ──")
        ctrl = (
            decision_df[
                decision_df["controllability"].isin(
                    ["POTENTIALLY_CONTROLLABLE", "CONDITIONALLY_CONTROLLABLE"]
                )
            ]
            .sort_values("observed_variance_kwh", ascending=False)
            .head(5)
        )
        for _, row in ctrl.iterrows():
            lines.append(
                f"  Ep {row.get('episode_id','?')}: "
                f"{_safe_float(row.get('observed_variance_kwh')):,.1f} kWh | "
                f"{_label(row.get('primary_evidence_category',''))} | "
                f"Conf: {row.get('attribution_confidence','?')} | "
                f"Recovery: {_safe_float(row.get('recovery_potential_kwh')):,.1f} kWh"
            )
        lines.append("")
    except Exception as exc:
        logger.warning("Context build — controllable: %s", exc)

    # 4. Recurrence
    try:
        lines.append("── RECURRENCE PATTERNS ──")
        for _, row in recurrence_summary_df.iterrows():
            cat   = _label(row.get("primary_evidence_category", ""))
            score = _safe_float(row.get("recurrence_score"))
            recl  = str(row.get("recurrence_class", "")).replace("_", " ").title()
            interp = str(row.get("recurrence_interpretation", ""))
            lines.append(f"  {cat}: score={score:.2f}, {recl}")
            lines.append(f"    → {interp}")
        lines.append("")
    except Exception as exc:
        logger.warning("Context build — recurrence: %s", exc)

    # 5. Recovery reconciliation
    try:
        if len(recovery_df) > 0:
            rec = recovery_df.iloc[0]
            lines.append("── RECOVERY RECONCILIATION ──")
            lines.append(f"  Total episode loss:    {_safe_float(rec.get('total_episode_loss_kwh')):,.1f} kWh")
            lines.append(f"  Fully recoverable:     {_safe_float(rec.get('fully_recoverable_kwh')):,.1f} kWh")
            lines.append(f"  Partially recoverable: {_safe_float(rec.get('partially_recoverable_kwh')):,.1f} kWh")
            lines.append(f"  Not recoverable:       {_safe_float(rec.get('not_recoverable_kwh')):,.1f} kWh")
            lines.append(f"  Uncertain:             {_safe_float(rec.get('uncertain_kwh')):,.1f} kWh")
            lines.append("")
    except Exception as exc:
        logger.warning("Context build — recovery: %s", exc)

    # 6. Data quality overview
    try:
        lines.append("── DATA QUALITY ──")
        total_ep = len(episode_attr_df)
        high_ep  = len(episode_attr_df[episode_attr_df["attribution_confidence"] == "HIGH"]) \
                   if "attribution_confidence" in episode_attr_df.columns else 0
        phys_rows = len(physical_expected_df)
        lines.append(f"  Episodes analysed:        {total_ep}")
        lines.append(f"  HIGH confidence episodes: {high_ep}")
        lines.append(f"  Physical observations:    {phys_rows} rows (15-min intervals)")
        lines.append(f"  Integrity report rows:    {len(integrity_df)}")
        lines.append("")
    except Exception as exc:
        logger.warning("Context build — data quality: %s", exc)

    # 7. Top financial episodes
    try:
        if len(episode_financial_df) > 0:
            lines.append("── TOP EPISODES BY FINANCIAL IMPACT ──")
            sort_col = "generation_revenue_impact_usd" if "generation_revenue_impact_usd" in episode_financial_df.columns else "revenue_gap_usd"
            top_fin = episode_financial_df.sort_values(sort_col, ascending=False).head(3)
            for _, row in top_fin.iterrows():
                rev = _safe_float(row.get("generation_revenue_impact_usd") or row.get("revenue_gap_usd"))
                gen = _safe_float(row.get("observed_variance_kwh") or row.get("generation_gap_kwh"))
                lines.append(
                    f"  Ep {row.get('episode_id','?')}: "
                    f"${rev:,.2f} revenue impact | "
                    f"{gen:,.1f} kWh generation impact"
                )
            lines.append("")
    except Exception as exc:
        logger.warning("Context build — financial: %s", exc)

    lines.append("=== END TRACE DATA CONTEXT ===")
    return "\n".join(lines)


# ── Cache context (built once per process) ────────────────────────────────
_cached_context: str | None = None

def get_trace_context() -> str:
    global _cached_context
    if _cached_context is None:
        _cached_context = build_trace_context()
    return _cached_context


def _system_prompt() -> str:
    return f"{_TRACE_IDENTITY}\n\n{get_trace_context()}"


def _require_key() -> str:
    return get_groq_api_key()


# ── Blocking chat ──────────────────────────────────────────────────────────
def chat(conversation: list[dict]) -> str:
    """
    Send a conversation to Groq and return the complete reply.
    """
    key = _require_key()
    model = get_groq_model()
    client = Groq(api_key=key)

    messages = [{"role": "system", "content": _system_prompt()}] + conversation

    try:
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=_MAX_TOKENS,
            temperature=_TEMPERATURE,
        )
        return response.choices[0].message.content
    except Exception as exc:
        # Fallback to working reference model if requested model fails
        if model != "openai/gpt-oss-120b":
            logger.warning("Primary model %s failed (%s), falling back to openai/gpt-oss-120b", model, exc)
            response = client.chat.completions.create(
                model="openai/gpt-oss-120b",
                messages=messages,
                max_tokens=_MAX_TOKENS,
                temperature=_TEMPERATURE,
            )
            return response.choices[0].message.content
        raise exc


# ── Async streaming chat ───────────────────────────────────────────────────
async def chat_stream(conversation: list[dict]) -> AsyncGenerator[str, None]:
    """
    Async generator yielding text chunks from Groq streaming.
    Used by the SSE endpoint in routers/ai.py.
    """
    key = _require_key()
    model = get_groq_model()
    client = AsyncGroq(api_key=key)

    messages = [{"role": "system", "content": _system_prompt()}] + conversation

    try:
        stream = await client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=_MAX_TOKENS,
            temperature=_TEMPERATURE,
            stream=True,
        )
    except Exception as exc:
        if model != "openai/gpt-oss-120b":
            logger.warning("Stream model %s failed (%s), falling back to openai/gpt-oss-120b", model, exc)
            stream = await client.chat.completions.create(
                model="openai/gpt-oss-120b",
                messages=messages,
                max_tokens=_MAX_TOKENS,
                temperature=_TEMPERATURE,
                stream=True,
            )
        else:
            raise exc

    async for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta
