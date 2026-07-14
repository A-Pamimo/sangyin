import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions, Platform } from 'react-native';
import Animated, { 
  useAnimatedScrollHandler, 
  useSharedValue, 
  useAnimatedStyle, 
  interpolate, 
  Extrapolation,
  useAnimatedProps
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { BevelButton } from '../src/components/retro';
import { Palette, tokens, useTheme } from '../src/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export default function LandingNative() {
  const router = useRouter();
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(c, isDark), [c, isDark]);
  const { height, width } = useWindowDimensions();

  // 1. Scroll Engine
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  // 2. Interpolations
  // SSR or initial render might have height = 0, which crashes Reanimated's `interpolate` 
  // because the input range wouldn't be strictly increasing.
  const H = Math.max(height, 800);
  const W = Math.max(width, 400);

  // Phase 1: The Pull Apart (0 -> H)
  const titleLeftStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(scrollY.value, [0, H * 0.5], [0, -W], Extrapolation.CLAMP) }],
    opacity: interpolate(scrollY.value, [0, H * 0.5], [1, 0], Extrapolation.CLAMP),
  }));
  const titleRightStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(scrollY.value, [0, H * 0.5], [0, W], Extrapolation.CLAMP) }],
    opacity: interpolate(scrollY.value, [0, H * 0.5], [1, 0], Extrapolation.CLAMP),
  }));
  const poemStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, H * 0.4, H * 0.8, H * 1.2], [0, 1, 1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, H * 0.4], [50, 0], Extrapolation.CLAMP) }]
  }));

  // Phase 2: The Stroke (H -> 2H)
  const strokeProps = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(scrollY.value, [H * 0.8, H * 1.5], [1000, 0], Extrapolation.CLAMP)
  }));
  const statementStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [H * 1.2, H * 1.6, H * 2.2, H * 2.5], [0, 1, 1, 0], Extrapolation.CLAMP),
    transform: [{ translateX: interpolate(scrollY.value, [H * 1.2, H * 1.6], [-50, 0], Extrapolation.CLAMP) }]
  }));
  const strokeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [H * 2.2, H * 2.5], [1, 0], Extrapolation.CLAMP),
  }));

  // Phase 3: The Blossom (2H -> 3H)
  // We scale a circular view up massively to cover the screen
  const blossomStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(scrollY.value, [H * 2, H * 3], [0, 100], Extrapolation.CLAMP) }]
  }));

  // The top nav uses ink-coloured text, which becomes invisible once the dark
  // blossom fills the screen — so fade it out as the blossom takes over. The
  // reveal section below carries its own CTA, so nothing is lost.
  const navStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [H * 2.2, H * 2.7], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <View style={styles.root}>
      
      {/* --- FIXED SCENE (Behind the scroll) --- */}
      <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
        
        {/* Phase 1: Title & Poem */}
        <View style={styles.centerLayer}>
          <Animated.Text style={[styles.modernTitle, titleLeftStyle, { position: 'absolute', right: '50%' }]}>SANG</Animated.Text>
          <Animated.Text style={[styles.modernTitle, titleRightStyle, { position: 'absolute', left: '50%' }]}>YIN</Animated.Text>
          
          <Animated.View style={[poemStyle, { alignItems: 'center' }]}>
            {/* React Native doesn't support vertical writing mode natively yet, so we stack chars */}
            <Text style={styles.poemText}>闻</Text>
            <Text style={styles.poemText}>声</Text>
            <Text style={styles.poemText}>如</Text>
            <Text style={styles.poemText}>见</Text>
            <Text style={styles.poemText}>人</Text>
            <View style={{ height: 20 }} />
            <Text style={styles.poemText}>读</Text>
            <Text style={styles.poemText}>书</Text>
            <Text style={styles.poemText}>万</Text>
            <Text style={styles.poemText}>卷</Text>
            <Text style={styles.poemText}>意</Text>
          </Animated.View>
        </View>

        {/* Phase 2: The Stroke */}
        <Animated.View style={[styles.centerLayer, strokeOpacity]}>
          <View style={{ position: 'absolute', width: '100%', alignItems: 'center' }}>
            <Svg width={width > 800 ? 800 : width} height="300" viewBox="0 0 1000 300" style={{ opacity: 0.15 }}>
              <AnimatedPath 
                d="M 50 150 Q 250 50 500 150 T 950 150" 
                fill="none" 
                stroke={c.text} 
                strokeWidth="8" 
                strokeDasharray="1000" 
                animatedProps={strokeProps}
              />
            </Svg>
          </View>
          <Animated.View style={[statementStyle, { paddingHorizontal: 40 }]}>
            <Text style={styles.statementText}>The library is a place.</Text>
            <Text style={styles.statementSub}>The reader is an instrument.</Text>
          </Animated.View>
        </Animated.View>

        {/* Phase 3: The Blossom Mask */}
        <View style={styles.centerLayer}>
          <Animated.View style={[styles.blossomCircle, blossomStyle]} />
        </View>

      </View>

      {/* --- TRANSPARENT SCROLL LAYER --- */}
      {/* We need 4H to scroll through phases 1-3, plus 1H at the end for the UI cards to rest on screen */}
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        style={StyleSheet.absoluteFill}
      >
        {/* Spacer that plays out phases 1-3 (blossom fully fills by ~3H) */}
        <View style={{ height: H * 3 }} pointerEvents="none" />

        {/* Phase 4: App Reveal — rests exactly one screen at the end of the scroll */}
        <View style={[styles.revealContainer, { minHeight: H }]}>
          <View style={styles.uiCard}>
            <Text style={styles.uiTitle}>Kokoro TTS Engine</Text>
            <Text style={styles.uiDesc}>Lightning fast, on-device text-to-speech. Voices that adapt to the emotional cadence of the text.</Text>
          </View>

          <View style={styles.uiCard}>
            <Text style={styles.uiTitle}>Universal Format</Text>
            <Text style={styles.uiDesc}>Drop in EPUBs, PDFs, or raw text. Sangyin parses, cleans, and presents them beautifully.</Text>
          </View>

          <View style={{ marginTop: 60, alignItems: 'center' }}>
            <Text style={styles.beginJourney}>Begin your journey.</Text>
            <BevelButton title="Open the Reader" onPress={() => router.push('/library')} />
          </View>
        </View>

      </Animated.ScrollView>

      {/* --- FOREGROUND NAV (fades out as the blossom fills the screen) --- */}
      <Animated.View style={[styles.nav, navStyle]} pointerEvents="box-none">
        <View style={styles.brand}>
          <View style={styles.seal}>
            <Text style={styles.sealText}>桑</Text>
          </View>
          <Text style={styles.brandText}>Sangyin</Text>
        </View>
        <BevelButton title="Skip to App" variant="ghost" onPress={() => router.push('/library')} />
      </Animated.View>

    </View>
  );
}

