import { AudioPlayer, createAudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';

export interface NowPlayingMeta {
  title: string;
  artist?: string;
}

/**
 * Low-level "play one URI at a time" surface used by {@link PlaybackController}.
 * Split by platform so the web implementation can satisfy browser autoplay
 * rules, which the per-chunk expo-audio approach cannot on web.
 */
export interface AudioSink {
  /**
   * Called synchronously from inside a user gesture (the Play tap). On web this
   * "unlocks" the shared audio element so later programmatic play() calls —
   * which happen async, after TTS synthesis — are allowed. No-op on native.
   */
  unlock(): void;
  /** Load a URI and start playing it. onFinish fires when it ends naturally. */
  play(uri: string, rate: number, onFinish: () => void): void;
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

// 44-byte header-only silent WAV; playing it during a gesture activates the
// element so subsequent programmatic playback is permitted.
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

/** Web: reuse a single <audio> element, unlocked once by a user gesture. */
class WebAudioSink implements AudioSink {
  private el: HTMLAudioElement;
  private onFinish: (() => void) | null = null;
  private unlocked = false;

  constructor() {
    this.el = new Audio();
    this.el.preload = 'auto';
    this.el.addEventListener('ended', () => this.onFinish?.());
  }

  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    // Play a silent clip on the shared element while the user gesture is live.
    this.el.src = SILENT_WAV;
    this.el
      .play()
      .then(() => {
        this.el.pause();
        this.el.currentTime = 0;
      })
      .catch(() => {
        // If it still fails we're no worse off than before; allow a retry.
        this.unlocked = false;
      });
  }

  play(uri: string, rate: number, onFinish: () => void): void {
    this.onFinish = onFinish;
    this.el.src = uri;
    this.el.playbackRate = rate;
    this.el.currentTime = 0;
    this.el.play().catch(() => {});
  }

  pause(): void {
    this.el.pause();
  }

  resume(): void {
    this.el.play().catch(() => {});
  }

  setRate(rate: number): void {
    this.el.playbackRate = rate;
  }

  setLockScreen(): void {
    /* web uses the Media Session hook, not the audio element */
  }

  stop(): void {
    this.onFinish = null;
    this.el.pause();
  }

  destroy(): void {
    this.onFinish = null;
    this.el.pause();
    this.el.removeAttribute('src');
  }
}

/** Native: a fresh expo-audio player per chunk (the original behaviour). */
class NativeAudioSink implements AudioSink {
  private player: AudioPlayer | null = null;
  private sub: { remove: () => void } | null = null;
  private meta: NowPlayingMeta | null = null;

  unlock(): void {
    /* no autoplay restrictions on native */
  }

  play(uri: string, rate: number, onFinish: () => void): void {
    this.stop();
    const player = createAudioPlayer({ uri });
    this.player = player;
    try {
      player.setPlaybackRate(rate);
    } catch {
      /* some platforms clamp/limit rates; ignore */
    }
    this.sub = player.addListener('playbackStatusUpdate', (status: any) => {
      if (status?.didJustFinish) onFinish();
    });
    player.play();
    this.applyLockScreen();
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
