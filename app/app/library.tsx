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

import { DocumentSummary } from '../src/api/types';
import { Muted, Screen } from '../src/components/ui';
import { BevelButton, Window } from '../src/components/retro';
import { sfx } from '../src/sfx/sfx';
import { useApi, useAppStore } from '../src/store/appStore';
import { Palette, tokens, useRetro } from '../src/theme';

const SOURCE_LABEL: Record<string, string> = {
  pdf: 'PDF', epub: 'EPUB', docx: 'DOCX', txt: 'TXT', text: 'PASTE', url: 'WEB',
};

// Earthy spine colours — a real shelf is many muted volumes, not one hue.
const SPINES: { bg: string; ink: string }[] = [
  { bg: '#5F6B44', ink: '#ECEBE0' },
  { bg: '#8A4630', ink: '#F7EFE3' },
  { bg: '#414A32', ink: '#ECEBE0' },
  { bg: '#7C6A55', ink: '#F4EFE6' },
  { bg: '#556052', ink: '#ECEBE0' },
  { bg: '#9A5B3F', ink: '#F7EFE3' },
  { bg: '#6B5B4A', ink: '#ECEBE0' },
  { bg: '#8A6D3B', ink: '#F7EFE3' },
];

const SPINE_W = 58;
const SPINE_H = 208;
const GAP = tokens.space(2);

export default function LibraryScreen() {
  const api = useApi();
  const router = useRouter();
  const r = useRetro();
  const { colors } = r;
  const styles = useMemo(() => makeStyles(colors, r.mono), [colors, r.mono]);
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

  // The single most-recently-opened book wears the brass "currently reading" band.
  const currentId = useMemo(() => {
    let best: string | null = null;
    let bestAt = -1;
    for (const [id, p] of Object.entries(positions)) {
      if (p.updatedAt > bestAt) { bestAt = p.updatedAt; best = id; }
    }
    return best;
  }, [positions]);

  // Books-per-shelf from the viewport, so the wall reflows like a real bookcase.
  const inner = Math.min(width, 1000) - tokens.space(8);
  const perRow = Math.max(1, Math.floor((inner + GAP) / (SPINE_W + GAP)));
  const rows = useMemo(() => {
    const out: DocumentSummary[][] = [];
    for (let i = 0; i < docs.length; i += perRow) out.push(docs.slice(i, i + perRow));
    return out;
  }, [docs, perRow]);

  return (
    <Screen style={{ padding: 0 }}>
      <View style={styles.toolbar}>
        <BevelButton title="+ Import" onPress={() => router.push('/import')} style={{ flex: 1 }} />
        <BevelButton title="Settings" variant="ghost" onPress={() => router.push('/settings')} style={{ flex: 1 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: tokens.space(4), paddingBottom: tokens.space(8) }}>
        {error ? (
          <Window title="⚠ CONNECTION" close onClose={() => setError(null)} style={{ marginBottom: tokens.space(4) }}>
            <Text style={styles.errTitle}>Backend not reachable</Text>
            <Muted>{error}</Muted>
            <Muted style={{ marginTop: 6 }}>Configured URL: {backendUrl}</Muted>
            <BevelButton title="Retry" variant="ghost" onPress={load} style={{ marginTop: 12, alignSelf: 'flex-start' }} />
          </Window>
        ) : null}

        {!loading && !error && docs.length === 0 ? (
          <Window title="LIBRARY.EMPTY" dots>
            <Text style={styles.emptyTitle}>Your shelf is empty</Text>
            <Muted style={{ marginTop: 6 }}>
              Import a PDF, EPUB, DOCX, text file, an article URL, or pasted text to start listening.
            </Muted>
            <BevelButton title="Import a document" onPress={() => router.push('/import')} style={{ marginTop: 14, alignSelf: 'flex-start' }} />
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
    </Screen>
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
  const lift = hovered && Platform.OS === 'web' ? { transform: [{ translateY: -14 }] } : null;
  return (
    <Pressable
      onPress={onOpen}
      onLongPress={onRemove}
      delayLongPress={450}
      // @ts-ignore — onHoverIn/onHoverOut are web-only Pressable props (react-native-web).
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[
        styles.spine,
        { backgroundColor: palette.bg },
        current && { borderColor: '#C79A5B', borderWidth: 2 },
        lift,
      ]}
    >
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
  );
}

const makeStyles = (c: Palette, mono: string) =>
  StyleSheet.create({
    toolbar: { flexDirection: 'row', gap: tokens.space(3), padding: tokens.space(4), paddingBottom: 0 },
    errTitle: { fontFamily: tokens.fonts.display, color: c.danger, fontSize: 17, fontWeight: '700', marginBottom: 4 },
    emptyTitle: { fontFamily: tokens.fonts.display, color: c.text, fontSize: 20, fontWeight: '600', letterSpacing: -0.3 },

    shelfHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: tokens.space(4) },
    shelfTitle: { fontFamily: tokens.fonts.display, color: c.text, fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
    shelfMeta: { fontFamily: mono, color: c.faint, fontSize: 11, letterSpacing: 0.4 },

    shelfRow: { marginBottom: tokens.space(6) },
    spineRow: { flexDirection: 'row', alignItems: 'flex-end', gap: GAP, minHeight: SPINE_H },
    board: {
      height: 12,
      borderRadius: 2,
      backgroundColor: c.warm,
      borderBottomWidth: 3,
      borderBottomColor: 'rgba(0,0,0,0.28)',
      marginTop: -1,
      ...tokens.shadow,
    },

    spine: {
      width: SPINE_W,
      height: SPINE_H,
      borderRadius: 3,
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'space-between',
      overflow: 'hidden',
      borderColor: 'rgba(0,0,0,0.25)',
      borderLeftWidth: 2,
    },
    spineTag: { fontFamily: mono, fontSize: 8, fontWeight: '700', letterSpacing: 1, opacity: 0.85 },
    spineTitleWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%', overflow: 'hidden' },
    // Rotated title: give the Text the *tall* dimension as its width, then turn it upright.
    spineTitle: {
      width: SPINE_H - 64,
      textAlign: 'center',
      transform: [{ rotate: '-90deg' }],
      fontFamily: tokens.fonts.display,
      fontSize: 13,
      fontWeight: '600',
      letterSpacing: 0.1,
    },
    spineNotch: { width: '78%', height: 3, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.28)', overflow: 'hidden' },
    spineNotchFill: { height: '100%', opacity: 0.9 },
  });
