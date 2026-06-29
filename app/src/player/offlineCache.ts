import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

import { chunkToDataUri } from '../api/client';
import { AudioChunk } from '../api/types';

export interface CacheCtx {
  docId: string;
  chapterId: string;
  voice: string;
}

const baseDir = FileSystem.cacheDirectory ? `${FileSystem.cacheDirectory}sangyin-audio/` : null;

function chunkPath(ctx: CacheCtx, index: number): string {
  return `${baseDir}${ctx.docId}_${ctx.chapterId}_${ctx.voice}_${index}.wav`;
}

async function ensureDir(): Promise<void> {
  if (baseDir) {
    await FileSystem.makeDirectoryAsync(baseDir, { intermediates: true }).catch(() => {});
  }
}

/**
 * Turn a streamed AudioChunk into a playable URI. On native we persist it to the
 * cache directory (so it survives for offline replay) and return a file:// URI;
 * on web we just return an in-memory data: URI.
 */
export async function materialize(chunk: AudioChunk, ctx?: CacheCtx): Promise<string> {
  if (Platform.OS === 'web' || !baseDir || !ctx) {
    return chunkToDataUri(chunk);
  }
  await ensureDir();
  const path = chunkPath(ctx, chunk.index);
  await FileSystem.writeAsStringAsync(path, chunk.audio_b64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return path;
}

/** Return a cached file URI for a sentence, or null if not present (native only). */
export async function cachedUri(ctx: CacheCtx, index: number): Promise<string | null> {
  if (Platform.OS === 'web' || !baseDir) return null;
  const path = chunkPath(ctx, index);
  const info = await FileSystem.getInfoAsync(path);
  return info.exists ? path : null;
}
