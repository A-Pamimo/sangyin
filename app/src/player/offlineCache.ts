import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { chunkToDataUri } from '../api/client';
import { AudioChunk } from '../api/types';

export interface CacheCtx {
  docId: string;
  chapterId: string;
  voice: string;
}

function cacheDir(): Directory {
  return new Directory(Paths.cache, 'sangyin-audio');
}

function chunkFile(ctx: CacheCtx, index: number): File {
  return new File(cacheDir(), `${ctx.docId}_${ctx.chapterId}_${ctx.voice}_${index}.wav`);
}

/**
 * Turn a streamed AudioChunk into a playable URI. On native we persist it to the
 * cache directory (so it survives for offline replay) and return a file:// URI;
 * on web we just return an in-memory data: URI.
 */
export async function materialize(chunk: AudioChunk, ctx?: CacheCtx): Promise<string> {
  if (Platform.OS === 'web' || !ctx) {
    return chunkToDataUri(chunk);
  }
  try {
    cacheDir().create({ intermediates: true, idempotent: true });
    const file = chunkFile(ctx, chunk.index);
    file.write(chunk.audio_b64, { encoding: 'base64' });
    return file.uri;
  } catch {
    // Cache write failed (storage full, etc.) — fall back to in-memory playback.
    return chunkToDataUri(chunk);
  }
}

/** Return a cached file URI for a sentence, or null if not present (native only). */
export async function cachedUri(ctx: CacheCtx, index: number): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    const file = chunkFile(ctx, index);
    return file.exists ? file.uri : null;
  } catch {
    return null;
  }
}
