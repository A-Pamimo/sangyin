import { ReactNode, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import { sfx } from '../sfx/sfx';
import { mix, Palette, tokens, useRetro } from '../theme';
import { Scramble } from '../fx/Scramble';
import { useReduceMotion } from '../fx/useReduceMotion';

// One import site for screens: the calm ui.tsx primitives plus the retro upgrades.
export { Button, Card, Screen, H1, Muted } from './ui';

// ---------------------------------------------------------------------------
// Title bar — the chrome strip atop a Window.
// ---------------------------------------------------------------------------

export function TitleBar({
  title,
  dots,
  close,
  right,
  scramble,
  onClose,
}: {
  title: string;
  dots?: boolean;
  close?: boolean;
  right?: ReactNode;
  scramble?: boolean;
  onClose?: () => void;
}) {
  const r = useRetro();
  const { colors: c } = r;
  const titleStyle: TextStyle = {
    fontFamily: r.mono,
    color: r.chromeBarText,
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  };
  return (
    <View
      style={{
        height: r.chromeBarHeight,
        backgroundColor: r.chromeBar,
        borderBottomWidth: 1,
        borderBottomColor: mix(r.chromeBar, '#000000', 0.25),
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: tokens.space(3),
        gap: tokens.space(2),
      }}
    >
      {dots ? (
        <View style={{ flexDirection: 'row', gap: 6, marginRight: 4 }}>
          {[c.danger, c.warm, c.accent].map((col, i) => (
            <View
              key={i}
              style={{ width: r.chromeDot, height: r.chromeDot, borderRadius: r.chromeDot / 2, backgroundColor: col }}
            />
          ))}
        </View>
      ) : null}
      {scramble ? (
        <Scramble text={title} style={titleStyle} />
      ) : (
        <Text style={titleStyle} numberOfLines={1}>
          {title}
        </Text>
      )}
      <View style={{ flex: 1 }} />
      {right}
      {close ? (
        <Pressable
          onPress={() => {
            sfx.play('back');
            onClose?.();
          }}
          hitSlop={8}
          style={{ paddingHorizontal: 4 }}
        >
          <Text style={[titleStyle, { fontSize: 16, fontWeight: '700' }]}>×</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Window — beveled card with an optional title bar. `bare` ≡ the old Card.
// ---------------------------------------------------------------------------

export function Window({
  children,
  title,
  dots,
  close,
  right,
  scramble,
  variant = 'raised',
  bare,
  onClose,
  style,
  bodyStyle,
}: {
  children: ReactNode;
  title?: string;
  dots?: boolean;
  close?: boolean;
  right?: ReactNode;
  scramble?: boolean;
  variant?: 'raised' | 'inset';
  bare?: boolean;
  onClose?: () => void;
  style?: ViewStyle;
  bodyStyle?: ViewStyle;
}) {
  const r = useRetro();
  const { colors: c } = r;
  const b = r.bevel(variant);

  if (bare) {
    return (
      <View
        style={[
          {
            backgroundColor: c.surface,
            borderColor: c.border,
            borderWidth: 1,
            borderRadius: tokens.radius,
            padding: tokens.space(5),
            ...tokens.shadow,
          },
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  return (
    <View
      style={[
        {
          backgroundColor: c.surface,
          borderTopColor: b.borderTopColor,
          borderLeftColor: b.borderLeftColor,
          borderBottomColor: b.borderBottomColor,
          borderRightColor: b.borderRightColor,
          borderWidth: b.borderWidth,
          borderRadius: tokens.radiusChrome,
          overflow: 'hidden',
          ...tokens.shadow,
        },
        style,
      ]}
    >
      {title != null ? (
        <TitleBar title={title} dots={dots} close={close} right={right} scramble={scramble} onClose={onClose} />
      ) : null}
      <View style={[{ padding: tokens.space(5) }, bodyStyle]}>{children}</View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// BevelButton — drop-in for ui.tsx Button, with a pressed inset flip + SFX.
// ---------------------------------------------------------------------------

export function BevelButton({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  sound = true,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  sound?: boolean;
  style?: ViewStyle;
}) {
  const r = useRetro();
  const { colors: c } = r;
  const reduceMotion = useReduceMotion();
  const bg = variant === 'primary' ? c.accent : c.surface;
  const fg = variant === 'primary' ? c.onAccent : variant === 'danger' ? c.danger : c.text;
  const [pressed, setPressed] = useState(false);

  const light = mix(bg, '#FFFFFF', 0.18);
  const shadow = mix(bg, '#000000', 0.22);
  const inset = pressed && !reduceMotion; // pressed flips the bevel; skipped under reduce-motion
  const tl = inset ? shadow : light;
  const br = inset ? light : shadow;

  return (
    <Pressable
      disabled={disabled || loading}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={() => {
        if (sound) sfx.play('tap');
        onPress();
      }}
      style={[
        {
          backgroundColor: bg,
          borderTopColor: tl,
          borderLeftColor: tl,
          borderBottomColor: br,
          borderRightColor: br,
          borderWidth: tokens.bevelWidth,
          borderRadius: tokens.radiusChrome,
          paddingVertical: 12,
          paddingHorizontal: 20,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={{ fontFamily: tokens.fonts.body, fontSize: 15, fontWeight: '600', color: fg }}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// SegmentedControl — beveled inset well of options; drives theme / voice / speed.
// ---------------------------------------------------------------------------

export interface Segment<T> {
  value: T;
  label: string;
  swatch?: string;
}

export function SegmentedControl<T extends string | number>({
  segments,
  value,
  onChange,
  size = 'md',
  sound = true,
  scroll,
  style,
}: {
  segments: Segment<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  sound?: boolean;
  scroll?: boolean;
  style?: ViewStyle;
}) {
  const r = useRetro();
  const { colors: c } = r;
  const b = r.bevel('inset');
  const padV = size === 'sm' ? 6 : 9;
  const padH = size === 'sm' ? 12 : 15;

  const row = (
    <View style={[styles.segRow, !scroll && style]}>
      {segments.map((seg) => {
        const on = seg.value === value;
        return (
          <Pressable
            key={String(seg.value)}
            onPress={() => {
              if (sound) sfx.play('toggle');
              onChange(seg.value);
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 7,
              paddingVertical: padV,
              paddingHorizontal: padH,
              borderRadius: tokens.radiusChrome,
              backgroundColor: on ? c.accent : 'transparent',
            }}
          >
            {seg.swatch ? (
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: seg.swatch }} />
            ) : null}
            <Text
              numberOfLines={1}
              style={{
                fontFamily: r.mono,
                fontSize: size === 'sm' ? 12 : 12.5,
                fontWeight: '700',
                letterSpacing: 0.2,
                color: on ? c.onAccent : c.textDim,
              }}
            >
              {seg.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const wellStyle: ViewStyle = {
    backgroundColor: b.face,
    borderTopColor: b.borderTopColor,
    borderLeftColor: b.borderLeftColor,
    borderBottomColor: b.borderBottomColor,
    borderRightColor: b.borderRightColor,
    borderWidth: b.borderWidth,
    borderRadius: tokens.radiusChrome,
    padding: 3,
  };

  if (scroll) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={style} contentContainerStyle={wellStyle}>
        {row}
      </ScrollView>
    );
  }
  return <View style={[wellStyle, styles.segSelfStart, style]}>{row}</View>;
}

// ---------------------------------------------------------------------------
// RetroChip — small mono tag / status pill (hairline, not a full bevel).
// ---------------------------------------------------------------------------

export function RetroChip({
  label,
  tone = 'default',
  icon,
  onPress,
  active,
  style,
}: {
  label: string;
  tone?: 'default' | 'accent' | 'danger' | 'ghost';
  icon?: ReactNode;
  onPress?: () => void;
  active?: boolean;
  style?: ViewStyle;
}) {
  const r = useRetro();
  const { colors: c } = r;
  const styles2 = useMemo(() => chipStyles(c, r.mono), [c, r.mono]);

  let bg = c.surfaceAlt;
  let fg = c.text;
  let border = c.border;
  if (tone === 'accent') {
    bg = c.accentSoft;
    fg = c.accentDeep;
    border = c.accent;
  } else if (tone === 'danger') {
    fg = c.danger;
  } else if (tone === 'ghost') {
    bg = 'transparent';
  }
  if (active) {
    bg = c.accent;
    fg = c.onAccent;
    border = c.accent;
  }

  const inner = (
    <View style={[styles2.chip, { backgroundColor: bg, borderColor: border }, style]}>
      {icon}
      <Text style={[styles2.chipText, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );

  if (!onPress) return inner;
  return (
    <Pressable
      onPress={() => {
        sfx.play('tap');
        onPress();
      }}
    >
      {inner}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// SegMeter — a blocky segmented progress bar (retro "loading cells").
// ---------------------------------------------------------------------------

export function SegMeter({
  pct,
  cells = 12,
  height = 10,
  style,
}: {
  pct: number; // 0..100
  cells?: number;
  height?: number;
  style?: ViewStyle;
}) {
  const r = useRetro();
  const { colors: c } = r;
  const clamped = Math.max(0, Math.min(100, pct));
  const filled = Math.round((clamped / 100) * cells);
  return (
    <View style={[{ flexDirection: 'row', gap: 2 }, style]}>
      {Array.from({ length: cells }, (_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height,
            borderRadius: 1,
            backgroundColor: i < filled ? c.accent : c.surfaceAlt,
            borderWidth: 1,
            borderColor: i < filled ? c.accentDeep : c.border,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  segRow: { flexDirection: 'row', gap: 3, alignItems: 'center' },
  segSelfStart: { alignSelf: 'flex-start' },
});

const chipStyles = (c: Palette, mono: string) =>
  StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: tokens.radiusChrome,
      borderWidth: 1,
    },
    chipText: { fontFamily: mono, fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  });
