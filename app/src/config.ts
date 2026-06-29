// Default backend URL. Overridable at runtime in the Settings screen (persisted),
// or at build time via EXPO_PUBLIC_BACKEND_URL.
import Constants from 'expo-constants';

export const DEFAULT_BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  (Constants.expoConfig?.extra?.backendUrl as string | undefined) ||
  'http://localhost:8000';

export const DEFAULT_VOICE = 'af_heart';
export const DEFAULT_LANG = 'a';
