import { memo, useRef, type ReactElement } from 'react';
import { Pressable, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { SymbolView } from '@/lib/symbols';
import { router } from 'expo-router';
import { planningLaneLabels } from '@shared/domain';
import { useStore } from '@/lib/store';
import { colors, space, useAccent } from '@/lib/theme';
import { KindGlyph, StatusGlyph } from './glyphs';
import { itemMenu, removeItems, toggleDone } from './itemActions';
import type { Row } from './model';

interface RowProps { row: Row; projectId: string; selecting: boolean; checked: boolean; onCheck: (id: string) => void }

const OutlineRow = memo(function OutlineRow({ row, projectId, selecting, checked, onCheck }: RowProps) {
  const { item, depth, children, collapsed, context } = row;
  const accent = useAccent();
  const swipe = useRef<SwipeableMethods>(null);
  const done = item.status === 'done';
  const indent = Math.min(depth, 4) * 16;
  const action = (bg: string, symbol: 'checkmark' | 'trash', label: string, fn: () => void) => (
    <Pressable onPress={() => { swipe.current?.close(); fn(); }} accessibilityRole="button" accessibilityLabel={label}
      style={{ width: 80, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <SymbolView name={symbol} size={20} weight="semibold" tintColor="#fff" />
    </Pressable>
  );
  return (
    <ReanimatedSwipeable ref={swipe} enabled={!selecting} overshootLeft={false} overshootRight={false}
      renderLeftActions={() => action(accent, 'checkmark', done ? 'Mark to do' : 'Complete', () => toggleDone(item))}
      renderRightActions={() => action(colors.destructive as unknown as string, 'trash', 'Delete', () => removeItems([item]))}>
      <Pressable
        onPress={() => selecting ? onCheck(item.id) : router.push({ pathname: '/item/[id]', params: { id: item.id } })}
        onLongPress={selecting ? undefined : () => itemMenu(item)}
        accessibilityLabel={`${item.title}, ${done ? 'done' : item.status === 'todo' ? 'to do' : 'in progress'}`}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingLeft: space.tight + indent, backgroundColor: pressed ? colors.fill : colors.background })}>
        {selecting ? (
          <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <SymbolView name={checked ? 'checkmark.circle.fill' : 'circle'} size={22} tintColor={checked ? accent : colors.tertiaryLabel} />
          </View>
        ) : (
          <Pressable onPress={() => toggleDone(item)} accessibilityRole="button" accessibilityLabel={done ? 'Mark to do' : 'Mark done'} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <StatusGlyph status={item.status} />
          </Pressable>
        )}
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.base, paddingVertical: space.base }}>
          <KindGlyph kind={item.kind} />
          <Text numberOfLines={2} style={{ flex: 1, fontSize: 17, color: done ? colors.secondaryLabel : context ? colors.tertiaryLabel : colors.label, textDecorationLine: done ? 'line-through' : 'none' }}>{item.title}</Text>
          {item.priority === 'high' && <SymbolView name="flag.fill" size={13} tintColor={colors.warning} />}
          {item.planningLane && <Text style={{ fontSize: 13, color: colors.secondaryLabel }}>{planningLaneLabels[item.planningLane]}</Text>}
          {children > 0 && !selecting && <Text style={{ fontSize: 13, color: colors.secondaryLabel, fontVariant: ['tabular-nums'] }}>{children}</Text>}
        </View>
        {children > 0 && !selecting ? (
          <Pressable onPress={() => useStore.getState().toggleCollapsed(projectId, item.id)} accessibilityRole="button" accessibilityLabel={collapsed ? 'Expand' : 'Collapse'} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <SymbolView name="chevron.right" size={13} weight="semibold" tintColor={colors.tertiaryLabel} style={{ transform: [{ rotate: collapsed ? '0deg' : '90deg' }] }} />
          </Pressable>
        ) : <View style={{ width: space.md }} />}
        <View pointerEvents="none" style={{ position: 'absolute', left: 44 + indent, right: 0, bottom: 0, height: 0.5, backgroundColor: colors.separator }} />
      </Pressable>
    </ReanimatedSwipeable>
  );
});

export function Outline({ rows, projectId, selecting, checked, onCheck, header, empty }: {
  rows: Row[]; projectId: string; selecting: boolean; checked: Set<string>; onCheck: (id: string) => void; header: ReactElement; empty: ReactElement | null;
}) {
  return (
    <FlashList
      data={rows} keyExtractor={r => r.item.id} extraData={{ selecting, checked }}
      contentInsetAdjustmentBehavior="automatic" keyboardDismissMode="on-drag"
      contentContainerStyle={{ paddingBottom: 112 }}
      ListHeaderComponent={header} ListEmptyComponent={empty}
      renderItem={({ item: row }) => <OutlineRow row={row} projectId={projectId} selecting={selecting} checked={checked.has(row.item.id)} onCheck={onCheck} />}
    />
  );
}
