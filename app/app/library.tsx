import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { DocumentSummary } from '../src/api/types';
import { Muted, Screen } from '../src/components/ui';
import { BevelButton, Window } from '../src/components/retro';
import { sfx } from '../src/sfx/sfx';
import { useApi, useAppStore } from '../src/store/appStore';
import { Palette, tokens, useRetro, useTheme } from '../src/theme';

const SOURCE_LABEL: Record<string, string> = {
  pdf: 'PDF', epub: 'EPUB', docx: 'DOCX', txt: 'TXT', text: 'PASTE', url: 'WEB',
};

// Premium earthy spine colours (more sophisticated shades)
const SPINES: { bg: string; ink: string }[] = [
  { bg: '#5F6B44', ink: '#FFFFFF' },
  { bg: '#8A4630', ink: '#FFFFFF' },
  { bg: '#4A5439', ink: '#FFFFFF' },
  { bg: '#8B7A66', ink: '#FFFFFF' },
  { bg: '#556052', ink: '#FFFFFF' },
  { bg: '#B36A49', ink: '#FFFFFF' },
  { bg: '#786857', ink: '#FFFFFF' },
  { bg: '#A38249', ink: '#FFFFFF' },
];

const SPINE_W = 62;
const SPINE_H = 220;
const GAP = tokens.space(3);