const makeStyles = (c: Palette, isDark: boolean) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    
    // Layout
    centerLayer: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' },
    
    // Nav
    nav: { position: 'absolute', top: 0, left: 0, width: '100%', padding: tokens.space(6), flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 100 },
    brand: { flexDirection: 'row', alignItems: 'center', gap: tokens.space(3) },
    seal: { width: 32, height: 32, borderWidth: 2, borderColor: c.danger, alignItems: 'center', justifyContent: 'center' },
    sealText: { fontFamily: tokens.fonts.serif, color: c.danger, fontSize: 16, fontWeight: '900' },
    brandText: { fontFamily: tokens.fonts.display, color: c.text, fontSize: 20, fontWeight: '700', letterSpacing: 1 },
    
    // Typography
    modernTitle: { fontFamily: tokens.fonts.display, fontSize: Platform.OS === 'web' ? 120 : 60, fontWeight: '800', color: c.text, letterSpacing: -2 },
    poemText: { fontFamily: tokens.fonts.serif, fontSize: 26, color: c.textDim, marginVertical: 2, lineHeight: 34 },
    
    statementText: { fontFamily: tokens.fonts.display, fontSize: Platform.OS === 'web' ? 48 : 32, fontWeight: '700', color: c.text, textAlign: 'center' },
    statementSub: { fontFamily: tokens.fonts.body, fontSize: 20, color: c.textDim, textAlign: 'center', marginTop: 10 },
    
    // Blossom
    blossomCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: c.text },
    
    // Phase 4
    revealContainer: { justifyContent: 'center', alignItems: 'center', padding: 20, gap: 20 },
    uiCard: {
      backgroundColor: c.bg,
      padding: 30,
      borderRadius: tokens.radius,
      width: '100%', 
      maxWidth: 500,
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4
    },
    uiTitle: { fontFamily: tokens.fonts.display, fontSize: 24, fontWeight: '700', color: c.text, marginBottom: 10 },
    uiDesc: { fontFamily: tokens.fonts.body, fontSize: 16, color: c.textDim, lineHeight: 24 },
    beginJourney: { fontFamily: tokens.fonts.display, fontSize: 32, fontWeight: '700', color: c.bg, marginBottom: 30, textAlign: 'center' }
  });
