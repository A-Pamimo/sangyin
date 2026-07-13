import { useEffect, useRef, useState } from 'react';
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

import { PdfHighlight } from '../api/types';
import { useApi } from '../store/appStore';
import { tokens, useTheme } from '../theme';
import { Muted } from './ui';

/**
 * Renders a stored PDF as scrollable page images (the backend rasterizes each
 * page, so nothing ever hits the browser's PDF/download handler). The spoken
 * sentence is highlighted on the page and auto-scrolled into view, using
 * per-sentence bounding boxes from the backend.
 */
export function PdfView({ id, activeIndex }: { id: string; activeIndex: number }) {
  const api = useApi();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [pages, setPages] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const [highlights, setHighlights] = useState<Record<number, PdfHighlight>>({});

  const scrollRef = useRef<ScrollView>(null);
  const pageLayout = useRef<Record<number, { y: number; h: number }>>({});

  useEffect(() => {
    let alive = true;
    api
      .pdfPageCount(id)
      .then((n) => alive && setPages(n))
      .catch(() => alive && setError(true));
    api
      .pdfHighlights(id)
      .then((h) => alive && setHighlights(h))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [id, api]);

  const active = highlights[activeIndex];

  // Follow the spoken sentence: scroll its page (and line) into view.
  useEffect(() => {
    if (!active) return;
    const pl = pageLayout.current[active.page];
    if (!pl) return;
    const top = active.rects[0]?.[1] ?? 0;
    scrollRef.current?.scrollTo({ y: pl.y + top * pl.h - 160, animated: true });
  }, [activeIndex, active]);

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: tokens.space(6) }}>
        <Muted style={{ textAlign: 'center' }}>Could not load the PDF pages.</Muted>
        <Pressable onPress={() => Linking.openURL(api.documentFileUrl(id)).catch(() => {})} style={{ marginTop: 12 }}>
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
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={{ alignItems: 'center', padding: tokens.space(4), gap: tokens.space(4), paddingBottom: 220 }}
    >
      {Array.from({ length: pages }).map((_, n) => (
        <PageImage
          key={n}
          uri={api.documentPageUrl(id, n)}
          width={pageWidth}
          border={colors.border}
          highlight={colors.accent}
          rects={active?.page === n ? active.rects : null}
          onMeasured={(y, h) => {
            pageLayout.current[n] = { y, h };
          }}
        />
      ))}
    </ScrollView>
  );
}

function PageImage({
  uri,
  width,
  border,
  highlight,
  rects,
  onMeasured,
}: {
  uri: string;
  width: number;
  border: string;
  highlight: string;
  rects: number[][] | null;
  onMeasured: (y: number, h: number) => void;
}) {
  const [height, setHeight] = useState(width * 1.294); // US-letter until measured
  const yRef = useRef(0);

  useEffect(() => {
    let alive = true;
    Image.getSize(
      uri,
      (w, h) => {
        if (alive && w > 0) {
          const hh = (width * h) / w;
          setHeight(hh);
          onMeasured(yRef.current, hh);
        }
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [uri, width]);

  return (
    <View
      onLayout={(e) => {
        yRef.current = e.nativeEvent.layout.y;
        onMeasured(e.nativeEvent.layout.y, height);
      }}
      style={{ width, height, borderRadius: 8, borderWidth: 1, borderColor: border, overflow: 'hidden', backgroundColor: '#fff' }}
    >
      <Image source={{ uri }} style={{ width, height }} resizeMode="contain" />
      {rects?.map(([x0, y0, x1, y1], i) => (
        <View
          key={i}
          style={{
            pointerEvents: 'none',
            position: 'absolute',
            left: x0 * width,
            top: y0 * height,
            width: (x1 - x0) * width,
            height: (y1 - y0) * height,
            backgroundColor: highlight,
            opacity: 0.28,
            borderRadius: 3,
          }}
        />
      ))}
    </View>
  );
}
