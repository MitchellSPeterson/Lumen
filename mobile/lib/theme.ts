import { useEffect } from 'react';
import { Appearance, PlatformColor, useColorScheme, type ColorValue } from 'react-native';
import { useStore } from './store';
import type { AccentId } from './storage';

// Light = desktop --accent-text; dark = lighter variant for contrast on dark surfaces.
const tint: Record<AccentId, { light: string; dark: string }> = {
  blue: { light: '#22628a', dark: '#8fcdf5' },
  violet: { light: '#6950a2', dark: '#c3b2f5' },
  green: { light: '#276c4b', dark: '#8fd6b1' },
  rose: { light: '#994664', dark: '#eba6c0' },
  amber: { light: '#86600f', dark: '#e8c56c' },
};

const ios = {
  label: PlatformColor('label'),
  secondaryLabel: PlatformColor('secondaryLabel'),
  tertiaryLabel: PlatformColor('tertiaryLabel'),
  background: PlatformColor('systemBackground'),
  secondaryBackground: PlatformColor('secondarySystemBackground'),
  groupedBackground: PlatformColor('systemGroupedBackground'),
  secondaryGroupedBackground: PlatformColor('secondarySystemGroupedBackground'),
  fill: PlatformColor('systemFill'),
  separator: PlatformColor('separator'),
  destructive: PlatformColor('systemRed'),
  success: PlatformColor('systemGreen'),
  warning: PlatformColor('systemOrange'),
};

// Material 3 neutrals [light, dark]. Android has no night-aware PlatformColor, so values are read per access
// and the root layout remounts screens when the scheme changes (see screenLayout in _layout).
const material: Record<keyof typeof ios, [string, string]> = {
  label: ['#1b1b1f', '#e4e2e6'],
  secondaryLabel: ['#46464f', '#c6c6d0'],
  tertiaryLabel: ['#767680', '#90909a'],
  background: ['#fbf8fd', '#121316'],
  secondaryBackground: ['#efedf1', '#1f1f23'],
  groupedBackground: ['#f1eff4', '#121316'],
  secondaryGroupedBackground: ['#ffffff', '#1f1f23'],
  fill: ['#e3e1e9', '#38393f'],
  separator: ['#c7c5d0', '#46464f'],
  destructive: ['#ba1a1a', '#ffb4ab'],
  success: ['#1b6d3a', '#7fd99a'],
  warning: ['#a15c00', '#ffb95c'],
};

export const colors: Record<keyof typeof ios, ColorValue> = process.env.EXPO_OS === 'android'
  ? new Proxy({} as Record<keyof typeof ios, ColorValue>, { get: (_, k: keyof typeof ios) => material[k][Appearance.getColorScheme() === 'dark' ? 1 : 0] })
  : ios;

/** Module-level styles read `colors` once at import, which goes stale on Android after a scheme change; wrap them so each access re-reads. */
export const live = <T extends object>(make: () => T): T => new Proxy({} as T, { get: (_, k) => make()[k as keyof T] });

export const radius = { card: 12, control: 10, pill: 999 } as const;
export const space = { tight: 4, base: 8, md: 16, lg: 24 } as const;
export const continuous = { borderCurve: 'continuous' } as const;

/** Applies prefs.mode to the app; call once near the root. */
export function useApplyColorScheme() {
  const mode = useStore(s => s.prefs.mode);
  useEffect(() => { Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode); }, [mode]);
}

export function useAccent(): string {
  const id = useStore(s => s.prefs.accent);
  return tint[id][useColorScheme() === 'dark' ? 'dark' : 'light'];
}
