import { Pressable, Text, useColorScheme } from 'react-native';
import type { SFSymbol } from 'expo-symbols';
import { SymbolView } from '@/lib/symbols';
import { colors, useAccent } from '@/lib/theme';

/** Android app-bar action: an icon, or text when no icon is given. (iOS uses Stack.Toolbar.) */
export function HeaderButton({ icon, label, onPress, disabled, tint }: { icon?: SFSymbol; label: string; onPress(): void; disabled?: boolean; tint?: string }) {
  const accent = useAccent();
  const scheme = useColorScheme(); // keyed below: `colors` reads are non-reactive, so re-create the content when it flips
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} android_ripple={{ borderless: true, radius: 24 }}
      style={{ minWidth: 48, height: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: icon ? 0 : 12, opacity: disabled ? 0.4 : 1 }}>
      {icon ? <SymbolView key={scheme} name={icon} size={24} tintColor={tint ?? colors.label} /> : <Text style={{ color: accent, fontSize: 16, fontWeight: '500' }}>{label}</Text>}
    </Pressable>
  );
}
