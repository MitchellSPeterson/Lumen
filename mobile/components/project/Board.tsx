import { useRef, useState, type ReactElement } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SymbolView } from '@/lib/symbols';
import { router } from 'expo-router';
import { kindLabels, planningLaneLabels, statusLabels, type WorkItem } from '@shared/domain';
import { colors, continuous, radius, space, useAccent } from '@/lib/theme';
import { KindGlyph, StatusGlyph } from './glyphs';
import { itemMenu } from './itemActions';
import { statuses } from './model';

function Card({ item, parent }: { item: WorkItem; parent?: string }) {
  return (
    <Pressable onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })} onLongPress={() => itemMenu(item, true)} accessibilityLabel={item.title}
      style={({ pressed }) => ({ gap: space.base, padding: space.md, borderRadius: radius.card, backgroundColor: pressed ? colors.fill : colors.secondaryGroupedBackground, ...continuous })}>
      <View style={{ flexDirection: 'row', gap: space.base }}>
        <View style={{ paddingTop: 3 }}><KindGlyph kind={item.kind} /></View>
        <Text numberOfLines={3} style={{ flex: 1, fontSize: 17, fontWeight: '600', color: colors.label }}>{item.title}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.base }}>
        <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, color: colors.secondaryLabel }}>{parent ?? kindLabels[item.kind]}</Text>
        {item.priority === 'high' && <SymbolView name="flag.fill" size={13} tintColor={colors.warning} />}
        <Text style={{ fontSize: 13, color: colors.secondaryLabel }}>{item.planningLane ? planningLaneLabels[item.planningLane] : 'Unplanned'}</Text>
      </View>
    </Pressable>
  );
}

/** One status column per page; the page header doubles as the pager indicator. */
export function Board({ items, header, empty }: { items: WorkItem[]; header: ReactElement; empty: ReactElement | null }) {
  const { width } = useWindowDimensions();
  const accent = useAccent();
  const pager = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const titles = new Map(items.map(i => [i.id, i.title]));
  const go = (p: number) => { setPage(p); pager.current?.scrollTo({ x: p * width, animated: true }); };
  const cards = statuses.map(s => items.filter(i => i.status === s));
  if (empty) return <ScrollView contentInsetAdjustmentBehavior="automatic">{header}{empty}</ScrollView>;
  return (
    <View style={{ flex: 1 }}>
      {header}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md, paddingBottom: space.base }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.base }}>
          <StatusGlyph status={statuses[page]} size={20} />
          <Text accessibilityRole="header" style={{ fontSize: 17, fontWeight: '600', color: colors.label }}>{statusLabels[statuses[page]]}</Text>
          <Text style={{ fontSize: 17, color: colors.secondaryLabel, fontVariant: ['tabular-nums'] }}>{cards[page].length}</Text>
        </View>
        <View style={{ flexDirection: 'row' }}>
          {statuses.map((s, i) => (
            <Pressable key={s} onPress={() => go(i)} accessibilityRole="button" accessibilityLabel={`${statusLabels[s]}, ${cards[i].length}`} style={{ width: 28, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i === page ? accent : colors.fill }} />
            </Pressable>
          ))}
        </View>
      </View>
      <ScrollView ref={pager} horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ flex: 1 }}
        onMomentumScrollEnd={e => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}>
        {statuses.map((s, i) => (
          <View key={s} style={{ width }}>
            <FlashList
              data={cards[i]} keyExtractor={c => c.id} contentInsetAdjustmentBehavior="automatic"
              contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: 112 }}
              ItemSeparatorComponent={() => <View style={{ height: space.base }} />}
              ListEmptyComponent={<Text style={{ textAlign: 'center', color: colors.secondaryLabel, fontSize: 15, paddingVertical: space.lg }}>No items here</Text>}
              renderItem={({ item }) => <Card item={item} parent={item.parentId ? titles.get(item.parentId) : undefined} />}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
