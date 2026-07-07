// Mirrors the backend pydantic schemas (sangyin/models.py).

export type SourceType = 'pdf' | 'epub' | 'docx' | 'txt' | 'text' | 'url';

export interface Sentence {
  index: number;
  text: string;
}

export interface Chapter {
  id: string;
  title: string;
  index: number;
  sentences: Sentence[];
}

export interface DocumentT {
  id: string;
  title: string;
  source_type: SourceType;
  chapters: Chapter[];
  created_at: string;
  /** True when the original PDF is stored and can be shown in the reader's PDF view. */
  has_pdf?: boolean;
  /** Background OCR state for scanned PDFs: none | pending | done | failed | unavailable. */
  ocr_status?: 'none' | 'pending' | 'done' | 'failed' | 'unavailable';
}

export interface DocumentSummary {
  id: string;
  title: string;
  source_type: SourceType;
  n_sentences: number;
  created_at: string;
}

export interface Voice {
  id: string;
  name: string;
  lang_code: string;
  gender: 'male' | 'female';
}

/** One sentence's slice of a phrase clip, used to move the highlight in sync. */
export interface ChunkSentence {
  index: number;
  text: string;
  /** Start of this sentence within the phrase audio, in seconds. */
  offset_sec: number;
  duration_sec: number;
}

/**
 * A synthesized *phrase* — a short group of consecutive sentences rendered as one
 * natural-sounding clip. `index` is the phrase's first sentence index (ordering /
 * cache key); `sentences` carries per-sentence offsets for highlighting.
 */
export interface AudioChunk {
  index: number;
  sentences: ChunkSentence[];
  sample_rate: number;
  duration_sec: number;
  audio_b64: string;
}

/** A sentence's location on the PDF: its page and per-line rects (normalized 0-1). */
export interface PdfHighlight {
  page: number;
  rects: number[][];
}

export interface TTSRequestBody {
  document_id?: string;
  chapter_id?: string;
  text?: string;
  voice?: string;
  lang_code?: string;
  /** Resume: skip sentences whose global index is below this value. */
  start_index?: number;
}
