import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const PDF_VIEW_ENABLED = Platform.OS === 'web';

import { Chapter, DocumentT, PregenStatus, Voice } from '../src/api/types';
import { PdfView } from '../src/components/PdfView';
import { RetroChip, SegMeter, SegmentedControl } from '../src/components/retro';
import { Muted } from '../src/components/ui';
import { materialize } from '../src/player/offlineCache';
import { useMediaSession } from '../src/player/useMediaSession';
import { usePlayer } from '../src/player/usePlayer';
import { NATURAL_VOICE_ID } from '../src/config';
import { sfx } from '../src/sfx/sfx';
import { useApi, useAppStore } from '../src/store/appStore';
import { mix, Palette, tokens, useTheme } from '../src/theme';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function ReaderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
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
  const isNatural = voice === NATURAL_VOICE_ID;
  const naturalReady = !isNatural || pregen?.status === 'done';

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
  }, [id]);

  useEffect(() => {
    controller.setRate(speed);
  }, [speed, controller]);

  useEffect(() => {
    if (doc && chapter && state.currentIndex >= 0) {
      savePosition(doc.id, {
        chapterId: chapter.id,
        sentenceIndex: state.currentIndex,
        updatedAt: Date.now(),
      });
    }
  }, [state.currentIndex]);

  useEffect(() => {
    if (!chapter || state.currentIndex < 0) return;
    const pos = chapter.sentences.findIndex((s) => s.index === state.currentIndex);
    if (pos >= 0) {
      listRef.current?.scrollToIndex({ index: pos, viewPosition: 0.4, animated: true });
    }
  }, [state.currentIndex, chapter]);

  useMediaSession(controller, state, {
    title: doc?.title ?? 'Sangyin',
    nowPlaying: chapter?.sentences.find((s) => s.index === state.currentIndex)?.text,
  });

  useEffect(() => {
    if (doc && chapter) {
      controller.setNowPlaying({ title: doc.title, artist: chapter.title });
    }
  }, [doc, chapter, controller]);

  useEffect(() => {
    if (PDF_VIEW_ENABLED && doc?.has_pdf && !doc.chapters.some((c) => c.sentences.length > 0)) {
      setView('pdf');
    }
  }, [doc]);

  useEffect(() => {
    if (doc?.ocr_status !== 'pending' || !id) return;
    const iv = setInterval(async () => {
      try {
        const d = await api.getDocument(id);
        setDoc((prev) => {
          const count = (x: DocumentT) => x.chapters.reduce((n, c) => n + c.sentences.length, 0);
          if (prev && prev.ocr_status === d.ocr_status && count(prev) === count(d)) return prev;
          return d;
        });
        if (d.ocr_status !== 'pending') clearInterval(iv);
      } catch {
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
          controller.pause();
        }
      }
    },
    [api, doc, voice, lang, speed, controller],
  );

  const resumeIndexFor = (ch: Chapter): number => {
    const saved = positions[doc!.id];
    if (saved && saved.chapterId === ch.id) return saved.sentenceIndex;
    return ch.sentences[0]?.index ?? 0;
  };

  const onPlayPause = () => {
    if (!chapter) return;
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
    if (v.id !== NATURAL_VOICE_ID && chapter && startedChapterRef.current === chapter.id) {
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

  const loadingAudio = !error && state.playing && (state.buffering || state.loadedCount === 0);
  const warmingUp = loadingAudio && state.loadedCount === 0;

  const posInChapter = chapter.sentences.findIndex((s) => s.index === state.currentIndex);
  const playFrac =
    chapter.sentences.length > 0 && posInChapter >= 0 ? (posInChapter + 1) / chapter.sentences.length : 0;
  const seekTo = (f: number) => {
    const list = chapter.sentences;
    if (!list.length) return;
    const pos = Math.max(0, Math.min(list.length - 1, Math.floor(f * list.length)));
    onTapSentence(list[pos].index);
  };

  return (
    <View style={styles.container}>
      {/* Background Lighting */}
      <LinearGradient colors={[colors.bg, colors.bgAlt]} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <View style={styles.headerInner}>
          <View style={styles.titleBar}>
          <Pressable onPress={() => router.push('/library')} style={styles.backBtn}>
            <Text style={styles.backBtnText}>←</Text>
          </Pressable>
          {doc.chapters.length > 1 ? (
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={styles.titleDoc} numberOfLines={1}>{doc.title}</Text>
              <Text style={styles.title} numberOfLines={1}>
                {chapter.title || `Section ${chapterIndex + 1}`}
              </Text>
            </View>
          ) : (
            <Text style={styles.title} numberOfLines={1}>{doc.title}</Text>
          )}
          <View style={{ width: 44 }} />
        </View>
        
        <View style={styles.headerBody}>
          {doc.chapters.length > 1 && (
            <SegmentedControl<number>
              scroll
              size="sm"
              segments={doc.chapters.map((c, i) => ({ value: i, label: c.title || `Section ${i + 1}` }))}
              value={chapterIndex}
              onChange={onSelectChapter}
            />
          )}
          {doc.has_pdf && PDF_VIEW_ENABLED && (
            <SegmentedControl<'text' | 'pdf'>
              segments={[
                { value: 'text', label: 'Text' },
                { value: 'pdf', label: 'PDF' },
              ]}
              value={view}
              onChange={setView}
              style={{ marginTop: 10 }}
            />
          )}
        </View>
        </View>
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
          contentContainerStyle={{ padding: tokens.space(5), paddingBottom: 280, flexGrow: 1 }}
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
            const played = state.currentIndex >= 0 && item.index < state.currentIndex;
            return (
              <Pressable onPress={() => onTapSentence(item.index)} style={active ? styles.sentenceWrapActive : styles.sentenceWrap}>
                <Text
                  style={[
                    active ? styles.sentenceActive : styles.sentence,
                    played && !active && { opacity: 0.4 },
                    !played && !active && { opacity: 0.65 },
                  ]}
                >
                  {item.text}{' '}
                </Text>
                {active && <View style={styles.sentenceMarker} />}
              </Pressable>
            );
          }}
        />
      )}

      {/* Premium Dock Component */}
      <View style={styles.dock}>
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.03)']}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        
        {error ? <Muted style={{ color: colors.danger, marginBottom: 12 }}>{error}</Muted> : null}

        {loadingAudio ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Muted style={{ marginLeft: 12, flex: 1, fontSize: 13 }}>
              {warmingUp
                ? 'Warming up the natural voice — the first play can take up to a minute, then it’s quick.'
                : 'Buffering the next part…'}
            </Muted>
          </View>
        ) : null}

        {isNatural && pregen?.status === 'failed' ? (
          <Muted style={{ color: colors.danger, marginBottom: 12 }}>
            The natural voice is unavailable right now (GPU spend limit). Your free voices still
            work — pick one above, or try again later.
          </Muted>
        ) : null}

        {pregen?.status === 'generating' ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.accent} />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Muted style={{ fontSize: 13 }}>
                {isNatural
                  ? 'Preparing the natural voice for this chapter — a one-time step, then it plays instantly.'
                  : 'Caching this chapter for smooth playback…'}
                {pregen.total ? ` ${Math.round((pregen.done / pregen.total) * 100)}%` : ''}
              </Muted>
              <SegMeter
                pct={pregen.total ? (pregen.done / pregen.total) * 100 : 5}
                style={{ marginTop: 8 }}
              />
            </View>
          </View>
        ) : null}

        {showVoices && (
          <SegmentedControl<string>
            scroll
            size="sm"
            style={{ marginBottom: 16 }}
            segments={voices.map((v) => ({ value: v.id, label: v.name }))}
            value={voice}
            onChange={(vid) => {
              const v = voices.find((x) => x.id === vid);
              if (v) onSelectVoice(v);
            }}
          />
        )}

        {chapter.sentences.length > 0 ? (
          <Waveform
            frac={playFrac}
            label={`${posInChapter >= 0 ? posInChapter + 1 : 0}/${chapter.sentences.length}`}
            onSeek={seekTo}
            colors={colors}
          />
        ) : null}

        <View style={styles.transport}>
          <TransportButton
            label="⏮"
            onPress={() => {
              sfx.play('tap');
              controller.prev();
            }}
            color={colors.text}
            style={styles.transportBtn}
          />
          <AnimatedPlayButton
            playing={state.playing}
            loading={loadingAudio || (isNatural && pregen?.status === 'generating')}
            prepareOnly={isNatural && !naturalReady}
            onPress={() => {
              sfx.play('toggle');
              onPlayPause();
            }}
            colors={colors}
            shadowColor={mix(colors.accent, '#000', 0.3)}
          />
          <TransportButton
            label="⏭"
            onPress={() => {
              sfx.play('tap');
              controller.next();
            }}
            color={colors.text}
            style={styles.transportBtn}
          />
        </View>

        <View style={styles.bottomRow}>
          <RetroChip
            label={`${speed}×`}
            onPress={() => {
              const i = SPEEDS.indexOf(speed);
              setSpeed(SPEEDS[(i + 1) % SPEEDS.length]);
            }}
          />
          <RetroChip
            label={`Voice: ${voices.find((v) => v.id === voice)?.name ?? voice}`}
            active={showVoices}
            onPress={() => setShowVoices((s) => !s)}
          />
          {isNatural && pregen?.status === 'done' ? (
            <RetroChip label="✓ Natural ready" tone="accent" />
          ) : isNatural && pregen && pregen.status !== 'generating' ? (
            <RetroChip
              label={
                pregen.status === 'failed'
                  ? '⚠ Retry natural'
                  : `⬇ Prepare natural${pregen.status === 'partial' ? ' (resume)' : ''}`
              }
              tone={pregen.status === 'failed' ? 'danger' : 'default'}
              onPress={preparePregen}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

function AnimatedPlayButton({
  playing,
  loading,
  prepareOnly,
  onPress,
  colors,
  shadowColor,
}: {
  playing: boolean;
  loading: boolean;
  prepareOnly: boolean;
  onPress: () => void;
  colors: Palette;
  shadowColor: string;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPressIn={() => (scale.value = withSpring(0.9, { damping: 15 }))}
        onPressOut={() => (scale.value = withSpring(1, { damping: 15 }))}
        onPress={onPress}
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: colors.surface,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.25,
          shadowRadius: 20,
          elevation: 10,
        }}
      >
        <LinearGradient
          colors={['rgba(255,255,255,0.15)', 'transparent']}
          style={StyleSheet.absoluteFill}
        />
        {loading ? (
          <ActivityIndicator color={colors.onAccent} size="large" />
        ) : prepareOnly ? (
          <Text style={{ color: colors.onAccent, fontSize: 26, fontWeight: '900' }}>⬇</Text>
        ) : (
          <Text style={{ color: colors.onAccent, fontSize: 26, fontWeight: '900', letterSpacing: playing ? -1 : 2 }}>
            {playing ? '❚❚' : '▶'}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

function TransportButton({
  label,
  onPress,
  color,
  style,
}: {
  label: string;
  onPress: () => void;
  color: string;
  style?: ViewStyle;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Animated.View style={[style, animatedStyle]}>
      <Pressable
        onPressIn={() => (scale.value = withSpring(0.85, { damping: 15 }))}
        onPressOut={() => (scale.value = withSpring(1, { damping: 15 }))}
        onPress={onPress}
        style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ color, fontSize: 22, fontWeight: '700' }}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

function Waveform({
  frac,
  label,
  onSeek,
  colors,
}: {
  frac: number;
  label: string;
  onSeek: (f: number) => void;
  colors: Palette;
}) {
  const [w, setW] = useState(0);
  const BARS = 48;
  const filled = Math.round(frac * BARS);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 }}>
      <Pressable
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
        onPress={(e) => {
          if (w > 0) onSeek(Math.max(0, Math.min(1, e.nativeEvent.locationX / w)));
        }}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, height: 44 }}
      >
        {Array.from({ length: BARS }, (_, i) => {
          const env = Math.sin((i / BARS) * Math.PI);
          const h = 8 + env * 24;
          const head = i === filled;
          return (
            <View key={i} style={{ flex: 1, height: 44, justifyContent: 'center' }}>
              <View
                style={{
                  height: Math.max(4, h),
                  borderRadius: 2,
                  backgroundColor: head ? colors.warm : i < filled ? colors.accent : colors.surfaceAlt,
                  borderWidth: head ? 1 : 0,
                  borderColor: head ? 'rgba(0,0,0,0.1)' : 'transparent',
                }}
              />
            </View>
          );
        })}
      </Pressable>
      <Text
        style={{
          fontFamily: tokens.fonts.mono,
          fontSize: 12,
          fontWeight: '600',
          color: colors.textDim,
          minWidth: 54,
          textAlign: 'right',
          fontVariant: ['tabular-nums'],
        }}
      >
        {label}
      </Text>
    </View>
  );
}

