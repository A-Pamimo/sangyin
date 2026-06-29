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

export interface AudioChunk {
  index: number;
  text: string;
  sample_rate: number;
  duration_sec: number;
  audio_b64: string;
}

export interface TTSRequestBody {
  document_id?: string;
  chapter_id?: string;
  text?: string;
  voice?: string;
  lang_code?: string;
}
