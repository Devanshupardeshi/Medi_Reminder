"""Dose tracking schemas."""

from datetime import datetime
from pydantic import BaseModel, Field


class DoseLogRequest(BaseModel):
    """Update dose status payload."""

    dose_log_id: str = Field(min_length=8)
    status: str = Field(pattern="^(taken|missed|skipped)$")
    taken_at: datetime | None = None


class DoseLogResponse(BaseModel):
    """Dose log response."""

    success: bool
    message: str


class MissedDoseSummary(BaseModel):
    """Missed dose analytics."""

    user_id: str
    missed_count: int
    last_missed_at: datetime | None = None
