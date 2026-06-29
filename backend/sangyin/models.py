"""Pydantic schemas shared across parsing, storage, and the API."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

SourceType = Literal["pdf", "epub", "docx", "txt", "text", "url"]


class Sentence(BaseModel):
    index: int  # global, document-wide index (stable across chapters)
    text: str


class Chapter(BaseModel):
    id: str
    title: str
    index: int
    sentences: list[Sentence]


class Document(BaseModel):
    id: str
    title: str
    source_type: SourceType
    chapters: list[Chapter]
    created_at: str  # ISO 8601

    @property
    def n_sentences(self) -> int:
        return sum(len(c.sentences) for c in self.chapters)


class DocumentSummary(BaseModel):
    id: str
    title: str
    source_type: SourceType
    n_sentences: int
    created_at: str


class Voice(BaseModel):
    id: str
    name: str
    lang_code: str
    gender: Literal["male", "female"]


# ---- Requests ----------------------------------------------------------------


class TextImportRequest(BaseModel):
    text: str = Field(..., min_length=1)
    title: Optional[str] = None


class UrlImportRequest(BaseModel):
    url: str


class TTSRequest(BaseModel):
    """Synthesize a chapter of a stored document, or raw inline text."""

    document_id: Optional[str] = None
    chapter_id: Optional[str] = None
    text: Optional[str] = None
    voice: Optional[str] = None
    lang_code: Optional[str] = None


# ---- Streaming response chunk ------------------------------------------------


class AudioChunk(BaseModel):
    index: int
    text: str
    sample_rate: int
    duration_sec: float
    audio_b64: str
