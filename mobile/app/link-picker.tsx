import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from '@/lib/symbols';
import * as Haptics from 'expo-haptics';
import { useItem, useItemLinks, useProjectItems, useStore } from '@/lib/store';
import { colors, continuous, radius, space } from '@/lib/theme';
import { kindSymbol } from '@/components/item/meta';

export default function LinkPicker() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const item = useItem(itemId);
  const items = useProjectItems(item?.projectId ?? '');
  const links = useItemLinks(itemId);
  const [q, setQ] = useState('');
  if (!item) return null;
  const linked = new Set(links.flatMap(l => [l.sourceId, l.targetId]));
  const needle = q.trim().toLowerCase();
  const rows = items.filter(i => i.id !== item.id && !linked.has(i.id) && (!needle || i.title.toLowerCase().includes(needle)));
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: colors.groupedBackground }} contentContainerStyle={{ padding: space.md, gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.base, backgroundColor: colors.secondaryGroupedBackground, borderRadius: radius.control, ...continuous, paddingHorizontal: space.md, minHeight: 44 }}>
        <SymbolView name="magnifyingglass" size={16} tintColor={colors.secondaryLabel} />
        <TextInput onChangeText={setQ} placeholder="Search items" placeholderTextColor={colors.secondaryLabel} autoCorrect={false} clearButtonMode="while-editing" returnKeyType="search"
          style={{ flex: 1, color: colors.label, fontSize: 17, minHeight: 44 }} />
      </View>
      {rows.length === 0
        ? <Text style={{ color: colors.secondaryLabel, fontSize: 15, textAlign: 'center', paddingTop: space.lg }}>{needle ? 'No matching items' : 'No items to link'}</Text>
        : <View style={{ backgroundColor: colors.secondaryGroupedBackground, borderRadius: radius.card, ...continuous, overflow: 'hidden' }}>
            {rows.map((i, n) => (
              <Pressable key={i.id} onPress={() => { useStore.getState().addLink(item.projectId, item.id, i.id); void Haptics.selectionAsync(); router.back(); }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space.base, paddingHorizontal: space.md, minHeight: 44, borderBottomWidth: n < rows.length - 1 ? 0.5 : 0, borderBottomColor: colors.separator }}>
                <SymbolView name={kindSymbol[i.kind]} size={16} tintColor={colors.secondaryLabel} />
                <Text numberOfLines={1} style={{ flex: 1, color: colors.label, fontSize: 17, paddingVertical: 12 }}>{i.title}</Text>
              </Pressable>
            ))}
          </View>}
    </ScrollView>
  );
}
