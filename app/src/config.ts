// Default backend URL. Overridable at runtime in the Settings screen (persisted),
// or at build time via EXPO_PUBLIC_BACKEND_URL.
import Constants from 'expo-constants';

export const DEFAULT_BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  (Constants.expoConfig?.extra?.backendUrl as string | undefined) ||
  'http://localhost:8000';

export const DEFAULT_VOICE = 'af_heart';
export const DEFAULT_LANG = 'a';
// The one opt-in natural (GPU) voice. Selecting it makes playback prepare-first:
// the app caches the chapter once, then plays from cache — no live GPU streaming.
export const NATURAL_VOICE_ID = 'natural';
