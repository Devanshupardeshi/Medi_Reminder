"""Stateful check-in agent."""

from typing import Any

from app.agents.base import Agent


class CheckinAgent(Agent):
    """Generate patient check-ins after non-adherence."""

    async def run(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Return check-in recommendation with state-sensitive logic."""
        consecutive_misses = int(payload.get("consecutive_misses", 0))
        risk = "high" if consecutive_misses >= 3 else "medium" if consecutive_misses >= 2 else "low"
        return {
            "status": "ok",
            "risk_level": risk,
            "message": "We noticed missed doses. Are you facing side-effects or schedule issues?",
            "confidence": 0.82,
        }
