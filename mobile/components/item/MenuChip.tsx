import * as Haptics from 'expo-haptics';
import { Host, Menu, Button } from '@expo/ui/swift-ui';
import { buttonBorderShape, buttonStyle, controlSize, foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'sf-symbols-typescript';

export interface MenuOption<T extends string> { value: T; label: string; icon?: SFSymbol }

/** Capsule button that opens a native menu; `value` gets a checkmark. */
export function MenuChip<T extends string>({ label, icon, options, value, onSelect }: {
  label: string; icon: SFSymbol; options: MenuOption<T>[]; value?: T; onSelect(v: T): void;
}) {
  return (
    <Host matchContents>
      <Menu label={label} systemImage={icon} modifiers={[buttonStyle('bordered'), buttonBorderShape('capsule'), controlSize('small'), foregroundStyle({ type: 'hierarchical', style: 'primary' })]}>
        {options.map(o => (
          <Button key={o.value} label={o.label} systemImage={o.value === value ? 'checkmark' : o.icon}
            onPress={() => { void Haptics.selectionAsync(); onSelect(o.value); }} />
        ))}
      </Menu>
    </Host>
  );
}
