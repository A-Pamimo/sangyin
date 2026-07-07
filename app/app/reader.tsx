import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { PdfView } from '../src/components/PdfView';
import { Muted } from '../src/components/ui';
import { materialize } from '../src/player/offlineCache';
import { useMediaSession } from '../src/player/useMediaSession';
import { usePlayer } from '../src/player/usePlayer';
import { useApi, useAppStore } from '../src/store/appStore';
import { Palette, tokens, useTheme } from '../src/theme';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function ReaderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { voice, lang, speed, setVoice, setSpeed, savePosition, positions } = useAppStore();
  const { controller, state } = usePlayer();

  const [doc, setDoc] = useState<DocumentT | null>(null);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showVoices, setShowVoices] = useState(false);
  const [view, setView] = useState<'text' | 'pdf'>('text');

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

  // A PDF with no extractable text (scanned/image-based) has nothing to narrate —
  // open straight to the PDF view instead of a blank text list.
  useEffect(() => {
    if (doc?.has_pdf && !doc.chapters.some((c) => c.sentences.length > 0)) {
      setView('pdf');
    }
  }, [doc]);

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
            uri,
            duration: chunk.duration_sec,
            sentences: chunk.sentences.map((s) => ({
              index: s.index,
              offsetSec: s.offset_sec,
              durationSec: s.duration_sec,
            })),
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
        <Text style={{ color: colors.danger, fontWeight: '700' }}>Error</Text>
        <Muted style={{ marginTop: 6 }}>{error}</Muted>
      </View>
    );
  }
  if (!doc || !chapter) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
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
            <View style={{ flexDirection: 'row', gap: tokens.space(2) }}>
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

        {doc.has_pdf && (
          <View style={styles.viewToggle}>
            {(['text', 'pdf'] as const).map((v) => (
              <Pressable
                key={v}
                onPress={() => setView(v)}
                style={[styles.toggleBtn, view === v && styles.toggleBtnOn]}
              >
                <Text style={[styles.toggleText, view === v && styles.toggleTextOn]}>
                  {v === 'text' ? 'Text' : 'PDF'}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {view === 'pdf' && doc.has_pdf ? (
        <View style={{ flex: 1, backgroundColor: colors.surfaceAlt }}>
          <PdfView url={api.documentFileUrl(doc.id)} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={chapter.sentences}
          keyExtractor={(s) => String(s.index)}
          contentContainerStyle={{ padding: tokens.space(4), paddingBottom: 220, flexGrow: 1 }}
          ListEmptyComponent={
            <View style={{ paddingVertical: tokens.space(10), alignItems: 'center' }}>
              <Text style={styles.emptyTitle}>No readable text found</Text>
              <Muted style={{ marginTop: 8, textAlign: 'center', maxWidth: 320 }}>
                {doc.has_pdf
                  ? 'This PDF looks scanned or image-based, so there’s nothing to narrate. You can still read the original in the PDF view.'
                  : 'This document has no extractable text to read aloud.'}
              </Muted>
              {doc.has_pdf ? (
                <Pressable onPress={() => setView('pdf')} style={styles.emptyBtn}>
                  <Text style={styles.emptyBtnText}>Open PDF view</Text>
                </Pressable>
              ) : null}
            </View>
          }
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
      )}

      <View style={styles.dock}>
        {error ? <Muted style={{ color: colors.danger, marginBottom: 8 }}>{error}</Muted> : null}

        {showVoices && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', gap: tokens.space(2) }}>
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
          <TransportButton label="⏮" onPress={() => controller.prev()} color={colors.text} />
          <Pressable onPress={onPlayPause} style={styles.playBtn}>
            <Text style={styles.playIcon}>
              {state.buffering ? '…' : state.playing ? '❚❚' : '▶'}
            </Text>
          </Pressable>
          <TransportButton label="⏭" onPress={() => controller.next()} color={colors.text} />
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

function TransportButton({
  label,
  onPress,
  color,
}: {
  label: string;
  onPress: () => void;
  color: string;
}) {
  return (
    <Pressable onPress={onPress} style={{ padding: 10 }}>
      <Text style={{ color, fontSize: 26 }}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg },
    header: {
      paddingHorizontal: tokens.space(4),
      paddingTop: tokens.space(3),
      paddingBottom: tokens.space(2),
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    title: { fontFamily: tokens.fonts.display, color: c.text, fontSize: 20, fontWeight: '700' },
    viewToggle: {
      flexDirection: 'row',
      alignSelf: 'flex-start',
      marginTop: 10,
      padding: 3,
      borderRadius: 999,
      backgroundColor: c.surfaceAlt,
      borderWidth: 1,
      borderColor: c.border,
    },
    toggleBtn: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 999 },
    toggleBtnOn: { backgroundColor: c.accent },
    toggleText: { fontFamily: tokens.fonts.body, fontSize: 13, fontWeight: '600', color: c.textDim },
    toggleTextOn: { color: c.onAccent },
    emptyTitle: { fontFamily: tokens.fonts.display, color: c.text, fontSize: 20, fontWeight: '600', letterSpacing: -0.3 },
    emptyBtn: { marginTop: tokens.space(5), backgroundColor: c.accent, paddingVertical: 12, paddingHorizontal: 24, borderRadius: tokens.radius },
    emptyBtnText: { fontFamily: tokens.fonts.body, color: c.onAccent, fontSize: 15, fontWeight: '600' },
    sentence: { fontFamily: tokens.fonts.body, color: c.textDim, fontSize: 19, lineHeight: 30 },
    sentenceActive: {
      color: c.text,
      backgroundColor: c.accentSoft,
      fontWeight: '600',
    },
    dock: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: c.surface,
      borderTopWidth: 1,
      borderTopColor: c.border,
      borderTopLeftRadius: tokens.radius,
      borderTopRightRadius: tokens.radius,
      padding: tokens.space(4),
      paddingBottom: tokens.space(6),
      shadowColor: '#363E28',
      shadowOffset: { width: 0, height: -8 },
      shadowOpacity: 0.12,
      shadowRadius: 20,
      elevation: 12,
    },
    transport: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: tokens.space(6) },
    playBtn: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#363E28',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 16,
      elevation: 6,
    },
    playIcon: { color: c.onAccent, fontSize: 22, fontWeight: '800' },
    bottomRow: { flexDirection: 'row', justifyContent: 'center', gap: tokens.space(3), marginTop: 14 },
    smallChip: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surfaceAlt,
    },
    smallChipText: { fontFamily: tokens.fonts.body, color: c.text, fontSize: 13, fontWeight: '600' },
    chip: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surfaceAlt,
      maxWidth: 200,
    },
    chipActive: { backgroundColor: c.accentSoft, borderColor: c.accent },
    chipText: { fontFamily: tokens.fonts.body, color: c.textDim, fontSize: 13, fontWeight: '600' },
    chipTextActive: { color: c.text },
  });
