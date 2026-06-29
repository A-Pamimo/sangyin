import { setAudioModeAsync } from 'expo-audio';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { theme } from '../src/theme';

export default function RootLayout() {
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
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTintColor: theme.colors.text,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: theme.colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Sangyin 聲音' }} />
        <Stack.Screen name="import" options={{ title: 'Import' }} />
        <Stack.Screen name="reader" options={{ title: 'Reader' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
    </>
  );
}
