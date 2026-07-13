import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { BevelButton } from '../src/components/retro';
import { Palette, tokens, useTheme } from '../src/theme';

export default function LandingNative() {
  const router = useRouter();
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(c, isDark), [c, isDark]);

  return (
    <View style={styles.root}>
      {/* Immersive Earthy Lighting */}
      <LinearGradient
        colors={[c.bg, c.bgAlt, c.bgAlt]}
        style={StyleSheet.absoluteFillObject}
      />
      <LinearGradient
        colors={[c.accentSoft, 'transparent']}
        style={{ position: 'absolute', top: -200, left: -100, width: 400, height: 400, borderRadius: 200 }}
      />
      
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
          <BevelButton title="Open the library" onPress={() => router.push('/library')} style={styles.primaryBtn} />
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

const makeStyles = (c: Palette, isDark: boolean) =>
  StyleSheet.create({
    root: { flex: 1, padding: tokens.space(6), justifyContent: 'space-between' },
    inner: { flex: 1, justifyContent: 'center', maxWidth: 560, marginTop: 40 },
    badge: {
      flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
      paddingVertical: 6, paddingHorizontal: 13, borderRadius: 999,
      backgroundColor: c.accentSoft,
      borderWidth: 1, borderColor: c.accent + '59',
    },
    badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.accent },
    badgeText: {
      fontFamily: tokens.fonts.mono, fontSize: 11, fontWeight: '700',
      letterSpacing: 0.8, textTransform: 'uppercase', color: c.accent,
    },
    h1: {
      fontFamily: tokens.fonts.display, color: c.text, fontSize: 56, lineHeight: 58,
      letterSpacing: -2.5, fontWeight: '900', marginTop: tokens.space(8),
    },
    h1Accent: { color: c.accent, fontStyle: 'italic', fontWeight: '700' },
    lede: {
      fontFamily: tokens.fonts.body, color: c.textDim, fontSize: 18, lineHeight: 28,
      marginTop: tokens.space(6), maxWidth: 460, fontWeight: '500',
    },
    cta: { gap: 10, marginTop: tokens.space(8) },
    primaryBtn: {
      paddingVertical: 18,
      borderRadius: tokens.radius,
    },
    footer: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingTop: tokens.space(6), borderTopWidth: 1, borderTopColor: c.border,
    },
    footerBrand: { fontFamily: tokens.fonts.display, color: c.text, fontSize: 16, fontWeight: '700', letterSpacing: -0.5 },
    footerNote: { fontFamily: tokens.fonts.mono, color: c.faint, fontSize: 12, letterSpacing: 0.5, opacity: 0.6 },
  });
