import { Text, View } from 'react-native';

import { tokens, useTheme } from '../theme';
import { Muted } from './ui';

// Native fallback: rendering a PDF on device needs a native module + dev build,
// which isn't available in the current setup. Audio still works in the Text view.
export function PdfView(_: { url: string }) {
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
        PDF view is available on the web
      </Text>
      <Muted style={{ marginTop: 8, textAlign: 'center' }}>
        Open Sangyin in a browser to see the original PDF. Audio playback works here in the Text
        view.
      </Muted>
    </View>
  );
}
