import '@/lib/polyfill';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, Text, useColorScheme, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DialogHost } from '@/components/Dialogs';
import { useStore } from '@/lib/store';
import { colors, space, useAccent, useApplyColorScheme } from '@/lib/theme';

SplashScreen.preventAutoHideAsync();

// Takes the scheme as an argument so the React Compiler re-evaluates the (non-reactive) `colors` reads when it flips.
const androidChrome = (_scheme: string | null | undefined) => process.env.EXPO_OS !== 'android' ? {} : {
  headerStyle: { backgroundColor: colors.background as string }, headerTitleStyle: { color: colors.label as string },
  headerShadowVisible: false, contentStyle: { backgroundColor: colors.background as string },
};

export default function RootLayout() {
  const loaded = useStore(s => s.loaded);
  const loadError = useStore(s => s.loadError);
  const loadAll = useStore(s => s.loadAll);
  const accent = useAccent();
  const scheme = useColorScheme();
  useApplyColorScheme();
  useEffect(() => { void loadAll(); }, [loadAll]);
  useEffect(() => { if (loaded || loadError) void SplashScreen.hideAsync(); }, [loaded, loadError]);

  if (loadError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: space.lg, gap: space.md }}>
        <Text style={{ color: colors.label, fontSize: 22, fontWeight: '600' }}>Couldn't open your workspace</Text>
        <Text style={{ color: colors.secondaryLabel }}>{loadError}</Text>
        <Text style={{ color: colors.secondaryLabel }}>Your existing data has not been replaced.</Text>
        <Pressable onPress={() => void loadAll()}><Text style={{ color: accent, fontSize: 17 }}>Retry</Text></Pressable>
      </View>
    );
  }
  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}><ActivityIndicator /></View>;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Android colors are plain values read at render, so remount the navigator when the scheme flips (this resets the stack to Projects).
          ponytail: remounting only screen contents via screenLayout keeps the stack but loses per-screen header options; revisit if flips mid-project matter. */}
      <Stack key={scheme}
        screenOptions={{ headerTintColor: accent, ...androidChrome(scheme) }}>
        <Stack.Screen name="index" options={{ title: 'Projects', headerLargeTitle: true }} />
        <Stack.Screen name="project/[id]" options={{ title: '' }} />
        <Stack.Screen name="item/[id]" options={{ title: '' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="capture" options={{ presentation: 'formSheet', title: 'Capture', sheetAllowedDetents: [0.35, 0.6], sheetGrabberVisible: true }} />
        <Stack.Screen name="link-picker" options={{ presentation: 'formSheet', title: 'Related item', sheetAllowedDetents: [0.5, 1], sheetGrabberVisible: true }} />
        <Stack.Screen name="move-picker" options={{ presentation: 'formSheet', title: 'Move to', sheetAllowedDetents: [0.5, 1], sheetGrabberVisible: true }} />
        <Stack.Screen name="project-settings/[id]" options={{ presentation: 'modal', title: 'Project' }} />
        <Stack.Screen name="new-project" options={{ presentation: 'modal', title: 'New project' }} />
      </Stack>
      <DialogHost />
      {process.env.EXPO_OS === 'android' && <StatusBar style="auto" />}
    </GestureHandlerRootView>
  );
}
