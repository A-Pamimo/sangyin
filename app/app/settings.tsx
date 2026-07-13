import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { ApiClient } from '../src/api/client';
import { Voice } from '../src/api/types';
import { Muted, Screen } from '../src/components/ui';
import { BevelButton, SegmentedControl, Window } from '../src/components/retro';
import { sfx } from '../src/sfx/sfx';
import { useAppStore } from '../src/store/appStore';
import { Palette, THEME_LABELS, tokens, useRetro } from '../src/theme';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SWATCHES: Record<string, string> = { sage: '#5F6B44', clay: '#B15238', loam: '#CE9A4E' };

export default function SettingsScreen() {
  const {
    backendUrl,
    voice,
    speed,
    themeName,
    sfxEnabled,
    reduceMotion,
    setBackendUrl,
    setVoice,
    setSpeed,
    setThemeName,
    setSfxEnabled,
    setReduceMotion,
  } = useAppStore();
  const r = useRetro();
  const { colors } = r;
  const styles = useMemo(() => makeStyles(colors, r.mono), [colors, r.mono]);
  const inset = r.bevel('inset');
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
      <ScrollView contentContainerStyle={{ gap: tokens.space(6), paddingBottom: tokens.space(10) }}>
        <Text style={styles.pageTitle}>Settings</Text>
        
        <Window title="THEME.SYS" dots>
          <Muted style={{ marginBottom: 16 }}>Earth-tone palettes. Loam is a dark mode.</Muted>
          <SegmentedControl
            segments={THEME_LABELS.map((t) => ({ value: t.name, label: t.label, swatch: SWATCHES[t.name] }))}
            value={themeName}
            onChange={setThemeName}
          />
        </Window>

        <Window title="SOUND & MOTION">
          <View style={styles.switchRow}>
            <View style={{ flex: 1, paddingRight: 16 }}>
              <Text style={styles.label}>Sound effects</Text>
              <Muted style={{ marginTop: 4, fontSize: 13, opacity: 0.65 }}>Tactile UI blips (web only).</Muted>
            </View>
            <Switch
              value={sfxEnabled}
              onValueChange={(v) => {
                setSfxEnabled(v);
                if (v) sfx.play('confirm');
              }}
              trackColor={{ true: colors.accent, false: colors.surfaceAlt }}
              thumbColor={colors.surface}
            />
          </View>
          <View style={[styles.switchRow, styles.rowDivider]}>
            <View style={{ flex: 1, paddingRight: 16 }}>
              <Text style={styles.label}>Reduce motion</Text>
              <Muted style={{ marginTop: 4, fontSize: 13, opacity: 0.65 }}>Skip the intro, marquees, and parallax.</Muted>
            </View>
            <Switch
              value={reduceMotion}
              onValueChange={(v) => {
                sfx.play('toggle');
                setReduceMotion(v);
              }}
              trackColor={{ true: colors.accent, false: colors.surfaceAlt }}
              thumbColor={colors.surface}
            />
          </View>
        </Window>

        <Window title="BACKEND.CFG">
          <Muted style={{ marginBottom: 12 }}>Point the app at your self-hosted Sangyin backend.</Muted>
          <TextInput
            style={[
              styles.input,
              { borderTopColor: inset.borderTopColor, borderLeftColor: inset.borderLeftColor, borderBottomColor: inset.borderBottomColor, borderRightColor: inset.borderRightColor, borderWidth: 1 },
            ]}
            value={draftUrl}
            onChangeText={setDraftUrl}
            autoCapitalize="none"
            keyboardType="url"
            placeholder="http://localhost:8000"
            placeholderTextColor={colors.textDim}
          />
          <View style={{ flexDirection: 'row', gap: tokens.space(3), marginTop: 16 }}>
            <View style={{ flex: 1 }}><BevelButton title="Test" variant="ghost" onPress={test} /></View>
            <View style={{ flex: 1 }}><BevelButton title="Save" onPress={() => setBackendUrl(draftUrl)} /></View>
          </View>
          {status ? (
            <View style={[
              styles.statusPill,
              status.startsWith('✓') ? styles.statusOk : styles.statusErr,
            ]}>
              <View style={[styles.statusDot, {
                backgroundColor: status.startsWith('✓') ? '#7A9E6E' : colors.danger,
              }]} />
              <Text style={[styles.statusText, {
                color: status.startsWith('✓') ? '#7A9E6E' : colors.danger,
              }]}>{status}</Text>
            </View>
          ) : null}
        </Window>

        <Window title="VOICE.SYS">
          {voices.length ? (
            <SegmentedControl
              scroll
              segments={voices.map((v) => ({ value: v.id, label: v.name }))}
              value={voice}
              onChange={(id) => {
                const v = voices.find((x) => x.id === id);
                setVoice(id, v?.lang_code);
              }}
            />
          ) : (
            <Muted>No voices (backend unreachable).</Muted>
          )}
        </Window>

        <Window title="SPEED.CFG">
          <SegmentedControl
            scroll
            segments={SPEEDS.map((s) => ({ value: s, label: `${s}×` }))}
            value={speed}
            onChange={setSpeed}
          />
        </Window>
      </ScrollView>
    </Screen>
  );
}

const makeStyles = (c: Palette, mono: string) =>
  StyleSheet.create({
    pageTitle: { fontFamily: tokens.fonts.display, color: c.text, fontSize: 32, fontWeight: '800', letterSpacing: -1, marginBottom: tokens.space(2) },
    label: { fontFamily: tokens.fonts.body, color: c.text, fontSize: 16, fontWeight: '700', letterSpacing: 0.1 },
    input: {
      marginTop: 10,
      backgroundColor: c.surfaceAlt,
      color: c.text,
      borderRadius: tokens.radiusSm,
      padding: 14,
      fontFamily: tokens.fonts.body,
      fontSize: 16,
    },
    switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    rowDivider: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: c.border },
    statusPill: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      marginTop: 12, padding: 10,
      borderRadius: tokens.radiusSm, borderWidth: 1,
    },
    statusOk:  { backgroundColor: 'rgba(122,158,110,0.08)', borderColor: 'rgba(122,158,110,0.20)' },
    statusErr: { backgroundColor: 'rgba(205,122,84,0.08)',  borderColor: 'rgba(205,122,84,0.20)' },
    statusDot: { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
    statusText: { fontFamily: tokens.fonts.mono, fontSize: 12, letterSpacing: 0.3, flex: 1 },
  });
