import uuid
import aiofiles
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from app.core.config import get_settings, Settings
from app.models.job import DocumentUploadResponse, JobStatus
from app.services.job_service import create_job, get_job_status, list_recent_jobs
from app.workers.document_tasks import process_pdf, generate_thumbnail
from celery import chain

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    settings: Settings = Depends(get_settings),
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    job_id = str(uuid.uuid4())
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / f"{job_id}_{file.filename}"

    content = await file.read()
    size_bytes = len(content)
    if size_bytes > settings.max_file_size_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File exceeds {settings.max_file_size_mb}MB limit")

    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    await create_job(job_id)

    task_chain = chain(
        process_pdf.s(job_id, str(file_path), {}),
        generate_thumbnail.s(job_id, str(upload_dir)),
    )
    task_chain.apply_async()

    return DocumentUploadResponse(
        job_id=job_id,
        filename=file.filename,
        size_bytes=size_bytes,
        message="Document queued for processing",
    )


@router.get("/jobs/{job_id}", response_model=JobStatus)
async def get_job(job_id: str):
    status = await get_job_status(job_id)
    if not status:
        raise HTTPException(status_code=404, detail="Job not found")
    return status


@router.get("/jobs", response_model=list[str])
async def list_jobs(limit: int = 20):
    return await list_recent_jobs(limit)
