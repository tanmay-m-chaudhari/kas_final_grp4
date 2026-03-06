from datetime import datetime
from typing import Optional
from app.core.redis_client import get_redis
from app.models.job import JobStatus

JOB_TTL = 86400


async def create_job(job_id: str) -> JobStatus:
    redis = await get_redis()
    status = JobStatus(job_id=job_id, status="pending")
    await redis.setex(f"job:{job_id}", JOB_TTL, status.model_dump_json())
    return status


async def get_job_status(job_id: str) -> Optional[JobStatus]:
    redis = await get_redis()
    raw = await redis.get(f"job:{job_id}")
    if not raw:
        return None
    return JobStatus.model_validate_json(raw)


async def update_job_status(
    job_id: str,
    status: str,
    progress: int = 0,
    result: dict = None,
    error: str = None,
):
    redis = await get_redis()
    existing_raw = await redis.get(f"job:{job_id}")
    if not existing_raw:
        return
    job = JobStatus.model_validate_json(existing_raw)
    job.status = status
    job.progress = progress
    job.result = result
    job.error = error
    job.updated_at = datetime.utcnow()
    await redis.setex(f"job:{job_id}", JOB_TTL, job.model_dump_json())


async def list_recent_jobs(limit: int = 20) -> list[str]:
    redis = await get_redis()
    keys = await redis.keys("job:*")
    return [k.replace("job:", "") for k in keys[:limit]]
