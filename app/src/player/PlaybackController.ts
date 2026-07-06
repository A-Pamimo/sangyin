import { AudioSink, createAudioSink, NowPlayingMeta } from './audioSink';

export type { NowPlayingMeta };

export interface PlayChunk {
  /** Sentence index from the parsed document (used for highlighting). */
  index: number;
  text: string;
  /** Playable source: a data: URI (web/stream) or a file:// URI (offline cache). */
  uri: string;
  duration: number;
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
 * Plays an ordered list of per-sentence audio chunks back-to-back, advancing on
 * each chunk's completion. Chunks can be appended while playback is underway
 * (streaming): if playback catches up to the last loaded chunk it buffers and
 * resumes automatically when the next one arrives.
 */
export class PlaybackController {
  private chunks: PlayChunk[] = [];
  private pos = 0; // index into `chunks`, not the sentence index
  private sink: AudioSink | null = null;
  private active = false; // is a chunk currently loaded in the sink?
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
    // Start as soon as the first chunk lands if the user already pressed play.
    if (wasEmpty && this.wantPlay) {
      this.playAt(0);
    } else if (this.buffering && this.wantPlay) {
      // We ran out of audio mid-stream; resume with the freshly arrived chunk.
      this.buffering = false;
      this.playAt(this.pos + 1);
    } else {
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

  /** Seek to a chunk by its sentence index (tap-to-play). */
  seekToSentence(sentenceIndex: number): void {
    const i = this.chunks.findIndex((c) => c.index === sentenceIndex);
    if (i >= 0) this.playAt(i);
  }

  setRate(rate: number): void {
    this.rate = rate;
    if (this.active) this.sink?.setRate(rate);
  }

  // ---- internals ----------------------------------------------------------

  private playAt(i: number): void {
    if (i < 0 || i >= this.chunks.length) return;
    this.pos = i;
    this.wantPlay = true;
    this.buffering = false;

    const chunk = this.chunks[i];
    this.active = true;
    this.ensureSink().play(chunk.uri, this.rate, () => this.onChunkFinished());
    this.emit();
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
      // Caught up to the stream; wait for the next chunk.
      this.buffering = true;
      this.emit();
    }
  }

  private emit(finished = false): void {
    this.onChange({
      playing: this.wantPlay,
      currentIndex: this.chunks[this.pos]?.index ?? -1,
      loadedCount: this.chunks.length,
      finished,
      buffering: this.buffering,
    });
  }
}
