import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, Muted, Screen } from '../src/components/ui';
import { useApi } from '../src/store/appStore';
import { Palette, tokens, useTheme } from '../src/theme';

type Tab = 'paste' | 'url' | 'file';

const BUSY_LABEL: Record<Tab, string> = {
  paste: 'Preparing your document…',
  url: 'Fetching and cleaning the article…',
  file: 'Reading and extracting your file…',
};

export default function ImportScreen() {
  const api = useApi();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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
        <View style={styles.tabs}>
          {(['paste', 'url', 'file'] as Tab[]).map((t) => (
            <Button
              key={t}
              title={t === 'paste' ? 'Paste text' : t === 'url' ? 'Article URL' : 'File'}
              variant={tab === t ? 'primary' : 'ghost'}
              onPress={() => setTab(t)}
              style={{ flex: 1 }}
            />
          ))}
        </View>

        {error ? <Muted style={{ color: colors.danger }}>{error}</Muted> : null}

        {tab === 'paste' && (
          <Card>
            <Text style={styles.label}>Title (optional)</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="My document"
              placeholderTextColor={colors.textDim}
            />
            <Text style={[styles.label, { marginTop: 14 }]}>Text</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={text}
              onChangeText={setText}
              placeholder="Paste or type the text you want read aloud…"
              placeholderTextColor={colors.textDim}
              multiline
            />
            <Button
              title="Import & open"
              onPress={() => run(() => api.importText(text, title || undefined))}
              disabled={!text.trim()}
              loading={busy}
              style={{ marginTop: 16 }}
            />
          </Card>
        )}

        {tab === 'url' && (
          <Card>
            <Text style={styles.label}>Article URL</Text>
            <TextInput
              style={styles.input}
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
            <Button
              title="Fetch & open"
              onPress={() => run(() => api.importUrl(url.trim()))}
              disabled={!url.trim()}
              loading={busy}
              style={{ marginTop: 16 }}
            />
          </Card>
        )}

        {tab === 'file' && (
          <Card>
            <Text style={styles.label}>Upload a document</Text>
            <Muted style={{ marginTop: 6 }}>Supported: PDF, EPUB, DOCX, and .txt files.</Muted>
            <Button title="Choose file…" onPress={pickFile} loading={busy} style={{ marginTop: 16 }} />
          </Card>
        )}
      </ScrollView>

      {busy && (
        <View style={styles.overlay} pointerEvents="auto">
          <View style={styles.overlayCard}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.overlayText}>{BUSY_LABEL[tab]}</Text>
            <Muted style={{ marginTop: 4, textAlign: 'center' }}>
              Large documents can take a few moments.
            </Muted>
          </View>
        </View>
      )}
    </Screen>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    tabs: { flexDirection: 'row', gap: tokens.space(2) },
    label: { fontFamily: tokens.fonts.display, color: c.text, fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
    input: {
      marginTop: 6,
      backgroundColor: c.surfaceAlt,
      color: c.text,
      borderRadius: tokens.radiusSm,
      borderWidth: 1,
      borderColor: c.border,
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
      backgroundColor: c.bg + 'E6',
    },
    overlayCard: {
      alignItems: 'center',
      gap: 14,
      padding: tokens.space(8),
      borderRadius: tokens.radius,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      maxWidth: 320,
      ...tokens.shadow,
    },
    overlayText: {
      fontFamily: tokens.fonts.display,
      color: c.text,
      fontSize: 17,
      fontWeight: '600',
      letterSpacing: -0.2,
      textAlign: 'center',
    },
  });
