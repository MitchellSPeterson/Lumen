import { Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from '@/lib/symbols';
import * as Haptics from 'expo-haptics';
import { descendants, validParent, type WorkItem } from '@shared/domain';
import { useItem, useProjectItems, useStore } from '@/lib/store';
import { colors, continuous, radius, space, useAccent } from '@/lib/theme';
import { kindSymbol } from '@/components/item/meta';

export default function MovePicker() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const item = useItem(itemId);
  const items = useProjectItems(item?.projectId ?? '');
  const accent = useAccent();
  if (!item) return null;
  const blocked = descendants(items, item.id);
  // Depth-first tree; self and descendants are skipped, so validParent holds for every row.
  const rows: { item: WorkItem | null; depth: number }[] = [{ item: null, depth: 0 }];
  const walk = (parentId: string | null, depth: number) => {
    for (const i of items.filter(x => x.parentId === parentId).sort((a, b) => a.order - b.order)) {
      if (i.id === item.id || blocked.has(i.id) || !validParent(items, item, i.id)) continue;
      rows.push({ item: i, depth }); walk(i.id, depth + 1);
    }
  };
  walk(null, 0);
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.groupedBackground }} contentContainerStyle={{ padding: space.md }}>
      <View style={{ backgroundColor: colors.secondaryGroupedBackground, borderRadius: radius.card, ...continuous, overflow: 'hidden' }}>
        {rows.map(({ item: p, depth }, n) => {
          const current = (p?.id ?? null) === item.parentId;
          return (
            <Pressable key={p?.id ?? 'top'} accessibilityState={{ selected: current }}
              onPress={() => { useStore.getState().moveItem(item.id, p?.id ?? null); void Haptics.selectionAsync(); router.back(); }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.base, paddingLeft: space.md + depth * 20, paddingRight: space.md, minHeight: 44, borderBottomWidth: n < rows.length - 1 ? 0.5 : 0, borderBottomColor: colors.separator }}>
              <SymbolView name={p ? kindSymbol[p.kind] : 'tray.full'} size={16} tintColor={colors.secondaryLabel} />
              <Text numberOfLines={1} style={{ flex: 1, color: colors.label, fontSize: 17, paddingVertical: 12 }}>{p?.title ?? 'Top level'}</Text>
              {current && <SymbolView name="checkmark" size={16} weight="semibold" tintColor={accent} />}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
