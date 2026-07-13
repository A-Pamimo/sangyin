import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { sfx } from '../sfx/sfx';
import { mix, Palette, tokens, useRetro } from '../theme';
import { Scramble } from '../fx/Scramble';
import { useReduceMotion } from '../fx/useReduceMotion';

export { Button, Card, Screen, H1, Muted } from './ui';

// ---------------------------------------------------------------------------
// Title bar — elevated modern tactile header.
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
    fontFamily: r.fonts.display,
    color: r.chromeBarText,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  };
  return (
    <View
      style={{
        height: r.chromeBarHeight,
        backgroundColor: r.chromeBar,
        borderBottomWidth: 1,
        borderBottomColor: c.border,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: tokens.space(4),
        gap: tokens.space(3),
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
          <Text style={[titleStyle, { fontSize: 20, fontWeight: '500' }]}>×</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Window — premium tactile card.
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
  const { colors: c, isDark } = r;
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
          ...tokens.shadowRaised,
        },
        style,
      ]}
    >
      {title != null ? (
        <TitleBar title={title} dots={dots} close={close} right={right} scramble={scramble} onClose={onClose} />
      ) : null}
      <View style={[{ padding: tokens.space(5), position: 'relative' }, bodyStyle]}>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 1,
            backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.55)',
            zIndex: 1,
          }}
        />
        {children}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// BevelButton -> TactileButton (Renamed internally but exported as BevelButton)
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
  const scale = useSharedValue(1);
  const hoverLift = useSharedValue(0);

  const bg = variant === 'primary' ? c.accent : variant === 'danger' ? c.danger : c.surface;
  const fg = variant === 'primary' || variant === 'danger' ? c.onAccent : c.text;
  const b = r.bevel('raised');

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: interpolate(hoverLift.value, [0, 1], [0, -2]) },
    ],
  }));

  return (
    <Animated.View style={!reduceMotion ? animatedStyle : undefined}>
      <Pressable
        disabled={disabled || loading}
        onPressIn={() => {
          scale.value = withSpring(0.94, { damping: 18, stiffness: 600 });
          hoverLift.value = withSpring(0, { damping: 18, stiffness: 600 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 15, stiffness: 350 });
          hoverLift.value = withSpring(1, { damping: 15, stiffness: 350 });
        }}
        onPress={() => {
          if (sound) sfx.play('tap');
          onPress();
        }}
        // @ts-ignore web-only hover handlers
        onHoverIn={() => {
          if (!reduceMotion && variant !== 'ghost')
            hoverLift.value = withSpring(1, { stiffness: 400, damping: 26 });
        }}
        // @ts-ignore web-only hover handlers
        onHoverOut={() => {
          hoverLift.value = withSpring(0, { stiffness: 300, damping: 22 });
        }}
        style={[
          {
            backgroundColor: variant === 'ghost' ? 'transparent' : bg,
            borderTopColor: variant === 'ghost' ? 'transparent' : b.borderTopColor,
            borderLeftColor: variant === 'ghost' ? 'transparent' : b.borderLeftColor,
            borderBottomColor: variant === 'ghost' ? 'transparent' : b.borderBottomColor,
            borderRightColor: variant === 'ghost' ? 'transparent' : b.borderRightColor,
            borderWidth: variant === 'ghost' ? 0 : b.borderWidth,
            borderRadius: tokens.radiusChrome,
            paddingVertical: 14,
            paddingHorizontal: 24,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: disabled ? 0.5 : 1,
            ...(variant !== 'ghost' ? tokens.shadowRaised : {}),
          },
          style,
        ]}
      >
        {variant === 'primary' && !reduceMotion ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 1,
              borderTopLeftRadius: tokens.radiusChrome,
              borderTopRightRadius: tokens.radiusChrome,
              backgroundColor: 'rgba(255,255,255,0.18)',
            }}
          />
        ) : null}
        {loading ? (
          <ActivityIndicator color={fg} />
        ) : (
          <Text style={{ fontFamily: tokens.fonts.body, fontSize: 16, fontWeight: '700', color: fg, letterSpacing: -0.1 }}>
            {title}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// SegmentedControl — tactile pill segments
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
  const reduceMotion = useReduceMotion();
  const padV = size === 'sm' ? 8 : 10;
  const padH = size === 'sm' ? 14 : 18;

  const rects = useRef<{ x: number; width: number }[]>([]);
  const pillX = useSharedValue(0);
  const pillW = useSharedValue(0);
  const activeIdx = segments.findIndex((s) => s.value === value);

  useEffect(() => {
    const rect = rects.current[activeIdx];
    if (!rect) return;
    if (reduceMotion) {
      pillX.value = rect.x;
      pillW.value = rect.width;
    } else {
      pillX.value = withSpring(rect.x, { stiffness: 380, damping: 28 });
      pillW.value = withSpring(rect.width, { stiffness: 380, damping: 28 });
    }
  }, [activeIdx]);

  const pillStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: pillX.value,
    width: pillW.value,
    borderRadius: tokens.radiusChrome - 2,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    ...tokens.shadowRaised,
  }));

  const row = (
    <View style={[styles.segRow, { position: 'relative' }, !scroll && style]}>
      <Animated.View style={pillStyle} />
      {segments.map((seg, i) => {
        const on = seg.value === value;
        return (
          <Pressable
            key={String(seg.value)}
            onLayout={(e) => {
              rects.current[i] = {
                x: e.nativeEvent.layout.x,
                width: e.nativeEvent.layout.width,
              };
              if (on) {
                pillX.value = e.nativeEvent.layout.x;
                pillW.value = e.nativeEvent.layout.width;
              }
            }}
            onPress={() => {
              if (sound) sfx.play('toggle');
              onChange(seg.value);
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingVertical: padV,
              paddingHorizontal: padH,
              borderRadius: tokens.radiusChrome - 2,
              backgroundColor: 'transparent',
              zIndex: 1,
            }}
          >
            {seg.swatch ? (
              <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: seg.swatch, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' }} />
            ) : null}
            <Text
              numberOfLines={1}
              style={{
                fontFamily: tokens.fonts.body,
                fontSize: size === 'sm' ? 14 : 15,
                fontWeight: on ? '700' : '500',
                letterSpacing: -0.1,
                color: c.text,
                opacity: on ? 1 : 0.55,
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
    backgroundColor: c.surfaceAlt,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: tokens.radiusChrome,
    padding: 6,
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
// RetroChip — tactile pill
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
    <View style={[
      {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 999,
        borderWidth: 1,
        backgroundColor: bg,
        borderColor: border,
      },
      style
    ]}>
      {icon}
      <Text style={{ fontFamily: tokens.fonts.body, fontSize: 14, fontWeight: '600', color: fg }} numberOfLines={1}>
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
// SegMeter — modern segmented progress bar
// ---------------------------------------------------------------------------
export function SegMeter({
  pct,
  cells = 12,
  height = 12,
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
    <View style={[{ flexDirection: 'row', gap: 3 }, style]}>
      {Array.from({ length: cells }, (_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height,
            borderRadius: 2,
            backgroundColor: i < filled ? c.accent : c.surfaceAlt,
            borderWidth: 1,
            borderColor: i < filled ? c.accentDeep : 'transparent',
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  segRow: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  segSelfStart: { alignSelf: 'flex-start' },
});
