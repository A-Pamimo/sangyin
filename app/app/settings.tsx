import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiClient } from '../src/api/client';
import { Voice } from '../src/api/types';
import { Button, Card, Muted, Screen } from '../src/components/ui';
import { useAppStore } from '../src/store/appStore';
import { Palette, THEME_LABELS, tokens, useTheme } from '../src/theme';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function SettingsScreen() {
  const { backendUrl, voice, speed, themeName, setBackendUrl, setVoice, setSpeed, setThemeName } =
    useAppStore();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
      <ScrollView contentContainerStyle={{ gap: tokens.space(4) }}>
        <Card>
          <Text style={styles.label}>Theme</Text>
          <Muted style={{ marginTop: 4 }}>Earth-tone palettes. Loam is a dark mode.</Muted>
          <View style={styles.chips}>
            {THEME_LABELS.map((t) => (
              <Pressable
                key={t.name}
                onPress={() => setThemeName(t.name)}
                style={[styles.chip, themeName === t.name && styles.chipActive]}
              >
                <View style={[styles.swatch, { backgroundColor: swatchFor(t.name) }]} />
                <Text style={[styles.chipText, themeName === t.name && styles.chipTextActive]}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>

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
            placeholderTextColor={colors.textDim}
          />
          <View style={{ flexDirection: 'row', gap: tokens.space(2), marginTop: 12 }}>
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

const SWATCHES: Record<string, string> = { sage: '#5F6B44', clay: '#B15238', loam: '#CE9A4E' };
const swatchFor = (name: string) => SWATCHES[name] ?? '#5F6B44';

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    label: { fontFamily: tokens.fonts.display, color: c.text, fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
    input: {
      marginTop: 10,
      backgroundColor: c.surfaceAlt,
      color: c.text,
      borderRadius: tokens.radiusSm,
      borderWidth: 1,
      borderColor: c.border,
      padding: 12,
      fontFamily: tokens.fonts.body,
      fontSize: 15,
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space(2), marginTop: 12 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surfaceAlt,
    },
    swatch: { width: 12, height: 12, borderRadius: 6 },
    chipActive: { backgroundColor: c.accentSoft, borderColor: c.accent },
    chipText: { fontFamily: tokens.fonts.body, color: c.textDim, fontSize: 14, fontWeight: '600' },
    chipTextActive: { color: c.text },
  });
