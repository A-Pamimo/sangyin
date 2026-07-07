import { Linking, Pressable, Text, View } from 'react-native';

import { tokens, useTheme } from '../theme';
import { Muted } from './ui';

// Native fallback: rendering a PDF on device needs a native module + dev build,
// so we offer to open it in the system viewer/browser. Audio still works in Text.
export function PdfView({ url }: { url: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: tokens.space(6) }}>
      <Text
        style={{
          fontFamily: tokens.fonts.display,
          color: colors.text,
          fontSize: 18,
          fontWeight: '600',
          textAlign: 'center',
        }}
      >
        Open the original PDF
      </Text>
      <Muted style={{ marginTop: 8, textAlign: 'center' }}>
        Inline PDF preview is available on the web. Tap below to open it in your browser.
      </Muted>
      <Pressable
        onPress={() => Linking.openURL(url).catch(() => {})}
        style={{
          marginTop: tokens.space(5),
          backgroundColor: colors.accent,
          paddingVertical: 14,
          paddingHorizontal: 28,
          borderRadius: tokens.radius,
        }}
      >
        <Text style={{ fontFamily: tokens.fonts.body, color: colors.onAccent, fontSize: 15, fontWeight: '600' }}>
          Open PDF ↗
        </Text>
      </Pressable>
    </View>
  );
}
