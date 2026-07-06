import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMemo } from 'react';
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

  setBackendUrl: (url: string) => void;
  setVoice: (voice: string, lang?: string) => void;
  setSpeed: (speed: number) => void;
  setThemeName: (name: ThemeName) => void;
  savePosition: (docId: string, pos: Position) => void;
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

      setBackendUrl: (backendUrl) => set({ backendUrl: backendUrl.trim() }),
      setVoice: (voice, lang) => set((s) => ({ voice, lang: lang ?? s.lang })),
      setSpeed: (speed) => set({ speed }),
      setThemeName: (themeName) => set({ themeName }),
      savePosition: (docId, pos) =>
        set((s) => ({ positions: { ...s.positions, [docId]: pos } })),
    }),
    {
      name: 'sangyin-app',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        backendUrl: s.backendUrl,
        voice: s.voice,
        lang: s.lang,
        speed: s.speed,
        themeName: s.themeName,
        positions: s.positions,
      }),
    },
  ),
);

/** Memoized API client bound to the currently configured backend URL. */
export function useApi(): ApiClient {
  const backendUrl = useAppStore((s) => s.backendUrl);
  return useMemo(() => new ApiClient(backendUrl), [backendUrl]);
}
