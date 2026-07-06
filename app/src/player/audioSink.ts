import { AudioPlayer, createAudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';

export interface NowPlayingMeta {
  title: string;
  artist?: string;
}

export interface PlayHandlers {
  /** Fires repeatedly with the current playback position (seconds) of the clip. */
  onProgress?: (seconds: number) => void;
  /** Fires once when the clip finishes playing naturally. */
  onFinish?: () => void;
}

/**
 * Low-level "play one clip at a time" surface used by {@link PlaybackController}.
 * Split by platform so the web implementation can (a) satisfy browser autoplay rules
 * and (b) play consecutive phrase clips back-to-back with no audible gap.
 */
export interface AudioSink {
  /**
   * Called synchronously from inside a user gesture (the Play tap). On web this
   * "unlocks" the audio elements so later programmatic play() calls — which happen
   * async, after synthesis — are allowed. No-op on native.
   */
  unlock(): void;
  /** Load a URI and start playing, optionally from an offset (seconds). */
  play(uri: string, rate: number, handlers: PlayHandlers, startAtSec?: number): void;
  /** Hint the next clip's URI so it can be buffered for a gapless transition. */
  preload(uri: string): void;
  pause(): void;
  resume(): void;
  setRate(rate: number): void;
  /** Native lock-screen "now playing" info; no-op on web (uses Media Session). */
  setLockScreen(meta: NowPlayingMeta | null): void;
  /** Stop and release the current source, but keep the sink reusable. */
  stop(): void;
  /** Tear down entirely. */
  destroy(): void;
}

// 44-byte header-only silent WAV; playing it during a gesture activates an element so
// subsequent programmatic playback on it is permitted.
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

/**
 * Web: two <audio> elements double-buffered. While one plays, the next phrase is
 * preloaded into the other; on transition we switch to the already-buffered element,
 * so there's no load gap between phrases. Both are unlocked in the Play gesture.
 */
class WebAudioSink implements AudioSink {
  private els: HTMLAudioElement[];
  private cur: HTMLAudioElement;
  private spare: HTMLAudioElement;
  private preloadedUri: string | null = null;
  private unlocked = false;
  private handlers: PlayHandlers = {};
  // Bound listeners for the current element, so we can detach cleanly on switch.
  private onTime: (() => void) | null = null;
  private onEnd: (() => void) | null = null;

  constructor() {
    this.els = [new Audio(), new Audio()];
    for (const el of this.els) el.preload = 'auto';
    this.cur = this.els[0];
    this.spare = this.els[1];
  }

  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    // Activate BOTH elements during the gesture — playback alternates between them.
    for (const el of this.els) {
      el.src = SILENT_WAV;
      el
        .play()
        .then(() => {
          el.pause();
          el.currentTime = 0;
          el.removeAttribute('src');
        })
        .catch(() => {
          this.unlocked = false;
        });
    }
  }

  private detach(el: HTMLAudioElement): void {
    if (el === this.cur) {
      if (this.onTime) el.removeEventListener('timeupdate', this.onTime);
      if (this.onEnd) el.removeEventListener('ended', this.onEnd);
      this.onTime = null;
      this.onEnd = null;
    }
  }

  play(uri: string, rate: number, handlers: PlayHandlers, startAtSec = 0): void {
    this.detach(this.cur);
    this.handlers = handlers;

    // If the next phrase was preloaded into the spare element, switch to it (already
    // buffered) instead of reloading on the current one — this is what makes it gapless.
    if (this.preloadedUri === uri) {
      const t = this.cur;
      this.cur = this.spare;
      this.spare = t;
      this.spare.pause();
    } else if ((this.cur.currentSrc || this.cur.src) !== uri) {
      this.cur.src = uri;
    }
    this.preloadedUri = null;

    const el = this.cur;
    el.playbackRate = rate;
    try {
      el.currentTime = startAtSec;
    } catch {
      /* currentTime may not be settable until metadata loads; ignore */
    }
    this.onTime = () => this.handlers.onProgress?.(el.currentTime);
    this.onEnd = () => this.handlers.onFinish?.();
    el.addEventListener('timeupdate', this.onTime);
    el.addEventListener('ended', this.onEnd);
    el.play().catch(() => {});
  }

  preload(uri: string): void {
    if (this.preloadedUri === uri) return;
    this.preloadedUri = uri;
    this.spare.src = uri;
    this.spare.load();
  }

  pause(): void {
    this.cur.pause();
  }

  resume(): void {
    this.cur.play().catch(() => {});
  }

  setRate(rate: number): void {
    this.cur.playbackRate = rate;
  }

  setLockScreen(): void {
    /* web uses the Media Session hook, not the audio element */
  }

  stop(): void {
    this.detach(this.cur);
    this.handlers = {};
    for (const el of this.els) el.pause();
    this.preloadedUri = null;
  }

  destroy(): void {
    this.stop();
    for (const el of this.els) el.removeAttribute('src');
  }
}

/** Native: a fresh expo-audio player per phrase. Grouping already cuts the gaps. */
class NativeAudioSink implements AudioSink {
  private player: AudioPlayer | null = null;
  private sub: { remove: () => void } | null = null;
  private meta: NowPlayingMeta | null = null;

  unlock(): void {
    /* no autoplay restrictions on native */
  }

  play(uri: string, rate: number, handlers: PlayHandlers, startAtSec = 0): void {
    this.stop();
    const player = createAudioPlayer({ uri });
    this.player = player;
    try {
      player.setPlaybackRate(rate);
    } catch {
      /* some platforms clamp/limit rates; ignore */
    }
    if (startAtSec > 0) {
      try {
        player.seekTo(startAtSec);
      } catch {
        /* ignore */
      }
    }
    this.sub = player.addListener('playbackStatusUpdate', (status: any) => {
      if (typeof status?.currentTime === 'number') handlers.onProgress?.(status.currentTime);
      if (status?.didJustFinish) handlers.onFinish?.();
    });
    player.play();
    this.applyLockScreen();
  }

  preload(): void {
    /* expo-audio has no cheap preload handle; grouping already reduces gaps */
  }

  private applyLockScreen(): void {
    if (!this.player || !this.meta) return;
    try {
      // SDK 57 API; cast keeps it compiling against older installed types.
      (this.player as any).setActiveForLockScreen(true, {
        title: this.meta.title,
        artist: this.meta.artist ?? 'Sangyin',
        albumTitle: 'Sangyin',
      });
    } catch {
      // Older runtimes without lock-screen support — background audio still works.
    }
  }

  pause(): void {
    this.player?.pause();
  }

  resume(): void {
    this.player?.play();
  }

  setRate(rate: number): void {
    try {
      this.player?.setPlaybackRate(rate);
    } catch {
      /* ignore */
    }
  }

  setLockScreen(meta: NowPlayingMeta | null): void {
    this.meta = meta;
    this.applyLockScreen();
  }

  stop(): void {
    if (this.sub) {
      this.sub.remove();
      this.sub = null;
    }
    if (this.player) {
      try {
        this.player.remove();
      } catch {
        /* ignore */
      }
      this.player = null;
    }
  }

  destroy(): void {
    this.stop();
  }
}

export function createAudioSink(): AudioSink {
  return Platform.OS === 'web' ? new WebAudioSink() : new NativeAudioSink();
}
