import { useFocusEffect, useRouter } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import {
  LayoutChangeEvent,
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
  useScrollViewOffset,
} from 'react-native-reanimated';

import { DocumentSummary } from '../src/api/types';
import { useApi, useAppStore } from '../src/store/appStore';
import { Palette, THEME_LABELS, tokens, useTheme } from '../src/theme';

// ---------------------------------------------------------------------------
// Scroll context — the vertical offset (shared value) + viewport height, so any
// nested animated block can drive itself off the page scroll. Sections publish
// their own content-relative Y so reveals fire as they enter the viewport.
// ---------------------------------------------------------------------------

const ScrollCtx = createContext<{ scrollY: SharedValue<number>; vh: number }>(
  null as any,
);
const SectionYCtx = createContext<number>(0);

/** A full-bleed section that publishes its Y offset for child reveals. */
function Section({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const [y, setY] = useState(0);
  return (
    <View onLayout={(e: LayoutChangeEvent) => setY(e.nativeEvent.layout.y)} style={style}>
      <SectionYCtx.Provider value={y}>{children}</SectionYCtx.Provider>
    </View>
  );
}

/** Fades + lifts its children into place as they scroll into view. */
function Reveal({
  children,
  from = 48,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  from?: number;
  delay?: number;
  style?: ViewStyle;
}) {
  const { scrollY, vh } = useContext(ScrollCtx);
  const baseY = useContext(SectionYCtx);
  const [localY, setLocalY] = useState(0);
  const absY = baseY + localY;
  const aStyle = useAnimatedStyle(() => {
    const start = absY - vh * 0.9 + delay;
    const end = absY - vh * 0.42 + delay;
    const p = interpolate(scrollY.value, [start, end], [0, 1], Extrapolation.CLAMP);
    return { opacity: p, transform: [{ translateY: (1 - p) * from }] };
  });
  return (
    <Animated.View onLayout={(e) => setLocalY(e.nativeEvent.layout.y)} style={[style, aStyle]}>
      {children}
    </Animated.View>
  );
}

/** A floating hero shape that parallaxes (and optionally rotates) on scroll. */
function Blob({
  style,
  translate,
  rotate,
}: {
  style: ViewStyle;
  translate: [number, number];
  rotate?: [number, number];
}) {
  const { scrollY, vh } = useContext(ScrollCtx);
  const aStyle = useAnimatedStyle(() => {
    const ty = interpolate(scrollY.value, [0, vh], translate, Extrapolation.CLAMP);
    const transform: any[] = [{ translateY: ty }];
    if (rotate) {
      const r = interpolate(scrollY.value, [0, vh], rotate, Extrapolation.CLAMP);
      transform.push({ rotate: `${r}deg` });
    }
    return { transform };
  });
  return <Animated.View pointerEvents="none" style={[style, aStyle]} />;
}

// ---------------------------------------------------------------------------

export default function LandingScreen() {
  const router = useRouter();
  const api = useApi();
  const theme = useTheme();
  const c = theme.colors;
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

  // Top scroll-progress bar (numeric width in px so it animates on native too).
  const progressStyle = useAnimatedStyle(() => {
    const p = interpolate(scrollY.value, [0, Math.max(1, contentH - vh)], [0, 1], Extrapolation.CLAMP);
    return { width: p * vw };
  });

  return (
    <View style={styles.root}>
      <ScrollCtx.Provider value={{ scrollY, vh }}>
        <Animated.ScrollView
          ref={scrollRef}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={(_w, h) => setContentH(h)}
        >
          <HeroSection />
          <ApproachSection />
          <GallerySection docs={docs} onOpen={(id) => router.push({ pathname: '/reader', params: { id } })} />
          <StatementSection />
          <ContactSection onOpen={() => router.push('/library')} onImport={() => router.push('/import')} />
        </Animated.ScrollView>
      </ScrollCtx.Provider>

      {/* fixed scroll-progress bar */}
      <View pointerEvents="none" style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, progressStyle]} />
      </View>

      {/* fixed theme switcher */}
      <View style={styles.switcher}>
        {THEME_LABELS.map((t) => {
          const on = t.name === themeName;
          return (
            <Pressable
              key={t.name}
              onPress={() => setThemeName(t.name)}
              style={[styles.pill, on && styles.pillOn]}
            >
              <Text style={[styles.pillText, on && styles.pillTextOn]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function HeroSection() {
  const { colors: c } = useTheme();
  const { height: vh } = useWindowDimensions();
  const s = useMemo(() => makeStyles(c), [c]);
  return (
    <Section style={{ minHeight: vh, justifyContent: 'center', paddingHorizontal: tokens.space(6), paddingVertical: tokens.space(10), overflow: 'hidden' }}>
      <Blob
        translate={[0, -90]}
        style={{ position: 'absolute', top: -60, right: -60, width: 300, height: 300, borderRadius: 150, backgroundColor: c.accent, opacity: 0.55 }}
      />
      <Blob
        translate={[0, 70]}
        style={{ position: 'absolute', bottom: -50, left: -70, width: 240, height: 240, borderRadius: 120, backgroundColor: c.warm, opacity: 0.4 }}
      />
      <Blob
        translate={[0, -130]}
        rotate={[-12, 8]}
        style={{ position: 'absolute', top: '18%', left: '8%', width: 96, height: 96, borderRadius: 26, backgroundColor: c.accentDeep, opacity: 0.7 }}
      />
      <Blob
        translate={[0, 100]}
        rotate={[14, -14]}
        style={{ position: 'absolute', bottom: '14%', right: '12%', width: 64, height: 64, borderRadius: 18, backgroundColor: c.warm, opacity: 0.6 }}
      />

      <View style={{ maxWidth: 720, width: '100%', alignSelf: 'center' }}>
        <Reveal from={20}>
          <View style={s.badge}>
            <View style={s.badgeDot} />
            <Text style={s.badgeText}>Sangyin · 聲音</Text>
          </View>
        </Reveal>
        <Reveal delay={20}>
          <Text style={s.h1}>
            Read slow,{'\n'}listen <Text style={s.h1Accent}>deep.</Text>
          </Text>
        </Reveal>
        <Reveal delay={40}>
          <Text style={s.lede}>
            Turn any book, paper, or article into calm, natural narration — grounded voices, your
            pace, picking up right where you left off.
          </Text>
        </Reveal>
      </View>

      <View style={s.scrollCue}>
        <Text style={s.scrollCueText}>SCROLL</Text>
        <View style={s.scrollCueLine} />
      </View>
    </Section>
  );
}

const APPROACH = [
  { title: 'Natural voices', body: 'Warm, human-sounding narration from a local neural engine — many voices, no robotic edge.' },
  { title: 'Any document', body: 'PDFs, EPUBs, DOCX, plain text, or a pasted article URL. Drop it in and press play.' },
  { title: 'Yours, offline', body: 'Audio is cached as you listen, so you can resume anywhere — even without a connection.' },
];

function ApproachSection() {
  const { colors: c } = useTheme();
  const { width: vw } = useWindowDimensions();
  const s = useMemo(() => makeStyles(c), [c]);
  const twoCol = vw > 720;
  return (
    <Section style={{ paddingVertical: tokens.space(24), paddingHorizontal: tokens.space(6), backgroundColor: c.bg }}>
      <View style={{ maxWidth: 1000, width: '100%', alignSelf: 'center' }}>
        <Reveal from={30}>
          <Text style={s.kicker}>— How it works</Text>
        </Reveal>
        <Reveal delay={20}>
          <Text style={s.h2Center}>
            We make reading feel <Text style={{ color: c.accent }}>grounded</Text> — the way a good
            tool feels in the hand.
          </Text>
        </Reveal>
        <View style={[s.cardRow, { flexDirection: twoCol ? 'row' : 'column' }]}>
          {APPROACH.map((a, i) => (
            <Reveal key={a.title} delay={i * 40} from={60} style={{ flex: twoCol ? 1 : undefined }}>
              <View style={s.card}>
                <View style={[s.cardIcon, i === 1 && { backgroundColor: c.warm }, i === 2 && { backgroundColor: c.accentDeep }]} />
                <Text style={s.cardTitle}>{a.title}</Text>
                <Text style={s.cardBody}>{a.body}</Text>
              </View>
            </Reveal>
          ))}
        </View>
      </View>
    </Section>
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

function GallerySection({ docs, onOpen }: { docs: DocumentSummary[]; onOpen: (id: string) => void }) {
  const { colors: c } = useTheme();
  const { scrollY, vh } = useContext(ScrollCtx);
  const baseY = useContext(SectionYCtx) as number;
  const { width: vw } = useWindowDimensions();
  const s = useMemo(() => makeStyles(c), [c]);

  const [localY, setLocalY] = useState(0);
  const [trackW, setTrackW] = useState(0);
  const absY = baseY + localY;
  const maxShift = Math.max(0, trackW - vw + tokens.space(6));

  // Pan the track horizontally as the section passes through the viewport.
  const trackStyle = useAnimatedStyle(() => {
    const p = interpolate(scrollY.value, [absY - vh * 0.6, absY + vh * 0.6], [0, 1], Extrapolation.CLAMP);
    return { transform: [{ translateX: -maxShift * p }] };
  });

  const cards = docs.length
    ? docs.map((d) => ({ id: d.id, title: d.title, tag: SOURCE_LABEL[d.source_type] ?? d.source_type }))
    : PLACEHOLDER.map((p, i) => ({ id: `ph-${i}`, title: p.title, tag: p.tag }));

  return (
    <View onLayout={(e) => setLocalY(e.nativeEvent.layout.y)}>
      <Section style={{ paddingVertical: tokens.space(20), backgroundColor: c.bgAlt, overflow: 'hidden' }}>
        <View style={{ maxWidth: 1000, alignSelf: 'center', width: '100%', paddingHorizontal: tokens.space(6), flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <Text style={s.h2}>Your shelf</Text>
          <Text style={s.faint}>scroll to pan →</Text>
        </View>
        <View style={{ overflow: 'hidden', marginTop: tokens.space(6) }}>
          <Animated.View
            onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
            style={[{ flexDirection: 'row', gap: tokens.space(6), paddingHorizontal: tokens.space(6) }, trackStyle]}
          >
            {cards.map((card, i) => (
              <Pressable
                key={card.id}
                disabled={card.id.startsWith('ph-')}
                onPress={() => onOpen(card.id)}
                style={s.workCard}
              >
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
      </Section>
    </View>
  );
}

function StatementSection() {
  const { colors: c } = useTheme();
  const { scrollY, vh } = useContext(ScrollCtx);
  const baseY = useContext(SectionYCtx) as number;
  const [localY, setLocalY] = useState(0);
  const s = useMemo(() => makeStyles(c), [c]);
  const absY = baseY + localY;

  const orbStyle = useAnimatedStyle(() => {
    const t = interpolate(scrollY.value, [absY - vh, absY + vh], [0.5, 2.1], Extrapolation.CLAMP);
    const o = interpolate(scrollY.value, [absY - vh, absY + vh], [0.5, 0.14], Extrapolation.CLAMP);
    return { opacity: o, transform: [{ scale: t }] };
  });

  return (
    <View onLayout={(e) => setLocalY(e.nativeEvent.layout.y)}>
      <Section
        style={{ minHeight: vh * 0.9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: tokens.space(6), backgroundColor: c.text, overflow: 'hidden' }}
      >
        <Animated.View
          pointerEvents="none"
          style={[{ position: 'absolute', width: 420, height: 420, borderRadius: 210, backgroundColor: c.accent }, orbStyle]}
        />
        <View style={{ maxWidth: 720, alignItems: 'center' }}>
          <Reveal from={40}>
            <Text style={[s.h2Center, { color: c.bg }]}>Listening is a kind of reading.</Text>
          </Reveal>
          <Reveal delay={30}>
            <Text style={[s.lede, { color: c.bg, opacity: 0.82, textAlign: 'center', marginTop: tokens.space(6) }]}>
              Give your eyes a rest without giving up the book. Every page can feel like something
              you'd want to sit with.
            </Text>
          </Reveal>
        </View>
      </Section>
    </View>
  );
}

function ContactSection({ onOpen, onImport }: { onOpen: () => void; onImport: () => void }) {
  const { colors: c } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  return (
    <Section style={{ paddingVertical: tokens.space(28), paddingHorizontal: tokens.space(6), backgroundColor: c.bg, alignItems: 'center' }}>
      <View style={{ maxWidth: 720, width: '100%', alignItems: 'center' }}>
        <Reveal>
          <Text style={[s.h1, { textAlign: 'center', fontSize: 44 }]}>Start listening.</Text>
        </Reveal>
        <Reveal delay={20}>
          <Text style={[s.lede, { textAlign: 'center', marginTop: tokens.space(4) }]}>
            Your whole library, read aloud in a voice you'll actually want to hear.
          </Text>
        </Reveal>
        <Reveal delay={40} style={{ flexDirection: 'row', gap: tokens.space(3), marginTop: tokens.space(8), flexWrap: 'wrap', justifyContent: 'center' }}>
          <Pressable onPress={onOpen} style={s.ctaPrimary}>
            <Text style={s.ctaPrimaryText}>Open your library</Text>
          </Pressable>
          <Pressable onPress={onImport} style={s.ctaGhost}>
            <Text style={s.ctaGhostText}>Import a document</Text>
          </Pressable>
        </Reveal>
        <View style={s.footer}>
          <Text style={s.footerBrand}>Sangyin · 聲音</Text>
          <Text style={s.faint}>Read slow. Listen deep.</Text>
        </View>
      </View>
    </Section>
  );
}

// ---------------------------------------------------------------------------

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
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      alignSelf: 'flex-start',
      paddingVertical: 8,
      paddingHorizontal: 15,
      borderRadius: 999,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
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
