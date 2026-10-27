import { Pressable, ScrollView, Text, View } from 'react-native';
import { SymbolView } from '@/lib/symbols';
import { statusLabels } from '@shared/domain';
import { colors, continuous, radius, space } from '@/lib/theme';
import { priorityLabels, scopeHint, scopeLabel, type Filters } from './model';

/** Section title + hint (desktop copy) and removable chips for each active filter. */
export function SectionHeader({ filters, onChange, count }: { filters: Filters; onChange: (f: Filters) => void; count: number }) {
  const chips: [string, Filters][] = [];
  if (filters.scope !== 'all') chips.push([scopeLabel[filters.scope], { ...filters, scope: 'all' }]);
  if (filters.status) chips.push([statusLabels[filters.status], { ...filters, status: null }]);
  if (filters.priority) chips.push([`${priorityLabels[filters.priority]} priority`, { ...filters, priority: null }]);
  if (filters.tag) chips.push([`#${filters.tag}`, { ...filters, tag: null }]);
  return (
    <View style={{ gap: space.base, paddingTop: space.base, paddingBottom: space.base }}>
      <View style={{ paddingHorizontal: space.md, gap: space.tight }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Text accessibilityRole="header" style={{ color: colors.label, fontSize: 22, fontWeight: '700' }}>{scopeLabel[filters.scope]}</Text>
          <Text style={{ color: colors.secondaryLabel, fontSize: 15, fontVariant: ['tabular-nums'] }}>{count} {count === 1 ? 'item' : 'items'}</Text>
        </View>
        <Text style={{ color: colors.secondaryLabel, fontSize: 13 }}>{scopeHint(filters.scope)}</Text>
      </View>
      {chips.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.md, gap: space.base }}>
          {chips.map(([label, next]) => (
            <Pressable key={label} onPress={() => onChange(next)} accessibilityRole="button" accessibilityLabel={`Remove filter ${label}`} hitSlop={{ top: 6, bottom: 6 }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.tight, minHeight: 32, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.fill, opacity: pressed ? 0.6 : 1, ...continuous })}>
              <Text style={{ color: colors.label, fontSize: 15 }}>{label}</Text>
              <SymbolView name="xmark" size={11} weight="semibold" tintColor={colors.secondaryLabel} />
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
