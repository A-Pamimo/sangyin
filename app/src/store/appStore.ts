import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { ApiClient } from '../api/client';
import { DEFAULT_BACKEND_URL, DEFAULT_LANG, DEFAULT_VOICE } from '../config';
import type { ThemeName } from '../theme';

export interface Position {
  chapterId: string;
  sentenceIndex: number;
  updatedAt: number;
}

interface AppState {
  backendUrl: string;
  voice: string;
  lang: string;
  speed: number;
  themeName: ThemeName;
  /** Per-document resume position, keyed by document id. */
  positions: Record<string, Position>;

  /** UI sound effects (web-only; no-op on native). Opt-in, off by default. */
  sfxEnabled: boolean;
  /** Suppress the boot intro, marquees, parallax, and scramble animations. */
  reduceMotion: boolean;
  /**
   * Whether the boot intro has already shown this launch. Session-only (never
   * persisted), so the intro plays once per cold start and never again mid-session.
   */
  bootSeen: boolean;

  setBackendUrl: (url: string) => void;
  setVoice: (voice: string, lang?: string) => void;
  setSpeed: (speed: number) => void;
  setThemeName: (name: ThemeName) => void;
  savePosition: (docId: string, pos: Position) => void;
  setSfxEnabled: (on: boolean) => void;
  setReduceMotion: (on: boolean) => void;
  setBootSeen: (seen: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      backendUrl: DEFAULT_BACKEND_URL,
      voice: DEFAULT_VOICE,
      lang: DEFAULT_LANG,
      speed: 1,
      themeName: 'sage',
      positions: {},
      // Defaults live here (not only in partialize): a missing persisted key is
      // `undefined`, which is falsy — so the initializer is the source of truth.
      sfxEnabled: false,
      reduceMotion: false,
      bootSeen: false,

      setBackendUrl: (backendUrl) => set({ backendUrl: backendUrl.trim() }),
      setVoice: (voice, lang) => set((s) => ({ voice, lang: lang ?? s.lang })),
      setSpeed: (speed) => set({ speed }),
      setThemeName: (themeName) => set({ themeName }),
      savePosition: (docId, pos) =>
        set((s) => ({ positions: { ...s.positions, [docId]: pos } })),
      setSfxEnabled: (sfxEnabled) => set({ sfxEnabled }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      setBootSeen: (bootSeen) => set({ bootSeen }),
    }),
    {
      name: 'sangyin-app',
      version: 1,
      migrate: (persisted: any, version: number) => {
        if (version < 1) {
          // Upgrade any localhost URL to the real backend baked in at build time.
          if (!persisted.backendUrl || /localhost|127\.0\.0\.1/.test(persisted.backendUrl)) {
            persisted.backendUrl = DEFAULT_BACKEND_URL;
          }
        }
        return persisted;
      },
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        backendUrl: s.backendUrl,
        voice: s.voice,
        lang: s.lang,
        speed: s.speed,
        themeName: s.themeName,
        positions: s.positions,
        sfxEnabled: s.sfxEnabled,
        reduceMotion: s.reduceMotion,
      }),
    },
  ),
);

/** Memoized API client bound to the currently configured backend URL. */
export function useApi(): ApiClient {
  const backendUrl = useAppStore((s) => s.backendUrl);
  return useMemo(() => new ApiClient(backendUrl), [backendUrl]);
}

/**
 * True once the persisted state has finished rehydrating from AsyncStorage.
 * Gate first-frame UI on this (e.g. the boot intro) so a persisted preference
 * like `reduceMotion` isn't briefly overridden by initializer defaults.
 */
export function useHasHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useAppStore.persist.hasHydrated());
  useEffect(() => {
    // Already-hydrated (e.g. synchronous rehydrate) is covered by the initial state;
    // otherwise flip when the async rehydrate finishes.
    if (useAppStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsub = useAppStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);
  return hydrated;
}
