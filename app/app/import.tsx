import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { Muted, Screen } from '../src/components/ui';
import { BevelButton, SegmentedControl, Window } from '../src/components/retro';
import { Marquee } from '../src/fx/Marquee';
import { sfx } from '../src/sfx/sfx';
import { useApi } from '../src/store/appStore';
import { Palette, tokens, useRetro, useTheme } from '../src/theme';

type Tab = 'paste' | 'url' | 'file';

const BUSY_LABEL: Record<Tab, string> = {
  paste: 'Preparing your document…',
  url: 'Fetching and cleaning the article…',
  file: 'Reading and extracting your file…',
};

export default function ImportScreen() {
  const api = useApi();
  const router = useRouter();
  const r = useRetro();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, r.mono, isDark), [colors, r.mono, isDark]);
  const inset = r.bevel('inset');
  const insetBorder = {
    borderTopColor: inset.borderTopColor,
    borderLeftColor: inset.borderLeftColor,
    borderBottomColor: inset.borderBottomColor,
    borderRightColor: inset.borderRightColor,
    borderWidth: 1, // simplified to 1px for premium look
  };

  const [tab, setTab] = useState<Tab>('paste');
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cardScale = useSharedValue(0.88);
  const cardOpacity = useSharedValue(0);

  useEffect(() => {
    if (busy) {
      cardScale.value = withSpring(1, { stiffness: 320, damping: 26 });
      cardOpacity.value = withTiming(1, { duration: 150 });
    } else {
      cardScale.value = 0.88;
      cardOpacity.value = 0;
    }
  }, [busy]);

  const overlayCardAnim = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
    opacity: cardOpacity.value,
    maxWidth: 360,
    width: '100%',
  }));

  const open = (id: string) => router.replace({ pathname: '/reader', params: { id } });

  const run = async (fn: () => Promise<{ id: string }>) => {
    setBusy(true);
    setError(null);
    try {
      const doc = await fn();
      sfx.play('confirm');
      open(doc.id);
    } catch (e: any) {
      setError(e?.message ?? 'Import failed.');
    } finally {
      setBusy(false);
    }
  };

  const pickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'application/epub+zip',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
      ],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    run(() =>
      api.importFile({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? undefined,
        webFile: (asset as any).file,
      }),
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LinearGradient
        colors={[colors.bg, colors.bgAlt]}
        style={StyleSheet.absoluteFill}
      />
      
      <View style={styles.toolbar}>
        <BevelButton title="← Library" variant="ghost" onPress={() => router.push('/library')} style={{ alignSelf: 'flex-start' }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: tokens.space(5), gap: tokens.space(6), paddingBottom: tokens.space(10) }}>
        <Text style={styles.pageTitle}>Import</Text>
        <SegmentedControl<Tab>
          segments={[
            { value: 'paste', label: 'Paste text' },
            { value: 'url', label: 'Article URL' },
            { value: 'file', label: 'File' },
          ]}
          value={tab}
          onChange={setTab}
        />

        {error ? <Muted style={{ color: colors.danger }}>{error}</Muted> : null}

        {tab === 'paste' && (
          <Window title="PASTE.TXT" dots>
            <Text style={styles.label}>Title (optional)</Text>
            <TextInput
              style={[styles.input, insetBorder]}
              value={title}
              onChangeText={setTitle}
              placeholder="My document"
              placeholderTextColor={colors.textDim}
            />
            <Text style={[styles.label, { marginTop: 16 }]}>Text</Text>
            <TextInput
              style={[styles.input, styles.multiline, insetBorder]}
              value={text}
              onChangeText={setText}
              placeholder="Paste or type the text you want read aloud…"
              placeholderTextColor={colors.textDim}
              multiline
            />
            <BevelButton
              title="Import & open"
              onPress={() => run(() => api.importText(text, title || undefined))}
              disabled={!text.trim()}
              loading={busy}
              style={{ marginTop: 24 }}
            />
          </Window>
        )}

        {tab === 'url' && (
          <Window title="FETCH.URL" dots>
            <Text style={styles.label}>Article URL</Text>
            <TextInput
              style={[styles.input, insetBorder]}
              value={url}
              onChangeText={setUrl}
              placeholder="https://example.com/article"
              placeholderTextColor={colors.textDim}
              autoCapitalize="none"
              keyboardType="url"
            />
            <Muted style={{ marginTop: 12 }}>
              The backend fetches the page and extracts clean readable text (strips nav and ads).
            </Muted>
            <BevelButton
              title="Fetch & open"
              onPress={() => run(() => api.importUrl(url.trim()))}
              disabled={!url.trim()}
              loading={busy}
              style={{ marginTop: 24 }}
            />
          </Window>
        )}

        {tab === 'file' && (
          <Window title="OPEN.FILE" dots>
            <Pressable onPress={pickFile} disabled={busy} style={styles.drop}>
              <View style={[styles.corner, styles.cTL]} />
              <View style={[styles.corner, styles.cTR]} />
              <View style={[styles.corner, styles.cBL]} />
              <View style={[styles.corner, styles.cBR]} />
              <Text style={styles.dropGlyph}>＋</Text>
              <Text style={styles.dropBig}>Drop a book onto the shelf</Text>
              <Text style={styles.dropSmall}>PDF · EPUB · DOCX · TXT</Text>
            </Pressable>
            <BevelButton title="Choose file…" onPress={pickFile} loading={busy} style={{ marginTop: 20, alignSelf: 'flex-start' }} />
          </Window>
        )}
      </ScrollView>

      {busy && (
        <View style={[styles.overlay, { pointerEvents: 'auto' }]}>
          <Animated.View style={overlayCardAnim}>
          <Window title="PROCESSING" bodyStyle={{ alignItems: 'center', gap: 16 }}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.overlayText}>{BUSY_LABEL[tab]}</Text>
            <View style={styles.barberWrap}>
              <Marquee speedPxPerSec={60}>
                <Text style={styles.barber}>▓▒░ WORKING ░▒▓ ▓▒░ WORKING ░▒▓ ▓▒░ WORKING ░▒▓ </Text>
              </Marquee>
            </View>
            <Muted style={{ textAlign: 'center' }}>Large documents can take a few moments.</Muted>
          </Window>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const makeStyles = (c: Palette, mono: string, isDark: boolean) =>
  StyleSheet.create({
    toolbar: { padding: tokens.space(5), paddingBottom: 0 },
    pageTitle: { fontFamily: tokens.fonts.display, color: c.text, fontSize: 32, fontWeight: '800', letterSpacing: -1 },
    label: { fontFamily: tokens.fonts.body, color: c.text, fontSize: 14, fontWeight: '700', letterSpacing: 0.1 },
    input: {
      marginTop: 8,
      backgroundColor: c.surfaceAlt,
      color: c.text,
      borderRadius: tokens.radiusSm,
      padding: 14,
      fontFamily: tokens.fonts.body,
      fontSize: 16,
      borderColor: c.border,
      ...tokens.shadowRaised,
    },
    multiline: { minHeight: 200, textAlignVertical: 'top' },
    drop: {
      position: 'relative',
      borderRadius: tokens.radius,
      backgroundColor: c.surfaceAlt,
      paddingVertical: 44,
      paddingHorizontal: 20,
      alignItems: 'center',
      gap: 8,
    },
    corner: {
      position: 'absolute',
      width: 20,
      height: 20,
      borderColor: c.accent,
      opacity: 0.55,
    },
    cTL: { top: 10, left: 10, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 3 },
    cTR: { top: 10, right: 10, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 3 },
    cBL: { bottom: 10, left: 10, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 3 },
    cBR: { bottom: 10, right: 10, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 3 },
    dropGlyph: { fontSize: 32, color: c.faint, fontWeight: '700' },
    dropBig: { fontFamily: tokens.fonts.display, color: c.text, fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
    dropSmall: { fontFamily: mono, color: c.faint, fontSize: 12, letterSpacing: 0.6 },
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
      padding: tokens.space(6),
      backgroundColor: c.bg + 'F2', // highly opaque
    },
    overlayText: {
      fontFamily: tokens.fonts.display,
      color: c.text,
      fontSize: 18,
      fontWeight: '700',
      letterSpacing: -0.3,
      textAlign: 'center',
    },
    barberWrap: { width: '100%', borderRadius: tokens.radiusChrome, overflow: 'hidden' },
    barber: { fontFamily: mono, color: c.accent, fontSize: 13, letterSpacing: 1 },
  });
