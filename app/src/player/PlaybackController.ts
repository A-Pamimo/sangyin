import { AudioSink, createAudioSink, NowPlayingMeta } from './audioSink';

export type { NowPlayingMeta };

/** One sentence's slice within a phrase clip (for highlight sync). */
export interface ChunkSentenceSpan {
  index: number;
  offsetSec: number;
  durationSec: number;
}

export interface PlayChunk {
  /** The phrase's first sentence index (ordering / identity). */
  index: number;
  /** Playable source: a data: URI (web/stream) or a file:// URI (offline cache). */
  uri: string;
  duration: number;
  /** Per-sentence spans within this clip, in playback order. */
  sentences: ChunkSentenceSpan[];
}

export interface PlayerSnapshot {
  playing: boolean;
  /** Sentence index currently being spoken, or -1. */
  currentIndex: number;
  loadedCount: number;
  finished: boolean;
  buffering: boolean;
}

/**
 * Plays an ordered list of phrase clips back-to-back, advancing on each clip's
 * completion. Clips can be appended while playback is underway (streaming): if
 * playback catches up to the last loaded clip it buffers and resumes when the next
 * arrives. The active *sentence* highlight is driven by playback position within the
 * current phrase (each clip carries per-sentence offsets).
 */
export class PlaybackController {
  private chunks: PlayChunk[] = [];
  private pos = 0; // index into `chunks`, not the sentence index
  private sink: AudioSink | null = null;
  private active = false; // is a clip currently loaded in the sink?
  private activeSentence = -1;
  private rate = 1;
  private wantPlay = false;
  private buffering = false;
  private finishedStreaming = false;
  private meta: NowPlayingMeta | null = null;

  onChange: (s: PlayerSnapshot) => void = () => {};

  /** Set what the native lock screen shows while this controller plays. */
  setNowPlaying(meta: NowPlayingMeta): void {
    this.meta = meta;
    this.sink?.setLockScreen(meta);
  }

  // ---- lifecycle ----------------------------------------------------------

  private ensureSink(): AudioSink {
    if (!this.sink) {
      this.sink = createAudioSink();
      if (this.meta) this.sink.setLockScreen(this.meta);
    }
    return this.sink;
  }

  reset(): void {
    this.sink?.stop();
    this.active = false;
    this.activeSentence = -1;
    this.chunks = [];
    this.pos = 0;
    this.wantPlay = false;
    this.buffering = false;
    this.finishedStreaming = false;
    this.emit();
  }

  destroy(): void {
    this.sink?.destroy();
    this.sink = null;
    this.active = false;
  }

  // ---- streaming feed -----------------------------------------------------

  addChunk(chunk: PlayChunk): void {
    const wasEmpty = this.chunks.length === 0;
    this.chunks.push(chunk);
    // Start as soon as the first clip lands if the user already pressed play.
    if (wasEmpty && this.wantPlay) {
      this.playAt(0);
    } else if (this.buffering && this.wantPlay) {
      // We ran out of audio mid-stream; resume with the freshly arrived clip.
      this.buffering = false;
      this.playAt(this.pos + 1);
    } else {
      // If this is the phrase right after the one playing, buffer it for a
      // gapless transition.
      if (this.active && this.chunks.length === this.pos + 2) {
        this.sink?.preload(chunk.uri);
      }
      this.emit();
    }
  }

  markStreamComplete(): void {
    this.finishedStreaming = true;
    this.emit();
  }

  // ---- transport ----------------------------------------------------------

  play(): void {
    this.wantPlay = true;
    // Runs inside the Play-button gesture: unlock web audio now so the async
    // playAt() (after synthesis) is allowed to start playback.
    this.ensureSink().unlock();
    if (!this.active && this.chunks.length > 0) {
      this.playAt(this.pos);
    } else if (this.active) {
      this.sink!.resume();
      this.emit();
    } else {
      this.emit();
    }
  }

  pause(): void {
    this.wantPlay = false;
    this.sink?.pause();
    this.emit();
  }

  toggle(): void {
    if (this.wantPlay) this.pause();
    else this.play();
  }

  next(): void {
    if (this.pos < this.chunks.length - 1) this.playAt(this.pos + 1);
  }

  prev(): void {
    this.playAt(this.pos > 0 ? this.pos - 1 : 0);
  }

  /** Seek to a loaded sentence by its index (tap-to-play within buffered audio). */
  seekToSentence(sentenceIndex: number): void {
    const i = this.chunks.findIndex((c) => c.sentences.some((s) => s.index === sentenceIndex));
    if (i < 0) return;
    const span = this.chunks[i].sentences.find((s) => s.index === sentenceIndex);
    this.playAt(i, span?.offsetSec ?? 0);
  }

  setRate(rate: number): void {
    this.rate = rate;
    if (this.active) this.sink?.setRate(rate);
  }

  // ---- internals ----------------------------------------------------------

  private playAt(i: number, startAtSec = 0): void {
    if (i < 0 || i >= this.chunks.length) return;
    this.pos = i;
    this.wantPlay = true;
    this.buffering = false;
    this.active = true;

    const chunk = this.chunks[i];
    this.activeSentence = this.sentenceAt(chunk, startAtSec);
    this.ensureSink().play(
      chunk.uri,
      this.rate,
      {
        onProgress: (t) => this.onProgress(t),
        onFinish: () => this.onChunkFinished(),
      },
      startAtSec,
    );
    // Buffer the next phrase (if already streamed) for a gapless hand-off.
    const nextChunk = this.chunks[i + 1];
    if (nextChunk) this.sink?.preload(nextChunk.uri);
    this.emit();
  }

  /** Which sentence index is being spoken at time `t` within a phrase clip. */
  private sentenceAt(chunk: PlayChunk, t: number): number {
    const spans = chunk.sentences;
    if (spans.length === 0) return chunk.index;
    for (const s of spans) {
      if (t < s.offsetSec + s.durationSec) return s.index;
    }
    return spans[spans.length - 1].index;
  }

  private onProgress(t: number): void {
    const chunk = this.chunks[this.pos];
    if (!chunk) return;
    const idx = this.sentenceAt(chunk, t);
    if (idx !== this.activeSentence) {
      this.activeSentence = idx;
      this.emit();
    }
  }

  private onChunkFinished(): void {
    if (this.pos < this.chunks.length - 1) {
      this.playAt(this.pos + 1);
    } else if (this.finishedStreaming) {
      this.wantPlay = false;
      this.sink?.stop();
      this.active = false;
      this.emit(true);
    } else {
      // Caught up to the stream; wait for the next clip.
      this.buffering = true;
      this.emit();
    }
  }

  private emit(finished = false): void {
    this.onChange({
      playing: this.wantPlay,
      currentIndex: this.activeSentence,
      loadedCount: this.chunks.length,
      finished,
      buffering: this.buffering,
    });
  }
}
