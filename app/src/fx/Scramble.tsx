import { useEffect, useRef, useState } from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View } from 'react-native';

import { useReduceMotion } from './useReduceMotion';

const DEFAULT_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&@*';

/**
 * Mount-time "decode" scramble: characters resolve left→right into the final
 * text over `durationMs`. A hidden sizer reserves the final width so the reveal
 * never reflows surrounding layout. Under reduce-motion it prints `text` at once.
 *
 * Uses requestAnimationFrame on the JS thread (fine — text content can't animate
 * on the UI thread, and the run is short + self-terminating).
 */
export function Scramble({
  text,
  play = true,
  durationMs = 600,
  charset = DEFAULT_CHARSET,
  style,
}: {
  text: string;
  play?: boolean;
  durationMs?: number;
  charset?: string;
  style?: StyleProp<TextStyle>;
}) {
  const reduceMotion = useReduceMotion();
  const animate = play && !reduceMotion;
  const [display, setDisplay] = useState(animate ? '' : text);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!animate) {
      setDisplay(text);
      return;
    }
    startRef.current = null;
    const rand = () => charset[Math.floor(Math.random() * charset.length)];
    const tick = (now: number) => {
      if (startRef.current == null) startRef.current = now;
      const t = Math.min(1, (now - startRef.current) / durationMs);
      const resolved = Math.floor(t * text.length);
      let out = '';
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        out += i < resolved || ch === ' ' ? ch : rand();
      }
      setDisplay(out);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(text);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [text, animate, durationMs, charset]);

  if (!animate) {
    return (
      <Text style={style} numberOfLines={1}>
        {text}
      </Text>
    );
  }

  return (
    <View>
      {/* Hidden sizer reserves the final width so the reveal never reflows. */}
      <Text style={[style, styles.sizer]} numberOfLines={1}>
        {text}
      </Text>
      <Text style={[style, styles.overlay]} numberOfLines={1}>
        {display}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sizer: { opacity: 0 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
