import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Muted, Screen } from '../src/components/ui';
import { BevelButton, SegmentedControl, Window } from '../src/components/retro';
import { Marquee } from '../src/fx/Marquee';
import { sfx } from '../src/sfx/sfx';
import { useApi } from '../src/store/appStore';
import { Palette, tokens, useRetro } from '../src/theme';

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
  const { colors } = r;
  const styles = useMemo(() => makeStyles(colors, r.mono), [colors, r.mono]);
  const inset = r.bevel('inset');
  const insetBorder = {
    borderTopColor: inset.borderTopColor,
    borderLeftColor: inset.borderLeftColor,
    borderBottomColor: inset.borderBottomColor,
    borderRightColor: inset.borderRightColor,
    borderWidth: inset.borderWidth,
  };

  const [tab, setTab] = useState<Tab>('paste');
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      api.importFile({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? undefined }),
    );
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: tokens.space(4) }}>
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
            <Text style={[styles.label, { marginTop: 14 }]}>Text</Text>
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
              style={{ marginTop: 16 }}
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
            <Muted style={{ marginTop: 8 }}>
              The backend fetches the page and extracts clean readable text (strips nav and ads).
            </Muted>
            <BevelButton
              title="Fetch & open"
              onPress={() => run(() => api.importUrl(url.trim()))}
              disabled={!url.trim()}
              loading={busy}
              style={{ marginTop: 16 }}
            />
          </Window>
        )}

        {tab === 'file' && (
          <Window title="OPEN.FILE" dots>
            <Text style={styles.label}>Upload a document</Text>
            <Muted style={{ marginTop: 6 }}>Supported: PDF, EPUB, DOCX, and .txt files.</Muted>
            <BevelButton title="Choose file…" onPress={pickFile} loading={busy} style={{ marginTop: 16, alignSelf: 'flex-start' }} />
          </Window>
        )}
      </ScrollView>

      {busy && (
        <View style={[styles.overlay, { pointerEvents: 'auto' }]}>
          <Window title="PROCESSING" style={styles.overlayCard} bodyStyle={{ alignItems: 'center', gap: 14 }}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.overlayText}>{BUSY_LABEL[tab]}</Text>
            <View style={styles.barberWrap}>
              <Marquee speedPxPerSec={60}>
                <Text style={styles.barber}>▓▒░ WORKING ░▒▓ ▓▒░ WORKING ░▒▓ ▓▒░ WORKING ░▒▓ </Text>
              </Marquee>
            </View>
            <Muted style={{ textAlign: 'center' }}>Large documents can take a few moments.</Muted>
          </Window>
        </View>
      )}
    </Screen>
  );
}

const makeStyles = (c: Palette, mono: string) =>
  StyleSheet.create({
    label: { fontFamily: mono, color: c.text, fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },
    input: {
      marginTop: 6,
      backgroundColor: c.surfaceAlt,
      color: c.text,
      borderRadius: tokens.radiusChrome,
      padding: 12,
      fontFamily: tokens.fonts.body,
      fontSize: 15,
    },
    multiline: { minHeight: 180, textAlignVertical: 'top' },
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
      padding: tokens.space(6),
      backgroundColor: c.bg + 'E6',
    },
    overlayCard: { maxWidth: 340, width: '100%' },
    overlayText: {
      fontFamily: tokens.fonts.display,
      color: c.text,
      fontSize: 17,
      fontWeight: '600',
      letterSpacing: -0.2,
      textAlign: 'center',
    },
    barberWrap: { width: '100%', borderRadius: tokens.radiusChrome, overflow: 'hidden' },
    barber: { fontFamily: mono, color: c.accent, fontSize: 13, letterSpacing: 1 },
  });
