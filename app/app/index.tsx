import { useFocusEffect, useRouter } from 'expo-router';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedRef,
  useAnimatedStyle,
  useDerivedValue,
  useScrollViewOffset,
} from 'react-native-reanimated';

import { DocumentSummary } from '../src/api/types';
import { useApi, useAppStore } from '../src/store/appStore';
import { Palette, THEME_LABELS, tokens, useTheme } from '../src/theme';

// ---------------------------------------------------------------------------
// Pinned-stage scroll model (mirrors the "Sage Immersive" reference): each stage
// is a tall track; its inner content pins to the viewport (via a scroll-driven
// translate) while you scroll through it, and child animations are driven by the
// stage's own 0→1 progress. Works on web + native without CSS `sticky`.
// ---------------------------------------------------------------------------

const ScrollCtx = createContext<{ scrollY: SharedValue<number>; vh: number }>(null as any);
const StageCtx = createContext<{ progress: SharedValue<number>; vh: number }>(null as any);

function Stage({
  heightVh,
  bg,
  leadVh = 0,
  children,
}: {
  heightVh: number;
  bg?: string;
  // How far (in viewports) before the stage pins its reveal animations should
  // begin, so content animates in as the stage enters instead of after it locks.
  leadVh?: number;
  children: React.ReactNode;
}) {
  const { scrollY, vh } = useContext(ScrollCtx);
  const [startY, setStartY] = useState(0);
  const stageH = vh * heightVh;
  const travel = Math.max(1, stageH - vh);
  const lead = vh * leadVh;
  const span = travel + lead;
  const isWeb = Platform.OS === 'web';

  const progress = useDerivedValue(() =>
    Math.min(1, Math.max(0, (scrollY.value - startY + lead) / span)),
  );
  // Native pins with a scroll-driven transform (runs on the UI thread → smooth).
  // Web pins with CSS position:sticky so the browser composites it (no per-frame
  // JS transform fighting native scroll, which is what caused the stutter).
  const pinStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.min(travel, Math.max(0, scrollY.value - startY)) }],
  }));

  const pinned = { height: vh, overflow: 'hidden' } as const;
  const webPin = { position: 'sticky', top: 0 } as any;
  const nativePin = { position: 'absolute', top: 0, left: 0, right: 0 } as const;

  return (
    <View onLayout={(e) => setStartY(e.nativeEvent.layout.y)} style={{ height: stageH }}>
      <Animated.View
        style={[
          pinned,
          isWeb ? webPin : nativePin,
          bg ? { backgroundColor: bg } : null,
          isWeb ? null : pinStyle,
        ]}
      >
        <StageCtx.Provider value={{ progress, vh }}>{children}</StageCtx.Provider>
      </Animated.View>
    </View>
  );
}

type AnimSpec = {
  x?: [number, number];
  y?: [number, number];
  scale?: [number, number];
  rotate?: [number, number];
  opacity?: [number, number];
};

