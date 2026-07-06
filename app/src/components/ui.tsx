import { ReactNode, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import { Palette, tokens, useTheme } from '../theme';

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => makeStyles(colors), [colors]);
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const bg = variant === 'primary' ? colors.accent : 'transparent';
  const fg =
    variant === 'primary' ? colors.onAccent : variant === 'danger' ? colors.danger : colors.text;
  const border = variant === 'primary' ? colors.accent : colors.border;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.btn,
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.5 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.btnText, { color: fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const styles = useStyles();
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Screen({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const styles = useStyles();
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function H1({ children, style }: { children: ReactNode; style?: TextStyle }) {
  const styles = useStyles();
  return <Text style={[styles.h1, style]}>{children}</Text>;
}

export function Muted({ children, style }: { children: ReactNode; style?: TextStyle }) {
  const styles = useStyles();
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg, padding: tokens.space(4) },
    btn: {
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: tokens.radius,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnText: { fontFamily: tokens.fonts.body, fontSize: 15, fontWeight: '600' },
    card: {
      backgroundColor: c.surface,
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: tokens.radius,
      padding: tokens.space(5),
      ...tokens.shadow,
    },
    h1: {
      fontFamily: tokens.fonts.display,
      color: c.text,
      fontSize: 30,
      fontWeight: '700',
      letterSpacing: -0.5,
    },
    muted: { fontFamily: tokens.fonts.body, color: c.textDim, fontSize: 13, lineHeight: 20 },
  });
