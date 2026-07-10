// Native landing (iOS/Android): a calm hero — no 3D room (reanimated can't do
// perspective/preserve-3d, and we keep the device bundle light). The immersive
// library room is a web-only showpiece; on device we open straight toward the shelf.
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BevelButton } from '../src/components/retro';
import { Palette, tokens, useTheme } from '../src/theme';

export default function LandingNative() {
  const router = useRouter();
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={styles.root}>
      <View style={styles.inner}>
        <View style={styles.badge}>
          <View style={styles.badgeDot} />
          <Text style={styles.badgeText}>Sangyin · 聲音</Text>
        </View>

        <Text style={styles.h1}>
          Read slow,{'\n'}listen <Text style={styles.h1Accent}>deep.</Text>
        </Text>

        <Text style={styles.lede}>
          Every book, paper and article you keep — turned into calm, natural narration, and picked
          up right where you left off.
        </Text>

        <View style={styles.cta}>
          <BevelButton title="Open the library" onPress={() => router.push('/library')} />
          <BevelButton title="Import a document" variant="ghost" onPress={() => router.push('/import')} />
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerBrand}>聲音 Sangyin</Text>
        <Text style={styles.footerNote}>Read slow. Listen deep.</Text>
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg, padding: tokens.space(6), justifyContent: 'space-between' },
    inner: { flex: 1, justifyContent: 'center', maxWidth: 560 },
    badge: {
      flexDirection: 'row', alignItems: 'center', gap: 9, alignSelf: 'flex-start',
      paddingVertical: 8, paddingHorizontal: 15, borderRadius: 999,
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
    },
    badgeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent },
    badgeText: {
      fontFamily: tokens.fonts.mono, fontSize: 12, fontWeight: '700',
      letterSpacing: 1.5, textTransform: 'uppercase', color: c.accent,
    },
    h1: {
      fontFamily: tokens.fonts.display, color: c.text, fontSize: 52, lineHeight: 52,
      letterSpacing: -1.5, fontWeight: '700', marginTop: tokens.space(6),
    },
    h1Accent: { color: c.accent, fontStyle: 'italic', fontWeight: '600' },
    lede: {
      fontFamily: tokens.fonts.body, color: c.textDim, fontSize: 17, lineHeight: 27,
      marginTop: tokens.space(5), maxWidth: 460,
    },
    cta: { gap: tokens.space(3), marginTop: tokens.space(8) },
    footer: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingTop: tokens.space(5), borderTopWidth: 1, borderTopColor: c.border,
    },
    footerBrand: { fontFamily: tokens.fonts.display, color: c.text, fontSize: 15, fontWeight: '700' },
    footerNote: { fontFamily: tokens.fonts.mono, color: c.faint, fontSize: 11, letterSpacing: 0.5 },
  });
