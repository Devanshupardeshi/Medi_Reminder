"""Clinical triage agent for escalation decisions."""

from typing import Any

from app.agents.base import Agent


class TriageAgent(Agent):
    """Classify risk and decide caregiver escalation."""

    async def run(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Return escalation decision."""
        risk_level = payload.get("risk_level", "low")
        escalate = risk_level == "high"
        return {
            "status": "ok",
            "escalate": escalate,
            "severity": "critical" if escalate else "warning",
            "confidence": 0.88 if escalate else 0.76,
        }
