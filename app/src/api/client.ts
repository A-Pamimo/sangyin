import { Platform } from 'react-native';
import {
  AudioChunk,
  DocumentSummary,
  DocumentT,
  TTSRequestBody,
  Voice,
} from './types';

export class ApiError extends Error {}

export class ApiClient {
  constructor(private baseUrl: string) {}

  private url(path: string): string {
    return `${this.baseUrl.replace(/\/+$/, '')}${path}`;
  }

  async health(): Promise<{ status: string; model: string; version: string }> {
    const res = await fetch(this.url('/health'));
    if (!res.ok) throw new ApiError(`Backend not reachable (${res.status})`);
    return res.json();
  }

  async voices(): Promise<Voice[]> {
    const res = await fetch(this.url('/voices'));
    if (!res.ok) throw new ApiError(`Failed to load voices (${res.status})`);
    return res.json();
  }

  async listDocuments(): Promise<DocumentSummary[]> {
    const res = await fetch(this.url('/documents'));
    if (!res.ok) throw new ApiError(`Failed to load library (${res.status})`);
    return res.json();
  }

  async getDocument(id: string): Promise<DocumentT> {
    const res = await fetch(this.url(`/documents/${id}`));
    if (!res.ok) throw new ApiError(`Document not found (${res.status})`);
    return res.json();
  }

  async deleteDocument(id: string): Promise<boolean> {
    const res = await fetch(this.url(`/documents/${id}`), { method: 'DELETE' });
    return res.ok;
  }

  async importText(text: string, title?: string): Promise<DocumentT> {
    return this.postJson('/documents/text', { text, title });
  }

  async importUrl(url: string): Promise<DocumentT> {
    return this.postJson('/documents/url', { url });
  }

  async importFile(file: { uri: string; name: string; mimeType?: string }): Promise<DocumentT> {
    const form = new FormData();

    if (Platform.OS === 'web') {
      const response = await fetch(file.uri);
      const blob = await response.blob();
      form.append('file', blob, file.name);
    } else if (typeof file.uri === 'string' && file.uri.startsWith('blob:')) {
      const blob = await (await fetch(file.uri)).blob();
      form.append('file', blob, file.name);
    } else if (typeof file.uri === 'string' && file.uri.startsWith('file:')) {
      const response = await fetch(file.uri);
      const blob = await response.blob();
      form.append('file', blob, file.name);
    } else {
      form.append(
        'file',
        { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' } as any,
      );
    }

    const res = await fetch(this.url('/documents/file'), {
      method: 'POST',
      body: form,
    });
    if (!res.ok) throw new ApiError(await this.errorDetail(res));
    return res.json();
  }

  private async postJson(path: string, body: unknown): Promise<DocumentT> {
    const res = await fetch(this.url(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new ApiError(await this.errorDetail(res));
    return res.json();
  }

  private async errorDetail(res: Response): Promise<string> {
    try {
      const data = await res.json();
      const detail = (data as any).detail;
      if (typeof detail === 'string') return detail;
      if (detail != null) return JSON.stringify(detail);
      return `Request failed (${res.status})`;
    } catch {
      return `Request failed (${res.status})`;
    }
  }

  /**
   * Stream synthesized audio, one sentence at a time (NDJSON). Yields each
   * AudioChunk as it arrives so playback can start before the whole document is
   * synthesized. Streams incrementally on web (ReadableStream); falls back to a
   * buffered read where streaming isn't available.
   */
  async *streamTTS(body: TTSRequestBody, signal?: AbortSignal): AsyncGenerator<AudioChunk> {
    const res = await fetch(this.url('/tts/stream'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) throw new ApiError(await this.errorDetail(res));

    const reader = (res.body as any)?.getReader?.();
    if (reader) {
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (line) yield JSON.parse(line) as AudioChunk;
        }
      }
      if (buffer.trim()) yield JSON.parse(buffer.trim()) as AudioChunk;
    } else {
      // Fallback (e.g. RN without streaming fetch): read fully, then split lines.
      const text = await res.text();
      for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (trimmed) yield JSON.parse(trimmed) as AudioChunk;
      }
    }
  }
}

export function chunkToDataUri(chunk: AudioChunk): string {
  return `data:audio/wav;base64,${chunk.audio_b64}`;
}
