import { ReactNode, useEffect, useState } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useReduceMotion } from './useReduceMotion';

/**
 * Seamless infinite horizontal ticker. Renders the content twice and translates
 * the track by exactly one copy's width, looping on the UI thread — so the loop
 * point is invisible. Chrome text only (window titles, tags, tickers), never the
 * reading surface.
 *
 * `ReduceMotion.Never` keeps reanimated from collapsing the animation to its end
 * value under the OS "reduce motion" setting; the in-app flag is honored instead
 * by rendering a single static copy.
 */
export function Marquee({
  children,
  speedPxPerSec = 40,
  gap = 48,
  reverse = false,
  paused = false,
  style,
}: {
  children: ReactNode;
  speedPxPerSec?: number;
  gap?: number;
  reverse?: boolean;
  paused?: boolean;
  style?: ViewStyle;
}) {
  const reduceMotion = useReduceMotion();
  const [copyW, setCopyW] = useState(0);
  const x = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(x);
    if (reduceMotion || paused || copyW <= 0) {
      x.value = 0;
      return;
    }
    const distance = copyW + gap;
    const duration = (distance / speedPxPerSec) * 1000;
    const from = reverse ? -distance : 0;
    const to = reverse ? 0 : -distance;
    x.value = from;
    x.value = withRepeat(
      withTiming(to, { duration, easing: Easing.linear, reduceMotion: ReduceMotion.Never }),
      -1,
      false,
    );
    return () => cancelAnimation(x);
  }, [copyW, gap, speedPxPerSec, reverse, paused, reduceMotion, x]);

  const trackStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  // Reduce-motion / not-yet-measured: a single static copy (measured on layout).
  const trackContent = (measure: boolean, hidden: boolean) => (
    <View
      onLayout={measure ? (e) => setCopyW(e.nativeEvent.layout.width) : undefined}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
      style={[styles.copy, { marginRight: gap }]}
    >
      {children}
    </View>
  );

  if (reduceMotion) {
    return (
      <View style={[styles.viewport, style]}>
        <View style={styles.track}>{trackContent(false, false)}</View>
      </View>
    );
  }

  return (
    <View style={[styles.viewport, style]}>
      <Animated.View style={[styles.track, trackStyle]}>
        {trackContent(true, false)}
        {trackContent(false, true)}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { overflow: 'hidden' },
  track: { flexDirection: 'row', alignItems: 'center' },
  copy: { flexDirection: 'row', alignItems: 'center' },
});