const makeStyles = (c: Palette, isDark: boolean) => {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg },
    header: { borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.surface },
    headerInner: { alignSelf: 'center', width: '100%', maxWidth: 900 },
    titleBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: tokens.space(3),
      paddingVertical: 10,
    },
    backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    backBtnText: { fontFamily: tokens.fonts.display, color: c.text, fontSize: 24, fontWeight: '400' },
    titleDoc: { fontFamily: tokens.fonts.body, color: c.textDim, fontSize: 12, fontWeight: '500', letterSpacing: 0.1, textAlign: 'center' },
    title: { fontFamily: tokens.fonts.display, color: c.text, fontSize: 16, fontWeight: '700', letterSpacing: -0.2, textAlign: 'center', flex: 1 },
    headerBody: {
      paddingHorizontal: tokens.space(4),
      paddingBottom: tokens.space(3),
    },
    emptyTitle: { fontFamily: tokens.fonts.display, color: c.text, fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
    emptyBtn: { backgroundColor: c.accent, paddingVertical: 14, paddingHorizontal: 24, borderRadius: tokens.radiusChrome, ...tokens.shadowRaised },
    emptyBtnGhost: { backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border, ...tokens.shadowRaised },
    emptyBtnText: { fontFamily: tokens.fonts.body, color: c.onAccent, fontSize: 16, fontWeight: '700' },
    ocrBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: tokens.space(5),
      backgroundColor: c.surfaceAlt,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: tokens.radiusChrome,
      backgroundColor: c.surfaceAlt,
      borderWidth: 1,
      borderColor: c.border,
    },
    sentenceWrap: { paddingVertical: 4, paddingHorizontal: 8, marginHorizontal: -8, borderRadius: 8 },
    sentenceWrapActive: { paddingVertical: 4, paddingHorizontal: 8, marginHorizontal: -8, borderRadius: 8, backgroundColor: c.accentSoft, position: 'relative' },
    sentenceMarker: { position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, borderRadius: 2, backgroundColor: c.accent },
    sentence: { fontFamily: tokens.fonts.body, color: c.textDim, fontSize: 21, lineHeight: 34, fontWeight: '500' },
    sentenceActive: { fontFamily: tokens.fonts.body, color: c.text, fontSize: 21, lineHeight: 34, fontWeight: '700' },
    dock: {
      position: 'absolute',
      alignSelf: 'center',
      width: '100%',
      maxWidth: 900,
      bottom: 0,
      backgroundColor: c.surface,
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingHorizontal: tokens.space(5),
      paddingTop: tokens.space(6),
      paddingBottom: tokens.space(8),
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      ...tokens.shadow,
    },
    transport: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: tokens.space(6) },
    transportBtn: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: c.surfaceAlt,
      borderWidth: 1,
      borderColor: c.border,
    },
    bottomRow: {
      flexDirection: 'row', justifyContent: 'center', gap: tokens.space(3),
      marginTop: 28, paddingTop: 16, flexWrap: 'wrap',
      borderTopWidth: 1, borderTopColor: c.border,
    },
  });
};
