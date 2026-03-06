import hashlib
from pathlib import Path
from celery import shared_task
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)


@shared_task(
    bind=True,
    name="app.workers.document_tasks.process_pdf",
    max_retries=3,
    default_retry_delay=10,
    autoretry_for=(Exception,),
    retry_backoff=True,
)
def process_pdf(self, job_id: str, file_path: str, options: dict) -> dict:
    import PyPDF2

    self.update_state(state="STARTED", meta={"progress": 10, "job_id": job_id})

    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    with open(path, "rb") as f:
        reader = PyPDF2.PdfReader(f)
        page_count = len(reader.pages)

        self.update_state(state="STARTED", meta={"progress": 40, "job_id": job_id})

        text_chunks = []
        for i, page in enumerate(reader.pages):
            text_chunks.append(page.extract_text() or "")
            if i % 10 == 0:
                progress = 40 + int((i / page_count) * 40)
                self.update_state(state="STARTED", meta={"progress": progress, "job_id": job_id})

        full_text = "\n".join(text_chunks)
        word_count = len(full_text.split())
        file_hash = hashlib.sha256(path.read_bytes()).hexdigest()

    self.update_state(state="STARTED", meta={"progress": 90, "job_id": job_id})

    return {
        "job_id": job_id,
        "filename": path.name,
        "page_count": page_count,
        "word_count": word_count,
        "extracted_text_preview": full_text[:500],
        "metadata": {
            "file_hash": file_hash,
            "file_size_bytes": path.stat().st_size,
            "options": options,
        },
    }


@shared_task(
    bind=True,
    name="app.workers.document_tasks.generate_thumbnail",
    max_retries=2,
    default_retry_delay=5,
)
def generate_thumbnail(self, previous_result: dict, job_id: str, output_dir: str) -> dict:
    from PIL import Image

    self.update_state(state="STARTED", meta={"progress": 20, "job_id": job_id})

    output_path = Path(output_dir) / f"{job_id}_thumb.png"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    img = Image.new("RGB", (200, 280), color=(240, 240, 240))
    img.save(str(output_path), "PNG")

    return {**previous_result, "thumbnail_path": str(output_path)}
