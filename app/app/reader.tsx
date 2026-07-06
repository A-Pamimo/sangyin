import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Chapter, DocumentT, Voice } from '../src/api/types';
import { Muted } from '../src/components/ui';
import { materialize } from '../src/player/offlineCache';
import { useMediaSession } from '../src/player/useMediaSession';
import { usePlayer } from '../src/player/usePlayer';
import { useApi, useAppStore } from '../src/store/appStore';
import { theme } from '../src/theme';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function ReaderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const { voice, lang, speed, setVoice, setSpeed, savePosition, positions } = useAppStore();
  const { controller, state } = usePlayer();

  const [doc, setDoc] = useState<DocumentT | null>(null);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showVoices, setShowVoices] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const startedChapterRef = useRef<string | null>(null);
  const listRef = useRef<FlatList>(null);

  const chapter: Chapter | undefined = doc?.chapters[chapterIndex];

  // Load document + voices, restore saved chapter.
  useEffect(() => {
    if (!id) return;
    let alive = true;
    (async () => {
      try {
        const d = await api.getDocument(id);
        if (!alive) return;
        setDoc(d);
        const saved = positions[id];
        if (saved) {
          const ci = d.chapters.findIndex((c) => c.id === saved.chapterId);
          if (ci >= 0) setChapterIndex(ci);
        }
      } catch (e: any) {
        if (alive) setError(e?.message ?? 'Failed to load document.');
      }
      api
        .voices()
        .then((v) => alive && setVoices(v))
        .catch(() => {});
    })();
    return () => {
      alive = false;
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Keep playback rate in sync with the speed control, live.
  useEffect(() => {
    controller.setRate(speed);
  }, [speed, controller]);

  // Persist resume position as the active sentence advances.
  useEffect(() => {
    if (doc && chapter && state.currentIndex >= 0) {
      savePosition(doc.id, {
        chapterId: chapter.id,
        sentenceIndex: state.currentIndex,
        updatedAt: Date.now(),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentIndex]);

  // Auto-scroll the active sentence into view.
  useEffect(() => {
    if (!chapter || state.currentIndex < 0) return;
    const pos = chapter.sentences.findIndex((s) => s.index === state.currentIndex);
    if (pos >= 0) {
      listRef.current?.scrollToIndex({ index: pos, viewPosition: 0.4, animated: true });
    }
  }, [state.currentIndex, chapter]);

  // OS media controls (web lock screen / notification / media keys).
  useMediaSession(controller, state, {
    title: doc?.title ?? 'Sangyin',
    nowPlaying: chapter?.sentences.find((s) => s.index === state.currentIndex)?.text,
  });

  // Native lock-screen now-playing info (iOS/Android).
  useEffect(() => {
    if (doc && chapter) {
      controller.setNowPlaying({ title: doc.title, artist: chapter.title });
    }
  }, [doc, chapter, controller]);

  const startStreaming = useCallback(
    async (ch: Chapter, autoplay: boolean, startIndex?: number) => {
      if (!doc) return;
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      controller.reset();
      controller.setRate(speed);
      if (autoplay) controller.play();
      startedChapterRef.current = ch.id;
      setError(null);
      try {
        for await (const chunk of api.streamTTS(
          { document_id: doc.id, chapter_id: ch.id, voice, lang_code: lang, start_index: startIndex },
          ac.signal,
        )) {
          if (ac.signal.aborted) return;
          const uri = await materialize(chunk, { docId: doc.id, chapterId: ch.id, voice });
          controller.addChunk({
            index: chunk.index,
            text: chunk.text,
            uri,
            duration: chunk.duration_sec,
          });
        }
        if (!ac.signal.aborted) controller.markStreamComplete();
      } catch (e: any) {
        if (!ac.signal.aborted) {
          setError(e?.message ?? 'Synthesis failed.');
          startedChapterRef.current = null;
        }
      }
    },
    [api, doc, voice, lang, speed, controller],
  );

  // Where Play should resume: the saved sentence if it's in this chapter, else the top.
  const resumeIndexFor = (ch: Chapter): number => {
    const saved = positions[doc!.id];
    if (saved && saved.chapterId === ch.id) return saved.sentenceIndex;
    return ch.sentences[0]?.index ?? 0;
  };

  const onPlayPause = () => {
    if (!chapter) return;
    if (startedChapterRef.current !== chapter.id) {
      startStreaming(chapter, true, resumeIndexFor(chapter));
    } else {
      controller.toggle();
    }
  };

  const onTapSentence = (sentenceIndex: number) => {
    if (!chapter) return;
    // Start (or restart) the stream from the tapped sentence. Cached audio makes
    // re-taps cheap, and this works whether or not that sentence is loaded yet.
    startStreaming(chapter, true, sentenceIndex);
  };

  const onSelectChapter = (i: number) => {
    abortRef.current?.abort();
    controller.reset();
    startedChapterRef.current = null;
    setChapterIndex(i);
  };

  const onSelectVoice = (v: Voice) => {
    setVoice(v.id, v.lang_code);
    setShowVoices(false);
    if (chapter && startedChapterRef.current === chapter.id) {
      // Re-synthesize from the current sentence in the new voice, preserving place.
      const from = state.currentIndex >= 0 ? state.currentIndex : resumeIndexFor(chapter);
      startStreaming(chapter, state.playing, from);
    }
  };

  if (error && !doc) {
    return (
      <View style={styles.center}>
        <Text style={{ color: theme.colors.danger, fontWeight: '700' }}>Error</Text>
        <Muted style={{ marginTop: 6 }}>{error}</Muted>
      </View>
    );
  }
  if (!doc || !chapter) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {doc.title}
        </Text>
        {doc.chapters.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
            <View style={{ flexDirection: 'row', gap: theme.space(2) }}>
              {doc.chapters.map((c, i) => (
                <Pressable
                  key={c.id}
                  onPress={() => onSelectChapter(i)}
                  style={[styles.chip, i === chapterIndex && styles.chipActive]}
                >
                  <Text
                    style={[styles.chipText, i === chapterIndex && styles.chipTextActive]}
                    numberOfLines={1}
                  >
                    {c.title || `Section ${i + 1}`}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      <FlatList
        ref={listRef}
        data={chapter.sentences}
        keyExtractor={(s) => String(s.index)}
        contentContainerStyle={{ padding: theme.space(4), paddingBottom: 220 }}
        onScrollToIndexFailed={({ index }) => {
          setTimeout(
            () => listRef.current?.scrollToIndex({ index, viewPosition: 0.4, animated: true }),
            120,
          );
        }}
        renderItem={({ item }) => {
          const active = item.index === state.currentIndex;
          return (
            <Pressable onPress={() => onTapSentence(item.index)}>
              <Text style={[styles.sentence, active && styles.sentenceActive]}>{item.text} </Text>
            </Pressable>
          );
        }}
      />

      <View style={styles.dock}>
        {error ? <Muted style={{ color: theme.colors.danger, marginBottom: 8 }}>{error}</Muted> : null}

        {showVoices && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', gap: theme.space(2) }}>
              {voices.map((v) => (
                <Pressable
                  key={v.id}
                  onPress={() => onSelectVoice(v)}
                  style={[styles.chip, voice === v.id && styles.chipActive]}
                >
                  <Text style={[styles.chipText, voice === v.id && styles.chipTextActive]}>
                    {v.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        )}

        <View style={styles.transport}>
          <TransportButton label="⏮" onPress={() => controller.prev()} />
          <Pressable onPress={onPlayPause} style={styles.playBtn}>
            <Text style={styles.playIcon}>
              {state.buffering ? '…' : state.playing ? '❚❚' : '▶'}
            </Text>
          </Pressable>
          <TransportButton label="⏭" onPress={() => controller.next()} />
        </View>

        <View style={styles.bottomRow}>
          <Pressable
            onPress={() => {
              const i = SPEEDS.indexOf(speed);
              setSpeed(SPEEDS[(i + 1) % SPEEDS.length]);
            }}
            style={styles.smallChip}
          >
            <Text style={styles.smallChipText}>{speed}×</Text>
          </Pressable>
          <Pressable onPress={() => setShowVoices((s) => !s)} style={styles.smallChip}>
            <Text style={styles.smallChipText}>
              Voice: {voices.find((v) => v.id === voice)?.name ?? voice}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function TransportButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.transportBtn}>
      <Text style={styles.transportIcon}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg },
  header: {
    paddingHorizontal: theme.space(4),
    paddingTop: theme.space(3),
    paddingBottom: theme.space(2),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: { color: theme.colors.text, fontSize: 18, fontWeight: '700' },
  sentence: { color: theme.colors.textDim, fontSize: 19, lineHeight: 30 },
  sentenceActive: {
    color: theme.colors.text,
    backgroundColor: theme.colors.accentSoft,
    fontWeight: '600',
  },
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    padding: theme.space(4),
    paddingBottom: theme.space(6),
  },
  transport: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.space(6) },
  transportBtn: { padding: 10 },
  transportIcon: { color: theme.colors.text, fontSize: 26 },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: { color: '#0b0d12', fontSize: 22, fontWeight: '800' },
  bottomRow: { flexDirection: 'row', justifyContent: 'center', gap: theme.space(3), marginTop: 14 },
  smallChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceAlt,
  },
  smallChipText: { color: theme.colors.text, fontSize: 13, fontWeight: '600' },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceAlt,
    maxWidth: 200,
  },
  chipActive: { backgroundColor: theme.colors.accentSoft, borderColor: theme.colors.accent },
  chipText: { color: theme.colors.textDim, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: theme.colors.text },
});
