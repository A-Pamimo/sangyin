import { setAudioModeAsync } from 'expo-audio';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { useTheme } from '../src/theme';

export default function RootLayout() {
  const t = useTheme();

  useEffect(() => {
    // Keep audio playing when the app is backgrounded / the screen is locked.
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    }).catch(() => {});
  }, []);

  return (
    <>
      <StatusBar style={t.isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.colors.bg },
          headerTintColor: t.colors.text,
          headerShadowVisible: false,
          headerTitleStyle: { fontFamily: t.fonts.display, fontWeight: '700' },
          contentStyle: { backgroundColor: t.colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="library" options={{ title: 'Your library' }} />
        <Stack.Screen name="import" options={{ title: 'Import' }} />
        <Stack.Screen name="reader" options={{ title: 'Reader' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
    </>
  );
}
