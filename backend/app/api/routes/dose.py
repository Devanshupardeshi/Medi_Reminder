"""Dose tracking routes."""

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import get_adherence_service, get_orchestrator, get_token_payload
from app.orchestrator.engine import OrchestratorEngine
from app.orchestrator.events import Event
from app.schemas.dose import DoseLogRequest, DoseLogResponse
from app.services.adherence_service import AdherenceService

router = APIRouter(prefix="/doses", tags=["doses"])


@router.post("/log", response_model=DoseLogResponse)
async def update_dose_log(
    payload: DoseLogRequest,
    claims: dict = Depends(get_token_payload),
    service: AdherenceService = Depends(get_adherence_service),
    orchestrator: OrchestratorEngine = Depends(get_orchestrator),
) -> DoseLogResponse:
    """Update dose adherence status (JWT required; log must belong to caller)."""
    user_id = str(claims["sub"])
    context = await service.update_dose_for_user_with_context(user_id, payload.dose_log_id, payload.status, payload.taken_at)
    if not context:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dose log not found")

    # Policy: user-marked skipped/missed should also be triaged, not only worker-marked missed.
    if payload.status in {"skipped", "missed"}:
        event = Event(
            event_type="dose_missed",
            payload={
                "user_id": context["user_id"],
                "dose_log_id": context["dose_log_id"],
                "consecutive_misses": int(context.get("consecutive_misses", 1)),
            },
        )
        await orchestrator.publish(event)
    return DoseLogResponse(success=True, message="Dose log updated")
