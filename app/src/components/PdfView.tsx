import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { useApi } from '../store/appStore';
import { tokens, useTheme } from '../theme';
import { Muted } from './ui';

/**
 * Renders a stored PDF as scrollable page images. The backend rasterizes each
 * page (PyMuPDF), so no PDF is ever handed to the browser — which means it can't
 * trigger the browser's "download PDF" handler, and it works on native too.
 */
export function PdfView({ id }: { id: string }) {
  const api = useApi();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [pages, setPages] = useState<number | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .pdfPageCount(id)
      .then((n) => alive && setPages(n))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [id, api]);

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: tokens.space(6) }}>
        <Muted style={{ textAlign: 'center' }}>Could not load the PDF pages.</Muted>
        <Pressable
          onPress={() => Linking.openURL(api.documentFileUrl(id)).catch(() => {})}
          style={{ marginTop: 12 }}
        >
          <Text style={{ fontFamily: tokens.fonts.body, color: colors.accent, fontWeight: '600' }}>
            Open original PDF ↗
          </Text>
        </Pressable>
      </View>
    );
  }

  if (pages === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const pageWidth = Math.min(width, 900) - tokens.space(8);

  return (
    <ScrollView contentContainerStyle={{ alignItems: 'center', padding: tokens.space(4), gap: tokens.space(4), paddingBottom: 220 }}>
      {Array.from({ length: pages }).map((_, n) => (
        <PageImage key={n} uri={api.documentPageUrl(id, n)} width={pageWidth} border={colors.border} />
      ))}
    </ScrollView>
  );
}

function PageImage({ uri, width, border }: { uri: string; width: number; border: string }) {
  // Default to US-letter aspect until the real dimensions load.
  const [height, setHeight] = useState(width * 1.294);
  useEffect(() => {
    let alive = true;
    Image.getSize(
      uri,
      (w, h) => alive && w > 0 && setHeight((width * h) / w),
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [uri, width]);
  return (
    <Image
      source={{ uri }}
      style={{ width, height, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: border }}
      resizeMode="contain"
    />
  );
}
