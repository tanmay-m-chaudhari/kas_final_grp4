from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


class JobStatus(BaseModel):
    job_id: str
    status: Literal["pending", "started", "success", "failure", "retry"]
    progress: int = Field(ge=0, le=100, default=0)
    result: Optional[dict] = None
    error: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class DocumentUploadResponse(BaseModel):
    job_id: str
    filename: str
    size_bytes: int
    message: str


class DocumentProcessResult(BaseModel):
    job_id: str
    filename: str
    page_count: Optional[int] = None
    word_count: Optional[int] = None
    extracted_text_preview: Optional[str] = None
    metadata: dict = {}
