import type { ReactNode } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { SymbolView } from '@/lib/symbols';
import { colors, continuous, radius, space, useAccent } from '@/lib/theme';

/** Inset-grouped card; children are rows. */
export const Card = ({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) => (
  <View style={[{ backgroundColor: colors.secondaryGroupedBackground, borderRadius: radius.card, overflow: 'hidden' }, continuous, style]}>{children}</View>
);

export const Separator = () => <View style={{ height: 0.5, backgroundColor: colors.separator, marginLeft: space.md }} />;

export const SectionHeader = ({ children }: { children: string }) => (
  <Text style={{ color: colors.secondaryLabel, fontSize: 13, textTransform: 'uppercase', paddingHorizontal: space.md, marginBottom: -space.base + 2 }}>{children}</Text>
);

export const Footnote = ({ children, tone }: { children: ReactNode; tone?: 'error' }) => (
  <Text style={{ color: tone === 'error' ? colors.destructive : colors.secondaryLabel, fontSize: 13, lineHeight: 18, paddingHorizontal: space.md }}>{children}</Text>
);

/** Row with a title and optional trailing control / value; tappable when onPress is set. */
export function Row({ title, value, onPress, destructive, disabled, children, accent }: {
  title: string; value?: string; onPress?: () => void; destructive?: boolean; disabled?: boolean; children?: ReactNode; accent?: boolean;
}) {
  const tint = useAccent();
  const color = destructive ? colors.destructive : accent ? tint : colors.label;
  const body = (
    <View style={{ minHeight: 44, paddingHorizontal: space.md, paddingVertical: space.base, flexDirection: 'row', alignItems: 'center', gap: space.base, opacity: disabled ? 0.4 : 1 }}>
      <Text style={{ color, fontSize: 17, flex: 1 }}>{title}</Text>
      {value ? <Text style={{ color: colors.secondaryLabel, fontSize: 17 }}>{value}</Text> : null}
      {children}
    </View>
  );
  return onPress
    ? <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => ({ backgroundColor: pressed ? colors.fill : undefined })}>{body}</Pressable>
    : body;
}

/** Pill action: filled with accent when primary, tinted text otherwise. */
export function Pill({ label, onPress, icon, primary = true, disabled }: { label: string; onPress: () => void; icon?: 'plus'; primary?: boolean; disabled?: boolean }) {
  const tint = useAccent();
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
      style={({ pressed }) => [{ minHeight: 44, paddingHorizontal: space.md, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.base, backgroundColor: primary ? tint : colors.fill, opacity: pressed || disabled ? 0.6 : 1 }, continuous]}>
      {icon ? <SymbolView name={icon} size={16} tintColor={primary ? colors.background : tint} /> : null}
      <Text style={{ color: primary ? colors.background : tint, fontSize: 17, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

/** Project image, or a monogram tile when none is set. */
export function ProjectTile({ name, image, size = 40 }: { name: string; image?: string; size?: number }) {
  const box = { width: size, height: size, borderRadius: size >= 64 ? radius.card : radius.control, overflow: 'hidden' as const };
  return image
    ? <View style={[box, continuous]}><Image source={{ uri: image }} style={{ width: size, height: size }} accessibilityLabel={`${name} image`} /></View>
    : (
      <View style={[box, continuous, { backgroundColor: colors.fill, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: colors.secondaryLabel, fontSize: size * 0.45, fontWeight: '600' }}>{[...name.trim()][0]?.toUpperCase() ?? '?'}</Text>
      </View>
    );
}
