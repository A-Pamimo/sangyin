import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { useHasHydrated, useAppStore } from '../store/appStore';
import { tokens, useTheme } from '../theme';
import { useReduceMotion } from './useReduceMotion';

const DWELL_MS = 900;
const FADE_MS = 420;

/**
 * A calm "warming up" boot intro, shown once per launch. Mounted above the Stack
 * in _layout. Gated on hydration so a persisted `reduceMotion` preference is never
 * briefly ignored: it renders a static first frame until the store rehydrates, then
 * either plays the fill+fade (default) or dismisses instantly (reduce motion).
 */
export function BootScreen() {
  const { colors: c } = useTheme();
  const hydrated = useHasHydrated();
  const bootSeen = useAppStore((s) => s.bootSeen);
  const setBootSeen = useAppStore((s) => s.setBootSeen);
  const reduceMotion = useReduceMotion();

  const [gone, setGone] = useState(false);
  const opacity = useSharedValue(1);
  const progress = useSharedValue(0);
  const startedRef = useRef(false);

  function finish() {
    setBootSeen(true);
    setGone(true);
  }

  useEffect(() => {
    if (!hydrated || gone || startedRef.current) return;
    if (bootSeen) {
      setGone(true);
      return;
    }
    startedRef.current = true;
    if (reduceMotion) {
      finish();
      return;
    }
    progress.value = withTiming(1, { duration: DWELL_MS, easing: Easing.out(Easing.cubic) });
    opacity.value = withDelay(
      DWELL_MS + 120,
      withTiming(0, { duration: FADE_MS, easing: Easing.inOut(Easing.quad) }, (done) => {
        if (done) runOnJS(finish)();
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, bootSeen, reduceMotion, gone]);

  const skip = () => {
    if (!startedRef.current) return;
    cancelAnimation(progress);
    cancelAnimation(opacity);
    opacity.value = withTiming(0, { duration: 180 }, (done) => {
      if (done) runOnJS(finish)();
    });
  };

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  if (gone) return null;

  return (
    <Animated.View
      style={[styles.fill, styles.overlay, { backgroundColor: c.bg, pointerEvents: 'auto' }, overlayStyle]}
    >
      <Pressable style={styles.center} onPress={skip} accessibilityLabel="Skip intro">
        <Text style={[styles.brand, { color: c.text }]}>sangyin · 聲音</Text>
        <Text style={[styles.tagline, { color: c.textDim }]}>Read slow, listen deep.</Text>
        <View style={[styles.track, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}>
          <Animated.View style={[styles.trackFill, { backgroundColor: c.accent }, fillStyle]} />
        </View>
        <Text style={[styles.status, { color: c.faint }]}>WARMING UP…</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  overlay: {
    zIndex: 9999,
    ...(Platform.OS === 'web' ? ({ position: 'fixed' } as any) : null),
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: tokens.space(6) },
  brand: {
    fontFamily: tokens.fonts.display,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  tagline: { fontFamily: tokens.fonts.body, fontSize: 15, marginTop: tokens.space(2) },
  track: {
    width: 200,
    height: 8,
    borderRadius: tokens.radiusChrome,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: tokens.space(7),
  },
  trackFill: { height: '100%' },
  status: {
    fontFamily: tokens.fonts.mono,
    fontSize: 11,
    letterSpacing: 2,
    marginTop: tokens.space(4),
  },
});
