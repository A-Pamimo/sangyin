import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiClient } from '../src/api/client';
import { Voice } from '../src/api/types';
import { Button, Card, Muted, Screen } from '../src/components/ui';
import { useAppStore } from '../src/store/appStore';
import { theme } from '../src/theme';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function SettingsScreen() {
  const { backendUrl, voice, speed, setBackendUrl, setVoice, setSpeed } = useAppStore();
  const [draftUrl, setDraftUrl] = useState(backendUrl);
  const [status, setStatus] = useState<string | null>(null);
  const [voices, setVoices] = useState<Voice[]>([]);

  useEffect(() => {
    new ApiClient(backendUrl)
      .voices()
      .then(setVoices)
      .catch(() => setVoices([]));
  }, [backendUrl]);

  const test = async () => {
    setStatus('Testing…');
    try {
      const health = await new ApiClient(draftUrl).health();
      setStatus(`✓ Connected — engine: ${health.model}, v${health.version}`);
    } catch (e: any) {
      setStatus(`✗ ${e?.message ?? 'Connection failed'}`);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: theme.space(4) }}>
        <Card>
          <Text style={styles.label}>Backend URL</Text>
          <Muted style={{ marginTop: 4 }}>
            Point the app at your self-hosted Sangyin backend.
          </Muted>
          <TextInput
            style={styles.input}
            value={draftUrl}
            onChangeText={setDraftUrl}
            autoCapitalize="none"
            keyboardType="url"
            placeholder="http://localhost:8000"
            placeholderTextColor={theme.colors.textDim}
          />
          <View style={{ flexDirection: 'row', gap: theme.space(2), marginTop: 12 }}>
            <Button title="Test" variant="ghost" onPress={test} style={{ flex: 1 }} />
            <Button title="Save" onPress={() => setBackendUrl(draftUrl)} style={{ flex: 1 }} />
          </View>
          {status ? <Muted style={{ marginTop: 10 }}>{status}</Muted> : null}
        </Card>

        <Card>
          <Text style={styles.label}>Voice</Text>
          <View style={styles.chips}>
            {voices.map((v) => (
              <Pressable
                key={v.id}
                onPress={() => setVoice(v.id, v.lang_code)}
                style={[styles.chip, voice === v.id && styles.chipActive]}
              >
                <Text style={[styles.chipText, voice === v.id && styles.chipTextActive]}>
                  {v.name}
                </Text>
              </Pressable>
            ))}
            {voices.length === 0 ? <Muted>No voices (backend unreachable).</Muted> : null}
          </View>
        </Card>

        <Card>
          <Text style={styles.label}>Default speed</Text>
          <View style={styles.chips}>
            {SPEEDS.map((s) => (
              <Pressable
                key={s}
                onPress={() => setSpeed(s)}
                style={[styles.chip, speed === s && styles.chipActive]}
              >
                <Text style={[styles.chipText, speed === s && styles.chipTextActive]}>{s}×</Text>
              </Pressable>
            ))}
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: theme.colors.text, fontSize: 15, fontWeight: '700' },
  input: {
    marginTop: 10,
    backgroundColor: theme.colors.surfaceAlt,
    color: theme.colors.text,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
    fontSize: 15,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space(2), marginTop: 12 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceAlt,
  },
  chipActive: { backgroundColor: theme.colors.accentSoft, borderColor: theme.colors.accent },
  chipText: { color: theme.colors.textDim, fontSize: 14, fontWeight: '600' },
  chipTextActive: { color: theme.colors.text },
});
