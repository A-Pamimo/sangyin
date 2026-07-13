import { setAudioModeAsync } from 'expo-audio';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';

import { BootScreen } from '../src/fx/BootScreen';
import { sfx } from '../src/sfx/sfx';
import { useAppStore } from '../src/store/appStore';
import { useTheme } from '../src/theme';

export default function RootLayout() {
  const t = useTheme();
  const sfxEnabled = useAppStore((s) => s.sfxEnabled);

  useEffect(() => {
    // Keep audio playing when the app is backgrounded / the screen is locked.
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    }).catch(() => {});
  }, []);

  // Bind the UI-sound layer to the persisted preference (no-op on native).
  useEffect(() => {
    sfx.setEnabled(sfxEnabled);
  }, [sfxEnabled]);

  // Web: unlock the AudioContext on the first user gesture (autoplay policy).
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const unlock = () => sfx.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style={t.isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.colors.bg },
          headerTintColor: t.colors.text,
          headerShadowVisible: false,
          headerTitleStyle: { fontFamily: t.fonts.mono, fontWeight: '700' },
          contentStyle: { backgroundColor: t.colors.bg },
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="library" options={{ title: 'Your library' }} />
        <Stack.Screen name="import" options={{ title: 'Import' }} />
        <Stack.Screen name="reader" options={{ title: 'Reader' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
      {/* Boot intro sits above everything; self-dismisses once per launch. */}
      <BootScreen />
    </View>
  );
}