export default function LibraryScreen() {
  const api = useApi();
  const router = useRouter();
  const r = useRetro();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, r.mono, isDark), [colors, r.mono, isDark]);
  const positions = useAppStore((s) => s.positions);
  const backendUrl = useAppStore((s) => s.backendUrl);
  const { width } = useWindowDimensions();

  const [docs, setDocs] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDocs(await api.listDocuments());
    } catch (e: any) {
      setError(e?.message ?? 'Could not reach the backend.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const remove = async (id: string) => {
    sfx.play('back');
    await api.deleteDocument(id);
    load();
  };

  const currentId = useMemo(() => {
    let best: string | null = null;
    let bestAt = -1;
    for (const [id, p] of Object.entries(positions)) {
      if (p.updatedAt > bestAt) { bestAt = p.updatedAt; best = id; }
    }
    return best;
  }, [positions]);

  const inner = Math.min(width, 1000) - tokens.space(10);
  const perRow = Math.max(1, Math.floor((inner + GAP) / (SPINE_W + GAP)));
  const rows = useMemo(() => {
    const out: DocumentSummary[][] = [];
    for (let i = 0; i < docs.length; i += perRow) out.push(docs.slice(i, i + perRow));
    return out;
  }, [docs, perRow]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LinearGradient
        colors={[colors.bg, colors.bgAlt]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.toolbar}>
        <BevelButton title="+ Import" onPress={() => router.push('/import')} style={{ flex: 1 }} />
        <BevelButton title="Settings" variant="ghost" onPress={() => router.push('/settings')} style={{ flex: 1 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: tokens.space(5), paddingBottom: tokens.space(10) }}>
        {error ? (
          <Window title="CONNECTION" close onClose={() => setError(null)} style={{ marginBottom: tokens.space(6) }}>
            <Text style={styles.errTitle}>Backend not reachable</Text>
            <Muted style={{ fontSize: 16 }}>{error}</Muted>
            <Muted style={{ marginTop: 8, fontSize: 13 }}>Configured URL: {backendUrl}</Muted>
            <BevelButton title="Retry" variant="ghost" onPress={load} style={{ marginTop: 16, alignSelf: 'flex-start' }} />
          </Window>
        ) : null}

        {!loading && !error && docs.length === 0 ? (
          <Window title="LIBRARY" dots>
            <Text style={styles.emptyTitle}>Your shelf is empty</Text>
            <Muted style={{ marginTop: 8, fontSize: 16, lineHeight: 24, maxWidth: 400 }}>
              Import a PDF, EPUB, DOCX, text file, an article URL, or pasted text to start listening.
            </Muted>
            <BevelButton title="Import a document" onPress={() => router.push('/import')} style={{ marginTop: 24, alignSelf: 'flex-start' }} />
          </Window>
        ) : null}

        {docs.length > 0 ? (
          <>
            <View style={styles.shelfHead}>
              <Text style={styles.shelfTitle}>Your shelf</Text>
              <Text style={styles.shelfMeta}>{docs.length} {docs.length === 1 ? 'book' : 'books'} · long-press to remove</Text>
            </View>

            {rows.map((row, ri) => (
              <View key={ri} style={styles.shelfRow}>
                <View style={styles.spineRow}>
                  {row.map((item, ci) => {
                    const pos = positions[item.id];
                    const pct =
                      pos && item.n_sentences > 0
                        ? Math.min(100, Math.round(((pos.sentenceIndex + 1) / item.n_sentences) * 100))
                        : 0;
                    const idx = ri * perRow + ci;
                    return (
                      <Spine
                        key={item.id}
                        doc={item}
                        pct={pct}
                        palette={SPINES[idx % SPINES.length]}
                        current={item.id === currentId}
                        styles={styles}
                        onOpen={() => {
                          sfx.play('confirm');
                          router.push({ pathname: '/reader', params: { id: item.id } });
                        }}
                        onRemove={() => remove(item.id)}
                      />
                    );
                  })}
                </View>
                <View style={styles.board} />
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Spine({
  doc, pct, palette, current, styles, onOpen, onRemove,
}: {
  doc: DocumentSummary;
  pct: number;
  palette: { bg: string; ink: string };
  current: boolean;
  styles: ReturnType<typeof makeStyles>;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const tag = SOURCE_LABEL[doc.source_type] ?? doc.source_type.toUpperCase();
  const state = pct === 100 ? ' · finished' : pct > 0 ? ' · reading' : ' · new';
  
  const lift = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: lift.value }],
    };
  });

  return (
    <View style={[styles.spineWrap, { zIndex: hovered ? 50 : 1 }]}>
      <Animated.View style={animatedStyle}>
        <Pressable
          onPress={onOpen}
          onLongPress={onRemove}
          delayLongPress={450}
          onPressIn={() => { lift.value = withSpring(-4, { damping: 15 }); }}
          onPressOut={() => { lift.value = withSpring(hovered && Platform.OS === 'web' ? -16 : 0, { damping: 15 }); }}
          // @ts-ignore
          onHoverIn={() => { setHovered(true); lift.value = withSpring(-12, { damping: 11, stiffness: 180, mass: 0.7 }); }}
          // @ts-ignore
          onHoverOut={() => { setHovered(false); lift.value = withSpring(0, { damping: 18, stiffness: 260 }); }}
          style={[
            styles.spine,
            { backgroundColor: palette.bg },
            current && { borderColor: '#C79A5B', borderWidth: 2 },
          ]}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.20)', 'rgba(0,0,0,0.15)']}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          
          <Text style={[styles.spineTag, { color: palette.ink }]} numberOfLines={1}>{tag}</Text>
          <View style={styles.spineTitleWrap}>
            <Text numberOfLines={1} style={[styles.spineTitle, { color: palette.ink }]}>
              {doc.title}
            </Text>
          </View>
          <View style={styles.spineNotch}>
            <View style={[styles.spineNotchFill, { width: `${pct}%`, backgroundColor: palette.ink }]} />
          </View>
        </Pressable>
      </Animated.View>

      {hovered && Platform.OS === 'web' ? (
        <View style={[styles.pop, { pointerEvents: 'none' }]}>
          <Text style={styles.popTag}>{tag}{state}</Text>
          <Text style={styles.popTitle} numberOfLines={2}>{doc.title}</Text>
          <View style={styles.popMeter}>
            <View style={[styles.popFill, { width: `${pct}%` }]} />
          </View>
          <Text style={styles.popRowText}>{pct}% read · tap to open</Text>
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (c: Palette, mono: string, isDark: boolean) =>
  StyleSheet.create({
    toolbar: { flexDirection: 'row', gap: tokens.space(4), padding: tokens.space(5), paddingBottom: 0 },
    errTitle: { fontFamily: tokens.fonts.display, color: c.danger, fontSize: 18, fontWeight: '700', marginBottom: 4 },
    emptyTitle: { fontFamily: tokens.fonts.display, color: c.text, fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },

    shelfHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: tokens.space(6) },
    shelfTitle: { fontFamily: tokens.fonts.display, color: c.text, fontSize: 32, fontWeight: '800', letterSpacing: -1 },
    shelfMeta: { fontFamily: mono, color: c.faint, fontSize: 13, letterSpacing: 0.5 },

    shelfRow: { marginBottom: tokens.space(8) },
    spineRow: { flexDirection: 'row', alignItems: 'flex-end', gap: GAP, minHeight: SPINE_H, zIndex: 10 },
    board: {
      height: 18,
      borderRadius: 3,
      backgroundColor: isDark ? '#3D2F23' : '#C4976A',
      borderBottomWidth: 5,
      borderBottomColor: 'rgba(0,0,0,0.45)',
      marginTop: -3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.22,
      shadowRadius: 14,
      elevation: 8,
    },

    spine: {
      width: SPINE_W,
      height: SPINE_H,
      borderRadius: 6,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'space-between',
      overflow: 'hidden',
      borderColor: 'rgba(0,0,0,0.2)',
      borderLeftWidth: 1,
      borderRightWidth: 1,
      ...tokens.shadowRaised,
    },
    spineTag: { fontFamily: mono, fontSize: 9, fontWeight: '800', letterSpacing: 1.2, opacity: 0.9 },
    spineTitleWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%', overflow: 'hidden' },
    spineTitle: {
      width: SPINE_H - 80,
      textAlign: 'center',
      transform: [{ rotate: '-90deg' }],
      fontFamily: tokens.fonts.serif,
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0.2,
      textShadowColor: 'rgba(0,0,0,0.3)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    spineNotch: { width: '72%', height: 5, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.35)', overflow: 'hidden' },
    spineNotchFill: { height: '100%', opacity: 1 },

    spineWrap: { position: 'relative' },
    pop: {
      position: 'absolute',
      bottom: '100%',
      left: (SPINE_W - 220) / 2,
      width: 220,
      marginBottom: 16,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      padding: 16,
      zIndex: 50,
      ...tokens.shadow,
    },
    popTag: { fontFamily: mono, color: c.accent, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
    popTitle: { fontFamily: tokens.fonts.display, color: c.text, fontSize: 17, fontWeight: '700', letterSpacing: -0.3, marginTop: 8, lineHeight: 22 },
    popMeter: { height: 6, borderRadius: 3, backgroundColor: c.surfaceAlt, overflow: 'hidden', marginTop: 12 },
    popFill: { height: '100%', backgroundColor: c.accent },
    popRowText: { fontFamily: mono, color: c.textDim, fontSize: 11, letterSpacing: 0.4, marginTop: 8 },
  });
