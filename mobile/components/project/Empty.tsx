import { Pressable, Text, View } from 'react-native';
import type { SFSymbol } from 'expo-symbols';
import { SymbolView } from '@/lib/symbols';
import { colors, continuous, radius, space, useAccent } from '@/lib/theme';

export function Empty({ symbol, title, body, action, onAction }: { symbol: SFSymbol; title: string; body: string; action?: string; onAction?: () => void }) {
  const accent = useAccent();
  return (
    <View style={{ alignItems: 'center', gap: space.base, paddingHorizontal: space.lg, paddingVertical: 64 }}>
      <SymbolView name={symbol} size={36} tintColor={colors.tertiaryLabel} />
      <Text style={{ color: colors.label, fontSize: 20, fontWeight: '600', textAlign: 'center' }}>{title}</Text>
      <Text style={{ color: colors.secondaryLabel, fontSize: 15, textAlign: 'center' }}>{body}</Text>
      {action && (
        <Pressable onPress={onAction} accessibilityRole="button" style={({ pressed }) => ({ marginTop: space.base, minHeight: 44, justifyContent: 'center', paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: accent, opacity: pressed ? 0.8 : 1, ...continuous })}>
          <Text style={{ color: '#fff', fontSize: 17, fontWeight: '600' }}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}