/** Drives a child off the current stage's progress, over an optional [r0,r1] slice. */
function Anim({
  a,
  range = [0, 1],
  style,
  pointer,
  children,
}: {
  a: AnimSpec;
  range?: [number, number];
  style?: ViewStyle;
  pointer?: 'none' | 'auto';
  children?: React.ReactNode;
}) {
  const { progress } = useContext(StageCtx);
  const aStyle = useAnimatedStyle(() => {
    const raw = interpolate(progress.value, range, [0, 1], Extrapolation.CLAMP);
    const t = raw * raw * (3 - 2 * raw); // smoothstep easing
    const lerp = (p: [number, number]) => p[0] + (p[1] - p[0]) * t;
    const transform: any[] = [];
    if (a.x) transform.push({ translateX: lerp(a.x) });
    if (a.y) transform.push({ translateY: lerp(a.y) });
    if (a.scale) transform.push({ scale: lerp(a.scale) });
    if (a.rotate) transform.push({ rotate: `${lerp(a.rotate)}deg` });
    const out: any = { transform };
    if (a.opacity) out.opacity = lerp(a.opacity);
    return out;
  });
  return (
    <Animated.View pointerEvents={pointer} style={[style, aStyle]}>
      {children}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------

export default function LandingScreen() {
  const router = useRouter();
  const api = useApi();
  const { colors: c } = useTheme();
  const { height: vh, width: vw } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(c), [c]);

  const themeName = useAppStore((s) => s.themeName);
  const setThemeName = useAppStore((s) => s.setThemeName);

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useScrollViewOffset(scrollRef);
  const [contentH, setContentH] = useState(1);

  const [docs, setDocs] = useState<DocumentSummary[]>([]);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      api
        .listDocuments()
        .then((d) => alive && setDocs(d.slice(0, 6)))
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, [api]),
  );

  const progressStyle = useAnimatedStyle(() => ({
    width:
      interpolate(scrollY.value, [0, Math.max(1, contentH - vh)], [0, 1], Extrapolation.CLAMP) * vw,
  }));

  return (
    <View style={styles.root}>
      <ScrollCtx.Provider value={{ scrollY, vh }}>
        <Animated.ScrollView
          ref={scrollRef}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={(_w, h) => setContentH(h)}
        >
          <HeroStage onStart={() => router.push('/library')} onImport={() => router.push('/import')} />
          <ApproachStage />
          <GalleryStage
            docs={docs}
            onOpen={(id) => router.push({ pathname: '/reader', params: { id } })}
          />
          <GuideStage onImport={() => router.push('/import')} />
          <StatementStage />
          <ContactSection onOpen={() => router.push('/library')} onImport={() => router.push('/import')} />
        </Animated.ScrollView>
      </ScrollCtx.Provider>

      <View pointerEvents="none" style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, progressStyle]} />
      </View>

      <View style={styles.switcher}>
        {THEME_LABELS.map((t) => {
          const on = t.name === themeName;
          return (
            <Pressable key={t.name} onPress={() => setThemeName(t.name)} style={[styles.pill, on && styles.pillOn]}>
              <Text style={[styles.pillText, on && styles.pillTextOn]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Stages
// ---------------------------------------------------------------------------

function HeroStage({ onStart, onImport }: { onStart: () => void; onImport: () => void }) {
  const { colors: c } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  return (
    <Stage heightVh={1.5} bg={c.bg}>
      <View style={styles0.center}>
        <Anim a={{ y: [0, -110] }} pointer="none" style={{ position: 'absolute', top: -60, right: -60, width: 300, height: 300, borderRadius: 150, backgroundColor: c.accent, opacity: 0.5 }} />
        <Anim a={{ y: [0, 90] }} pointer="none" style={{ position: 'absolute', bottom: -50, left: -70, width: 240, height: 240, borderRadius: 120, backgroundColor: c.warm, opacity: 0.38 }} />
        <Anim a={{ y: [0, -150], rotate: [-12, 8] }} pointer="none" style={{ position: 'absolute', top: '18%', left: '9%', width: 96, height: 96, borderRadius: 26, backgroundColor: c.accentDeep, opacity: 0.7 }} />
        <Anim a={{ y: [0, 120], rotate: [14, -14] }} pointer="none" style={{ position: 'absolute', bottom: '15%', right: '12%', width: 64, height: 64, borderRadius: 18, backgroundColor: c.warm, opacity: 0.55 }} />

        <Anim a={{ scale: [1, 1.06], y: [0, -30], opacity: [1, 0] }} range={[0.5, 1]} style={{ maxWidth: 720, width: '100%', alignSelf: 'center', paddingHorizontal: tokens.space(6) }}>
          <View style={s.badge}>
            <View style={s.badgeDot} />
            <Text style={s.badgeText}>Sangyin · 聲音</Text>
          </View>
          <Text style={s.h1}>
            Read slow,{'\n'}listen <Text style={s.h1Accent}>deep.</Text>
          </Text>
          <Text style={s.lede}>
            Turn any book, paper, or article into calm, natural narration — grounded voices, your
            pace, picking up right where you left off.
          </Text>
          <View style={{ flexDirection: 'row', gap: tokens.space(3), marginTop: tokens.space(8), flexWrap: 'wrap' }}>
            <Pressable onPress={onStart} style={s.ctaPrimary}>
              <Text style={s.ctaPrimaryText}>Get started</Text>
            </Pressable>
            <Pressable onPress={onImport} style={s.ctaGhost}>
              <Text style={s.ctaGhostText}>Import a document</Text>
            </Pressable>
          </View>
        </Anim>

        <Anim a={{ opacity: [1, 0] }} range={[0, 0.12]} pointer="none" style={s.scrollCue}>
          <Text style={s.scrollCueText}>SCROLL</Text>
          <View style={s.scrollCueLine} />
        </Anim>
      </View>
    </Stage>
  );
}

const APPROACH = [
  { title: 'Natural voices', body: 'Warm, human-sounding narration from a local neural engine — many voices, no robotic edge.', anim: { x: [-280, 0], y: [70, 0], opacity: [0, 1], rotate: [-7, 0] } as AnimSpec, range: [0.18, 0.5] as [number, number] },
  { title: 'Any document', body: 'PDFs, EPUBs, DOCX, plain text, or a pasted article URL. Drop it in and press play.', anim: { y: [120, 0], opacity: [0, 1] } as AnimSpec, range: [0.24, 0.56] as [number, number] },
  { title: 'Yours, offline', body: 'Audio is cached as you listen, so you can resume anywhere — even without a connection.', anim: { x: [280, 0], y: [70, 0], opacity: [0, 1], rotate: [7, 0] } as AnimSpec, range: [0.3, 0.62] as [number, number] },
];

function ApproachStage() {
  const { colors: c } = useTheme();
  const { width: vw } = useWindowDimensions();
  const s = useMemo(() => makeStyles(c), [c]);
  const twoCol = vw > 720;
  return (
    <Stage heightVh={1.7} bg={c.bg} leadVh={0.9}>
      <View style={[styles0.center, { paddingHorizontal: tokens.space(6) }]}>
        <View style={{ maxWidth: 1000, width: '100%', alignSelf: 'center' }}>
          <Anim a={{ y: [40, 0], opacity: [0, 1] }} range={[0, 0.26]}>
            <Text style={s.kicker}>— How it works</Text>
          </Anim>
          <Anim a={{ y: [40, 0], opacity: [0, 1] }} range={[0.06, 0.34]}>
            <Text style={s.h2Center}>
              We make reading feel <Text style={{ color: c.accent }}>grounded</Text> — the way a good
              tool feels in the hand.
            </Text>
          </Anim>
          <View style={[s.cardRow, { flexDirection: twoCol ? 'row' : 'column' }]}>
            {APPROACH.map((card) => (
              <Anim key={card.title} a={card.anim} range={card.range} style={{ flex: twoCol ? 1 : undefined }}>
                <View style={s.card}>
                  <View style={s.cardIcon} />
                  <Text style={s.cardTitle}>{card.title}</Text>
                  <Text style={s.cardBody}>{card.body}</Text>
                </View>
              </Anim>
            ))}
          </View>
        </View>
      </View>
    </Stage>
  );
}

const SOURCE_LABEL: Record<string, string> = {
  pdf: 'PDF',
  epub: 'EPUB',
  docx: 'DOCX',
  txt: 'Text',
  text: 'Pasted',
  url: 'Article',
};
const PLACEHOLDER = [
  { title: 'The Almanack', tag: 'PDF' },
  { title: 'A long read', tag: 'Article' },
  { title: 'Field notes', tag: 'Text' },
];

function GalleryStage({ docs, onOpen }: { docs: DocumentSummary[]; onOpen: (id: string) => void }) {
  const { colors: c } = useTheme();
  const { width: vw } = useWindowDimensions();
  const s = useMemo(() => makeStyles(c), [c]);
  const [trackW, setTrackW] = useState(0);
  const maxShift = Math.max(0, trackW - vw + tokens.space(6));

  const cards = docs.length
    ? docs.map((d) => ({ id: d.id, title: d.title, tag: SOURCE_LABEL[d.source_type] ?? d.source_type }))
    : PLACEHOLDER.map((p, i) => ({ id: `ph-${i}`, title: p.title, tag: p.tag }));

  return (
    <Stage heightVh={2.1} bg={c.bgAlt} leadVh={0.5}>
      <GalleryInner
        c={c}
        s={s}
        cards={cards}
        maxShift={maxShift}
        setTrackW={setTrackW}
        onOpen={onOpen}
      />
    </Stage>
  );
}

function GalleryInner({ c, s, cards, maxShift, setTrackW, onOpen }: any) {
  const { progress } = useContext(StageCtx);
  const trackStyle = useAnimatedStyle(() => {
    const t = interpolate(progress.value, [0.1, 0.9], [0, 1], Extrapolation.CLAMP);
    return { transform: [{ translateX: -maxShift * t }] };
  });
  return (
    <View style={{ flex: 1, justifyContent: 'center' }}>
      <View style={{ maxWidth: 1000, alignSelf: 'center', width: '100%', paddingHorizontal: tokens.space(6), flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <Text style={s.h2}>Your shelf</Text>
        <Text style={s.faint}>scroll to pan →</Text>
      </View>
      <View style={{ overflow: 'hidden', marginTop: tokens.space(6) }}>
        <Animated.View
          onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
          style={[{ flexDirection: 'row', gap: tokens.space(6), paddingHorizontal: tokens.space(6) }, trackStyle]}
        >
          {cards.map((card: any, i: number) => (
            <Pressable key={card.id} disabled={String(card.id).startsWith('ph-')} onPress={() => onOpen(card.id)} style={s.workCard}>
              <View style={[s.workShot, { backgroundColor: [c.surfaceAlt, c.accentSoft, c.warm][i % 3] }]}>
                <Text style={s.workShotTag}>{card.tag}</Text>
              </View>
              <Text style={s.workTitle} numberOfLines={1}>
                {card.title}
              </Text>
            </Pressable>
          ))}
        </Animated.View>
      </View>
    </View>
  );
}

const GUIDE = [
  {
    n: '1',
    title: 'Bring your reading',
    body: 'Import a PDF, EPUB, DOCX or text file, paste an article, or drop in a link. Everything lands in one library.',
  },
  {
    n: '2',
    title: 'Press play',
    body: 'Narration starts the moment the first sentence is ready — no waiting for the whole document to process.',
  },
  {
    n: '3',
    title: 'Follow along',
    body: 'The spoken sentence lights up as you listen. Tap any line to jump there, and set the pace from 0.5× to 2×.',
  },
  {
    n: '4',
    title: 'Pick up anywhere',
    body: 'Sangyin remembers your spot in every document and resumes right where you left off — on any device.',
  },
];

function GuideStage({ onImport }: { onImport: () => void }) {
  const { colors: c } = useTheme();
  const { width: vw } = useWindowDimensions();
  const s = useMemo(() => makeStyles(c), [c]);
  const twoCol = vw > 720;
  return (
    <Stage heightVh={1.9} bg={c.bg} leadVh={0.9}>
      <View style={[styles0.center, { paddingHorizontal: tokens.space(6) }]}>
        <View style={{ maxWidth: 1000, width: '100%', alignSelf: 'center' }}>
          <Anim a={{ y: [40, 0], opacity: [0, 1] }} range={[0, 0.24]}>
            <Text style={s.kicker}>— Getting started</Text>
          </Anim>
          <Anim a={{ y: [40, 0], opacity: [0, 1] }} range={[0.05, 0.3]}>
            <Text style={s.h2Center}>
              From file to <Text style={{ color: c.accent }}>voice</Text> in four steps.
            </Text>
          </Anim>
          <View style={[s.stepGrid, { flexDirection: twoCol ? 'row' : 'column', flexWrap: twoCol ? 'wrap' : 'nowrap' }]}>
            {GUIDE.map((step, i) => (
              <Anim
                key={step.n}
                a={{ y: [50, 0], opacity: [0, 1] }}
                range={[0.16 + i * 0.12, 0.44 + i * 0.12]}
                style={{ width: twoCol ? '48%' : '100%' }}
              >
                <View style={s.step}>
                  <View style={s.stepNum}>
                    <Text style={s.stepNumText}>{step.n}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardTitle}>{step.title}</Text>
                    <Text style={s.cardBody}>{step.body}</Text>
                  </View>
                </View>
              </Anim>
            ))}
          </View>
          <Anim a={{ y: [40, 0], opacity: [0, 1] }} range={[0.6, 0.9]} style={{ alignItems: 'center', marginTop: tokens.space(10) }}>
            <Pressable onPress={onImport} style={s.ctaPrimary}>
              <Text style={s.ctaPrimaryText}>Import your first document</Text>
            </Pressable>
          </Anim>
        </View>
      </View>
    </Stage>
  );
}

function StatementStage() {
  const { colors: c } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  return (
    <Stage heightVh={1.5} bg={c.text} leadVh={0.9}>
      <View style={[styles0.center, { paddingHorizontal: tokens.space(6) }]}>
        <Anim a={{ scale: [0.4, 2.1], opacity: [0.5, 0.14] }} pointer="none" style={{ position: 'absolute', width: 420, height: 420, borderRadius: 210, backgroundColor: c.accent, alignSelf: 'center' }} />
        <View style={{ maxWidth: 720, alignItems: 'center' }}>
          <Anim a={{ y: [60, 0], opacity: [0, 1] }} range={[0.08, 0.42]}>
            <Text style={[s.h2Center, { color: c.bg }]}>Listening is a kind of reading.</Text>
          </Anim>
          <Anim a={{ y: [45, 0], opacity: [0, 1] }} range={[0.18, 0.52]}>
            <Text style={[s.lede, { color: c.bg, opacity: 0.82, textAlign: 'center', marginTop: tokens.space(6), alignSelf: 'center' }]}>
              Give your eyes a rest without giving up the book. Every page can feel like something
              you'd want to sit with.
            </Text>
          </Anim>
        </View>
      </View>
    </Stage>
  );
}

function ContactSection({ onOpen, onImport }: { onOpen: () => void; onImport: () => void }) {
  const { colors: c } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={{ paddingVertical: tokens.space(26), paddingHorizontal: tokens.space(6), backgroundColor: c.bg, alignItems: 'center' }}>
      <View style={{ maxWidth: 720, width: '100%', alignItems: 'center' }}>
        <Text style={[s.h1, { textAlign: 'center', fontSize: 44 }]}>Start listening.</Text>
        <Text style={[s.lede, { textAlign: 'center', marginTop: tokens.space(4), alignSelf: 'center' }]}>
          Your whole library, read aloud in a voice you'll actually want to hear.
        </Text>
        <View style={{ flexDirection: 'row', gap: tokens.space(3), marginTop: tokens.space(8), flexWrap: 'wrap', justifyContent: 'center' }}>
          <Pressable onPress={onOpen} style={s.ctaPrimary}>
            <Text style={s.ctaPrimaryText}>Open your library</Text>
          </Pressable>
          <Pressable onPress={onImport} style={s.ctaGhost}>
            <Text style={s.ctaGhostText}>Import a document</Text>
          </Pressable>
        </View>
        <View style={s.footer}>
          <Text style={s.footerBrand}>Sangyin · 聲音</Text>
          <Text style={s.faint}>Read slow. Listen deep.</Text>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------

const styles0 = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },

    progressTrack: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: 'transparent' },
    progressFill: { height: 3, backgroundColor: c.accent },

    switcher: {
      position: 'absolute',
      top: Platform.OS === 'web' ? 16 : 52,
      right: 14,
      flexDirection: 'row',
      gap: 4,
      padding: 4,
      borderRadius: 999,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      ...tokens.shadow,
    },
    pill: { paddingVertical: 7, paddingHorizontal: 13, borderRadius: 999 },
    pillOn: { backgroundColor: c.accent },
    pillText: { fontFamily: tokens.fonts.body, fontSize: 12.5, fontWeight: '600', color: c.textDim },
    pillTextOn: { color: c.onAccent },

    badge: {
      flexDirection: 'row', alignItems: 'center', gap: 9, alignSelf: 'flex-start',
      paddingVertical: 8, paddingHorizontal: 15, borderRadius: 999,
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
    },
    badgeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent },
    badgeText: { fontFamily: tokens.fonts.body, fontSize: 12, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase', color: c.accent },

    h1: { fontFamily: tokens.fonts.display, color: c.text, fontSize: 72, lineHeight: 68, letterSpacing: -2, fontWeight: '700', marginTop: tokens.space(6) },
    h1Accent: { color: c.accent, fontStyle: 'italic', fontWeight: '600' },
    lede: { fontFamily: tokens.fonts.body, color: c.textDim, fontSize: 19, lineHeight: 30, marginTop: tokens.space(6), maxWidth: 540 },

    scrollCue: { position: 'absolute', bottom: 30, alignSelf: 'center', alignItems: 'center', gap: 8 },
    scrollCueText: { fontFamily: tokens.fonts.body, fontSize: 11, letterSpacing: 3, color: c.faint },
    scrollCueLine: { width: 1, height: 34, backgroundColor: c.faint, opacity: 0.6 },

    kicker: { fontFamily: tokens.fonts.body, fontSize: 12, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase', color: c.accent, textAlign: 'center', marginBottom: tokens.space(6) },
    h2: { fontFamily: tokens.fonts.display, color: c.text, fontSize: 44, letterSpacing: -1.2, fontWeight: '700' },
    h2Center: { fontFamily: tokens.fonts.display, color: c.text, fontSize: 34, lineHeight: 42, letterSpacing: -0.8, fontWeight: '500', textAlign: 'center', alignSelf: 'center', maxWidth: 620 },
    faint: { fontFamily: tokens.fonts.body, fontSize: 13, color: c.faint },

    cardRow: { gap: tokens.space(5), marginTop: tokens.space(12) },
    card: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: tokens.radius + 2, padding: tokens.space(6), ...tokens.shadow },
    cardIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: c.accent, marginBottom: tokens.space(4) },
    cardTitle: { fontFamily: tokens.fonts.display, color: c.text, fontSize: 20, fontWeight: '600', letterSpacing: -0.3, marginBottom: 7 },
    cardBody: { fontFamily: tokens.fonts.body, color: c.textDim, fontSize: 14.5, lineHeight: 23 },

    stepGrid: { gap: tokens.space(5), marginTop: tokens.space(12), justifyContent: 'space-between' },
    step: { flexDirection: 'row', gap: tokens.space(4), alignItems: 'flex-start', backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: tokens.radius + 2, padding: tokens.space(6), ...tokens.shadow },
    stepNum: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
    stepNumText: { fontFamily: tokens.fonts.display, color: c.onAccent, fontSize: 19, fontWeight: '700' },

    workCard: { width: 320, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: tokens.radius + 6, overflow: 'hidden', ...tokens.shadow },
    workShot: { height: 200, justifyContent: 'flex-end', padding: tokens.space(4) },
    workShotTag: { alignSelf: 'flex-start', fontFamily: tokens.fonts.body, fontSize: 11, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', color: c.accentDeep, backgroundColor: c.surface, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, overflow: 'hidden' },
    workTitle: { fontFamily: tokens.fonts.display, color: c.text, fontSize: 21, fontWeight: '600', letterSpacing: -0.3, padding: tokens.space(6) },

    ctaPrimary: { backgroundColor: c.accent, paddingVertical: 16, paddingHorizontal: 32, borderRadius: tokens.radius, ...tokens.shadow },
    ctaPrimaryText: { fontFamily: tokens.fonts.body, color: c.onAccent, fontSize: 16, fontWeight: '600' },
    ctaGhost: { paddingVertical: 16, paddingHorizontal: 32, borderRadius: tokens.radius, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
    ctaGhostText: { fontFamily: tokens.fonts.body, color: c.text, fontSize: 16, fontWeight: '600' },

    footer: { marginTop: tokens.space(20), paddingTop: tokens.space(8), borderTopWidth: 1, borderTopColor: c.border, width: '100%', flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
    footerBrand: { fontFamily: tokens.fonts.display, color: c.text, fontSize: 15, fontWeight: '700' },
  });
