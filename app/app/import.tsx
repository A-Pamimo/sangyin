import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, Muted, Screen } from '../src/components/ui';
import { useApi } from '../src/store/appStore';
import { theme } from '../src/theme';

type Tab = 'paste' | 'url' | 'file';

export default function ImportScreen() {
  const api = useApi();
  const router = useRouter();

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
      <ScrollView contentContainerStyle={{ gap: theme.space(4) }}>
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

        {error ? <Muted style={{ color: theme.colors.danger }}>{error}</Muted> : null}

        {tab === 'paste' && (
          <Card>
            <Text style={styles.label}>Title (optional)</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="My document"
              placeholderTextColor={theme.colors.textDim}
            />
            <Text style={[styles.label, { marginTop: 14 }]}>Text</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={text}
              onChangeText={setText}
              placeholder="Paste or type the text you want read aloud…"
              placeholderTextColor={theme.colors.textDim}
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
              placeholderTextColor={theme.colors.textDim}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: theme.space(2) },
  label: { color: theme.colors.text, fontSize: 14, fontWeight: '600' },
  input: {
    marginTop: 6,
    backgroundColor: theme.colors.surfaceAlt,
    color: theme.colors.text,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
    fontSize: 15,
  },
  multiline: { minHeight: 180, textAlignVertical: 'top' },
});
