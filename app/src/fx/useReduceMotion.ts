import { useAppStore } from '../store/appStore';

/** The in-app "reduce motion" preference (Settings → Sound & Motion). */
export function useReduceMotion(): boolean {
  return useAppStore((s) => s.reduceMotion);
}
