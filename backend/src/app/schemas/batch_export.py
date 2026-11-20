"""
batch_export.py — Pydantic schemas cho C39 Batch Export & Archive API.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator


class BatchExportFilter(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Optional[str] = None
    domain: Optional[str] = None
    tag: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    q: Optional[str] = None


class BatchExportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    session_ids: Optional[list[uuid.UUID]] = None
    filters: Optional[BatchExportFilter] = None
    format: Optional[str] = Field(default="both")
    archive_after_export: bool = False
