import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { DocumentSummary } from '../src/api/types';
import { Button, Card, Muted, Screen } from '../src/components/ui';
import { useApi, useAppStore } from '../src/store/appStore';
import { theme } from '../src/theme';

const SOURCE_LABEL: Record<string, string> = {
  pdf: 'PDF',
  epub: 'EPUB',
  docx: 'DOCX',
  txt: 'Text file',
  text: 'Pasted text',
  url: 'Article',
};

export default function LibraryScreen() {
  const api = useApi();
  const router = useRouter();
  const positions = useAppStore((s) => s.positions);
  const backendUrl = useAppStore((s) => s.backendUrl);

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
    await api.deleteDocument(id);
    load();
  };

  return (
    <Screen style={{ padding: 0 }}>
      <View style={styles.toolbar}>
        <Button title="+ Import" onPress={() => router.push('/import')} style={{ flex: 1 }} />
        <Button
          title="Settings"
          variant="ghost"
          onPress={() => router.push('/settings')}
          style={{ flex: 1 }}
        />
      </View>

      {error ? (
        <Card style={{ margin: theme.space(4) }}>
          <Text style={styles.errTitle}>Backend not reachable</Text>
          <Muted>{error}</Muted>
          <Muted style={{ marginTop: 6 }}>Configured URL: {backendUrl}</Muted>
          <Button title="Retry" variant="ghost" onPress={load} style={{ marginTop: 12 }} />
        </Card>
      ) : null}

      <FlatList
        data={docs}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ padding: theme.space(4), gap: theme.space(3) }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.colors.text} />}
        ListEmptyComponent={
          !loading && !error ? (
            <Card>
              <Text style={styles.emptyTitle}>Your library is empty</Text>
              <Muted style={{ marginTop: 6 }}>
                Import a PDF, EPUB, DOCX, text file, an article URL, or pasted text to start
                listening.
              </Muted>
              <Button
                title="Import a document"
                onPress={() => router.push('/import')}
                style={{ marginTop: 14 }}
              />
            </Card>
          ) : null
        }
        renderItem={({ item }) => {
          const pos = positions[item.id];
          const pct =
            pos && item.n_sentences > 0
              ? Math.min(100, Math.round(((pos.sentenceIndex + 1) / item.n_sentences) * 100))
              : 0;
          return (
            <Pressable onPress={() => router.push({ pathname: '/reader', params: { id: item.id } })}>
              <Card>
                <Text style={styles.docTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Muted style={{ marginTop: 4 }}>
                  {SOURCE_LABEL[item.source_type] ?? item.source_type} · {item.n_sentences} sentences
                  {pct > 0 ? ` · ${pct}% read` : ''}
                </Muted>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${pct}%` }]} />
                </View>
                <Button
                  title="Remove"
                  variant="danger"
                  onPress={() => remove(item.id)}
                  style={{ marginTop: 12, alignSelf: 'flex-start', paddingVertical: 6 }}
                />
              </Card>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    gap: theme.space(3),
    padding: theme.space(4),
    paddingBottom: 0,
  },
  docTitle: { color: theme.colors.text, fontSize: 17, fontWeight: '600' },
  emptyTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '600' },
  errTitle: { color: theme.colors.danger, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  progressTrack: {
    height: 4,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: 2,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: { height: 4, backgroundColor: theme.colors.accent },
});
