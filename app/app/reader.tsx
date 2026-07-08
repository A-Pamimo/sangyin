import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

// The PDF view (rendered page images) is a large-screen convenience — on mobile
// the narrated text is the experience, so it's web/desktop only.
const PDF_VIEW_ENABLED = Platform.OS === 'web';

import { Chapter, DocumentT, PregenStatus, Voice } from '../src/api/types';
import { PdfView } from '../src/components/PdfView';
import { Muted } from '../src/components/ui';
import { materialize } from '../src/player/offlineCache';
import { useMediaSession } from '../src/player/useMediaSession';
import { usePlayer } from '../src/player/usePlayer';
import { NATURAL_VOICE_ID } from '../src/config';
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
  const [pregen, setPregen] = useState<PregenStatus | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const startedChapterRef = useRef<string | null>(null);
  const listRef = useRef<FlatList>(null);

  const chapter: Chapter | undefined = doc?.chapters[chapterIndex];
  // The natural voice plays only from cache; selecting it makes Play "prepare first".
  const isNatural = voice === NATURAL_VOICE_ID;
  const naturalReady = !isNatural || pregen?.status === 'done';

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
        .then((v) => {
          if (!alive) return;
          setVoices(v);
          // Self-correct a persisted voice the backend no longer offers, so we never
          // send a dead voice id (which the engine would ignore or mis-cache).
          if (v.length && !v.some((x) => x.id === voice)) {
            setVoice(v[0].id, v[0].lang_code);
          }
        })
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
  // open straight to the PDF view instead of a blank text list (web only).
  useEffect(() => {
    if (PDF_VIEW_ENABLED && doc?.has_pdf && !doc.chapters.some((c) => c.sentences.length > 0)) {
      setView('pdf');
    }
  }, [doc]);

  // While background OCR runs on a scanned PDF, poll until the text is ready.
  useEffect(() => {
    if (doc?.ocr_status !== 'pending' || !id) return;
    const iv = setInterval(async () => {
      try {
        const d = await api.getDocument(id);
        // Only replace `doc` when something actually changed, so we don't churn its
        // object identity every 4s (which would needlessly re-run doc-keyed effects).
        setDoc((prev) => {
          const count = (x: DocumentT) => x.chapters.reduce((n, c) => n + c.sentences.length, 0);
          if (prev && prev.ocr_status === d.ocr_status && count(prev) === count(d)) return prev;
          return d;
        });
        if (d.ocr_status !== 'pending') clearInterval(iv);
      } catch {
        /* keep polling */
      }
    }, 4000);
    return () => clearInterval(iv);
  }, [doc?.ocr_status, id, api]);

  const runOcr = async () => {
    if (!doc) return;
    try {
      const { status } = await api.startOcr(doc.id);
      setDoc({ ...doc, ocr_status: status as DocumentT['ocr_status'] });
    } catch (e: any) {
      setError(e?.message ?? 'Could not start OCR.');
    }
  };

  // Pre-generation status: read-only. Generation is triggered *only* by an explicit
  // action (the Play/Prepare button), never automatically — auto-triggering here is
  // what caused a runaway GPU-spend loop. Keyed on stable ids so the OCR poll swapping
  // the `doc` object can't re-fire it.
  useEffect(() => {
    const docId = doc?.id;
    const chapterId = chapter?.id;
    if (!docId || !chapterId) return;
    let alive = true;
    api
      .pregenerateStatus(docId, chapterId, voice)
      .then((s) => alive && setPregen(s))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [doc?.id, chapter?.id, voice, api]);

  // While a prepare job runs, poll its progress.
  useEffect(() => {
    const docId = doc?.id;
    const chapterId = chapter?.id;
    if (pregen?.status !== 'generating' || !docId || !chapterId) return;
    const iv = setInterval(async () => {
      try {
        const s = await api.pregenerateStatus(docId, chapterId, voice);
        setPregen(s);
        if (s.status !== 'generating') clearInterval(iv);
      } catch {
        /* keep polling */
      }
    }, 2500);
    return () => clearInterval(iv);
  }, [pregen?.status, doc?.id, chapter?.id, voice, api]);

  const preparePregen = async () => {
    if (!doc || !chapter) return;
    try {
      const s = await api.pregenerate({
        document_id: doc.id,
        chapter_id: chapter.id,
        voice,
        lang_code: lang,
      });
      setPregen(s && s.status ? s : { total: 0, done: 0, status: 'generating' });
    } catch (e: any) {
      setError(e?.message ?? 'Could not start pre-generation.');
    }
  };

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
          if (chunk.needs_prepare) {
            // Natural voice: uncached phrases remain — kick off (or resume) prepare.
            controller.pause();
            preparePregen();
            continue;
          }
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
          controller.pause(); // stop the "preparing" spinner on failure
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
    // Natural voice must be prepared (cached) once before it can play — Play triggers
    // that one-time GPU pass instead of a live stream.
    if (isNatural && !naturalReady) {
      if (pregen?.status !== 'generating') preparePregen();
      return;
    }
    if (startedChapterRef.current !== chapter.id) {
      startStreaming(chapter, true, resumeIndexFor(chapter));
    } else {
      controller.toggle();
    }
  };

  const onTapSentence = (sentenceIndex: number) => {
    if (!chapter) return;
    if (isNatural && !naturalReady) {
      if (pregen?.status !== 'generating') preparePregen();
      return;
    }
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
    // Don't auto-stream when switching to the natural voice — it needs preparing first
    // (the status effect will refresh, and Play will offer "Prepare").
    if (v.id !== NATURAL_VOICE_ID && chapter && startedChapterRef.current === chapter.id) {
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

  // Audio isn't playing yet even though the user wants it: either the first clip
  // is still synthesizing (loadedCount 0 — includes the voice model booting on
  // the very first request) or playback ran out mid-stream (buffering).
  const loadingAudio = !error && state.playing && (state.buffering || state.loadedCount === 0);
  const warmingUp = loadingAudio && state.loadedCount === 0;

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

        {doc.has_pdf && PDF_VIEW_ENABLED && (
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

      {doc.ocr_status === 'pending' ? (
        <View style={styles.ocrBanner}>
          <ActivityIndicator color={colors.accent} size="small" />
          <Muted style={{ marginLeft: 10, flex: 1 }}>
            Reading the scanned pages… text and audio will appear shortly.
          </Muted>
        </View>
      ) : null}

      {PDF_VIEW_ENABLED && view === 'pdf' && doc.has_pdf ? (
        <View style={{ flex: 1, backgroundColor: colors.surfaceAlt }}>
          <PdfView id={doc.id} activeIndex={state.currentIndex} />
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
              <Muted style={{ marginTop: 8, textAlign: 'center', maxWidth: 340 }}>
                {doc.ocr_status === 'unavailable'
                  ? 'This PDF is scanned, and no OCR engine is installed on the backend to read it. Install Tesseract to narrate scanned PDFs.'
                  : doc.has_pdf
                    ? 'This PDF looks scanned or image-based. Run OCR to narrate it, or read the original in the PDF view.'
                    : 'This document has no extractable text to read aloud.'}
              </Muted>
              {doc.has_pdf ? (
                <View style={{ flexDirection: 'row', gap: tokens.space(3), marginTop: tokens.space(5), flexWrap: 'wrap', justifyContent: 'center' }}>
                  {doc.ocr_status !== 'done' && doc.ocr_status !== 'pending' && doc.ocr_status !== 'unavailable' ? (
                    <Pressable onPress={runOcr} style={styles.emptyBtn}>
                      <Text style={styles.emptyBtnText}>Read aloud (run OCR)</Text>
                    </Pressable>
                  ) : null}
                  {PDF_VIEW_ENABLED ? (
                    <Pressable onPress={() => setView('pdf')} style={[styles.emptyBtn, styles.emptyBtnGhost]}>
                      <Text style={[styles.emptyBtnText, { color: colors.text }]}>Open PDF view</Text>
                    </Pressable>
                  ) : null}
                </View>
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

        {loadingAudio ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Muted style={{ marginLeft: 8, flex: 1 }}>
              {warmingUp
                ? 'Warming up the natural voice — the first play can take up to a minute, then it’s quick.'
                : 'Buffering the next part…'}
            </Muted>
          </View>
        ) : null}

        {isNatural && pregen?.status === 'failed' ? (
          <Muted style={{ color: colors.danger, marginBottom: 8 }}>
            The natural voice is unavailable right now (GPU spend limit). Your free voices still
            work — pick one above, or try again later.
          </Muted>
        ) : null}

        {pregen?.status === 'generating' ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.accent} />
            <View style={{ marginLeft: 8, flex: 1 }}>
              <Muted>
                {isNatural
                  ? 'Preparing the natural voice for this chapter — a one-time step, then it plays instantly.'
                  : 'Caching this chapter for smooth playback…'}
                {pregen.total ? ` ${Math.round((pregen.done / pregen.total) * 100)}%` : ''}
              </Muted>
              <View style={styles.pregenTrack}>
                <View
                  style={[
                    styles.pregenFill,
                    { width: `${pregen.total ? (pregen.done / pregen.total) * 100 : 5}%` },
                  ]}
                />
              </View>
            </View>
          </View>
        ) : null}

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
            {loadingAudio || (isNatural && pregen?.status === 'generating') ? (
              <ActivityIndicator color={colors.onAccent} />
            ) : isNatural && !naturalReady ? (
              // Prepare-first: this tap runs the one-time GPU pass, not live playback.
              <Text style={styles.playIcon}>⬇</Text>
            ) : (
              <Text style={styles.playIcon}>{state.playing ? '❚❚' : '▶'}</Text>
            )}
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
          {/* Prepare affordance only for the natural (GPU) voice — Kokoro plays live. */}
          {isNatural && pregen?.status === 'done' ? (
            <View style={[styles.smallChip, { borderColor: colors.accent }]}>
              <Text style={[styles.smallChipText, { color: colors.accent }]}>✓ Natural ready</Text>
            </View>
          ) : isNatural && pregen && pregen.status !== 'generating' ? (
            <Pressable onPress={preparePregen} style={styles.smallChip}>
              <Text style={styles.smallChipText}>
                {pregen.status === 'failed'
                  ? '⚠ Retry natural'
                  : `⬇ Prepare natural${pregen.status === 'partial' ? ' (resume)' : ''}`}
              </Text>
            </Pressable>
          ) : null}
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
    emptyBtn: { backgroundColor: c.accent, paddingVertical: 12, paddingHorizontal: 24, borderRadius: tokens.radius },
    emptyBtnGhost: { backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border },
    emptyBtnText: { fontFamily: tokens.fonts.body, color: c.onAccent, fontSize: 15, fontWeight: '600' },
    ocrBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: tokens.space(4),
      backgroundColor: c.accentSoft,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: tokens.radiusSm,
      backgroundColor: c.accentSoft,
    },
    pregenTrack: { height: 4, borderRadius: 2, backgroundColor: c.surface, marginTop: 6, overflow: 'hidden' },
    pregenFill: { height: 4, backgroundColor: c.accent },
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
