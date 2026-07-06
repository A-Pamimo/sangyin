"""Document import + library endpoints.

Import is split by source so each path stays a clean, well-typed endpoint:
  - POST /documents/text  (pasted text)
  - POST /documents/url   (article URL)
  - POST /documents/file  (pdf / epub / docx / txt upload)
Library/read/delete operate on stored documents.
"""

from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response

from ..config import get_settings
from ..models import Document, DocumentSummary, TextImportRequest, UrlImportRequest
from ..parsing import parse_text, parse_upload, parse_url
from ..storage import get_store

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("", response_model=list[DocumentSummary])
def list_documents() -> list[DocumentSummary]:
    return get_store().list()


@router.get("/{doc_id}", response_model=Document)
def get_document(doc_id: str) -> Document:
    doc = get_store().get(doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.delete("/{doc_id}")
def delete_document(doc_id: str) -> dict:
    if not get_store().delete(doc_id):
        raise HTTPException(status_code=404, detail="Document not found")
    return {"status": "deleted", "id": doc_id}


@router.post("/text", response_model=Document)
def import_text(req: TextImportRequest) -> Document:
    doc = parse_text(req.text, req.title)
    get_store().save(doc)
    return doc


@router.post("/url", response_model=Document)
def import_url(req: UrlImportRequest) -> Document:
    try:
        doc = parse_url(req.url)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    get_store().save(doc)
    return doc


@router.post("/file", response_model=Document)
async def import_file(file: UploadFile = File(...)) -> Document:
    content = await file.read()
    max_bytes = get_settings().max_upload_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File too large (limit {get_settings().max_upload_mb} MB)",
        )
    try:
        doc = parse_upload(file.filename or "upload", content)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    store = get_store()
    # Keep the original PDF so the reader can show it alongside the narrated text.
    if doc.source_type == "pdf":
        store.save_original_pdf(doc.id, content)
        doc.has_pdf = True
    store.save(doc)
    return doc


@router.get("/{doc_id}/file")
def get_document_file(doc_id: str) -> Response:
    """Serve the stored original file (PDF) for the reader's PDF view."""
    data = get_store().read_original_pdf(doc_id)
    if data is None:
        raise HTTPException(status_code=404, detail="No original file for this document")
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": "inline"},
    )
