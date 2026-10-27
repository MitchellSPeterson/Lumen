import * as Haptics from 'expo-haptics';
import { Pressable, Text } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';
import { actionSheet } from '@/components/Dialogs';
import { SymbolView } from '@/lib/symbols';
import { colors, radius, space } from '@/lib/theme';

export interface MenuOption<T extends string> { value: T; label: string; icon?: SFSymbol }

/** Outlined chip that opens a bottom sheet; `value` gets a checkmark. iOS uses a native menu (MenuChip.tsx). */
export function MenuChip<T extends string>({ label, icon, options, value, onSelect }: {
  label: string; icon: SFSymbol; options: MenuOption<T>[]; value?: T; onSelect(v: T): void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label}
      onPress={() => actionSheet(label, options.map(o => [o.label, () => { void Haptics.selectionAsync(); onSelect(o.value); }, false, o.value === value]))}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.base, minHeight: 32, paddingHorizontal: 12, borderRadius: radius.control, borderWidth: 1, borderColor: colors.separator }}>
      <SymbolView name={icon} size={18} tintColor={colors.secondaryLabel} />
      <Text style={{ color: colors.label, fontSize: 14, fontWeight: '500' }}>{label}</Text>
    </Pressable>
  );
}
