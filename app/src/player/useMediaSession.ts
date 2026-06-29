import { useEffect } from 'react';
import { Platform } from 'react-native';

import { PlaybackController, PlayerSnapshot } from './PlaybackController';

interface MediaMeta {
  title: string;
  /** Text of the sentence currently playing (shown as the subtitle/artist line). */
  nowPlaying?: string;
}

/**
 * Wires the OS Media Session (lock screen / notification / hardware media keys) to the
 * player on web and mobile browsers. No-op on native — expo-audio does not expose
 * now-playing metadata or remote-command handling (see app/README.md).
 */
export function useMediaSession(
  controller: PlaybackController,
  state: PlayerSnapshot,
  meta: MediaMeta,
): void {
  const supported =
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    'mediaSession' in navigator;

  // Register transport action handlers once.
  useEffect(() => {
    if (!supported) return;
    const ms = navigator.mediaSession;
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => controller.play()],
      ['pause', () => controller.pause()],
      ['previoustrack', () => controller.prev()],
      ['nexttrack', () => controller.next()],
    ];
    for (const [action, handler] of handlers) {
      try {
        ms.setActionHandler(action, handler);
      } catch {
        /* unsupported action on this browser */
      }
    }
    return () => {
      for (const [action] of handlers) {
        try {
          ms.setActionHandler(action, null);
        } catch {
          /* ignore */
        }
      }
    };
  }, [supported, controller]);

  // Keep playback state in sync (drives the play/pause glyph on the lock screen).
  useEffect(() => {
    if (!supported) return;
    navigator.mediaSession.playbackState = state.playing ? 'playing' : 'paused';
  }, [supported, state.playing]);

  // Update now-playing metadata as the active sentence changes.
  useEffect(() => {
    if (!supported || typeof MediaMetadata === 'undefined') return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: meta.title,
      artist: meta.nowPlaying || 'Sangyin',
      album: 'Sangyin',
      artwork: [{ src: '/assets/icon.png', sizes: '512x512', type: 'image/png' }],
    });
  }, [supported, meta.title, meta.nowPlaying]);
}
