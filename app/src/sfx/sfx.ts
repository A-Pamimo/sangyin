// Tactile UI sound effects — a light "retro computer" layer.
//
// Web only: short synthesized blips via a single lazily-created Web Audio
// AudioContext (no audio assets). On native this is a hard no-op.
//
// This module intentionally NEVER touches expo-audio, setAudioModeAsync, or the
// TTS <audio> elements in player/audioSink.ts. On web the blips play through a
// separate AudioContext output path and we never call createMediaElementSource,
// so UI sound cannot capture, route, or disturb narration.
//
// Follows the same "branch on Platform.OS inside one file" convention as
// player/audioSink.ts (rather than a .web/.native extension split), which keeps
// `tsc --noEmit` resolving cleanly.
import { Platform } from 'react-native';

export type Blip = 'tap' | 'toggle' | 'confirm' | 'back';

export interface Sfx {
  /** Call once from inside a user gesture to satisfy browser autoplay rules. */
  unlock(): void;
  /** Play a short blip (no-op when disabled or on native). */
  play(blip: Blip): void;
  /** Enable/disable at runtime (bound to the `sfxEnabled` store flag). */
  setEnabled(on: boolean): void;
}

// Blip voicing: [frequency Hz, duration sec, waveform]. Kept short + quiet.
const VOICE: Record<Blip, [number, number, OscillatorType]> = {
  tap: [660, 0.045, 'sine'],
  toggle: [520, 0.05, 'triangle'],
  confirm: [784, 0.07, 'sine'],
  back: [392, 0.055, 'triangle'],
};

const PEAK_GAIN = 0.05; // ceiling — deliberately faint
const ATTACK = 0.004; // 4ms fade-in avoids a click

function createWebSfx(): Sfx {
  // A getter for the singleton AudioContext. Chrome caps live contexts (~6), so we
  // create exactly one, lazily, and reuse it for every blip.
  const AC: typeof AudioContext | undefined =
    typeof window !== 'undefined'
      ? (window.AudioContext ?? (window as any).webkitAudioContext)
      : undefined;

  let ctx: AudioContext | null = null;
  let enabled = false;

  const ensureCtx = (): AudioContext | null => {
    if (!AC) return null;
    if (!ctx) {
      try {
        ctx = new AC();
      } catch {
        return null;
      }
    }
    // Autoplay policy can leave a context "suspended" until a gesture; nudge it.
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  };

  return {
    unlock() {
      if (!enabled) return; // don't spin up audio hardware until the user opts in
      ensureCtx();
    },
    setEnabled(on: boolean) {
      enabled = on;
    },
    play(blip: Blip) {
      if (!enabled) return;
      const c = ensureCtx();
      if (!c || c.state !== 'running') return;
      const [freq, dur, type] = VOICE[blip];
      const t0 = c.currentTime;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(PEAK_GAIN, t0 + ATTACK);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(c.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
      // Let the nodes GC after they finish; disconnect defensively.
      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {
          /* already gone */
        }
      };
    },
  };
}

const noop: Sfx = { unlock() {}, play() {}, setEnabled() {} };

export const sfx: Sfx = Platform.OS === 'web' ? createWebSfx() : noop;
