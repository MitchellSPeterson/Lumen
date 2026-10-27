import { memo, useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import type { SFSymbol } from 'expo-symbols';
import { SymbolView } from '@/lib/symbols';
import { kindLabels, statusLabels, type ItemKind, type Status, type WorkItem } from '@shared/domain';
import { colors, continuous, live, useAccent } from '../../lib/theme';

export const NODE_W = 224;
export const NODE_H = 86;
const SPRING = { duration: 400, dampingRatio: 1 };

const kindSymbol: Record<ItemKind, SFSymbol> = { idea: 'lightbulb', todo: 'checklist', feature: 'sparkles', bug: 'ladybug' };
const statusSymbol: Record<Status, SFSymbol> = { todo: 'circle', in_progress: 'circle.lefthalf.filled', done: 'checkmark.circle.fill' };

/** 44pt hit area, 30pt visual circle. Sits outside the card so its tap never competes with the card's gestures. */
function Handle({ symbol, label, onPress, children, top }: { symbol: SFSymbol; label: string; onPress: () => void; children?: ReactNode; top: number }) {
  const accent = useAccent();
  const press = useSharedValue(0);
  const tap = Gesture.Tap()
    .onBegin(() => { press.set(withSpring(1, SPRING)); })
    .onEnd((_, ok) => { if (ok) scheduleOnRN(onPress); })
    .onFinalize(() => { press.set(withSpring(0, SPRING)); });
  const style = useAnimatedStyle(() => ({ transform: [{ scale: 1 - 0.1 * press.get() }] }));
  return (
    <GestureDetector gesture={tap}>
      <View accessible accessibilityRole="button" accessibilityLabel={label} onAccessibilityTap={onPress} style={[s.hit, { top }]}>
        <Animated.View style={[s.circle, style]}>
          <SymbolView name={symbol} size={13} weight="semibold" tintColor={accent} />
          {children}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

interface Props {
  item: WorkItem; childCount: number; collapsed: boolean; dragging: boolean; scale: SharedValue<number>;
  onOpen(id: string): void; onAdd(id: string): void; onToggle(id: string): void;
  onDrop(id: string, x: number, y: number): void; onDragState(id: string | null): void;
}

function ItemNode({ item, childCount, collapsed, dragging, scale, onOpen, onAdd, onToggle, onDrop, onDragState }: Props) {
  const accent = useAccent();
  const px = useSharedValue(item.x), py = useSharedValue(item.y);
  const dx = useSharedValue(0), dy = useSharedValue(0), lift = useSharedValue(0), active = useSharedValue(false);
  useEffect(() => { px.set(item.x); py.set(item.y); }, [item.x, item.y, px, py]);
  const id = item.id;

  // Long-press then drag: only this node moves (desktop parity, children stay put).
  const drag = Gesture.Pan().activateAfterLongPress(300)
    .onStart(() => {
      active.set(true);
      lift.set(withSpring(1, SPRING));
      scheduleOnRN(Haptics.impactAsync, Haptics.ImpactFeedbackStyle.Medium);
      scheduleOnRN(onDragState, id);
    })
    .onUpdate(e => { const z = scale.get(); dx.set(e.translationX / z); dy.set(e.translationY / z); })
    .onEnd(() => {
      px.set(px.get() + dx.get()); py.set(py.get() + dy.get()); dx.set(0); dy.set(0);
      scheduleOnRN(onDrop, id, Math.round(px.get()), Math.round(py.get()));
    })
    .onFinalize(() => {
      lift.set(withSpring(0, SPRING));
      if (active.get()) { active.set(false); scheduleOnRN(onDragState, null); }
    });
  const tap = Gesture.Tap().onEnd((_, ok) => { if (ok) scheduleOnRN(onOpen, id); });

  const box = useAnimatedStyle(() => ({
    transform: [{ translateX: px.get() + dx.get() }, { translateY: py.get() + dy.get() }, { scale: 1 + 0.03 * lift.get() }],
  }));
  const glow = useAnimatedStyle(() => ({ opacity: lift.get() }));
  const done = item.status === 'done';

  return (
    <Animated.View style={[s.node, box, dragging && { zIndex: 10 }]}>
      <Animated.View pointerEvents="none" style={[s.card, s.lifted, glow]} />
      <GestureDetector gesture={Gesture.Race(drag, tap)}>
        <View
          accessible accessibilityRole="button"
          accessibilityLabel={`${item.title}, ${kindLabels[item.kind]}, ${statusLabels[item.status]}`}
          accessibilityActions={[{ name: 'activate' }, { name: 'add', label: 'Add child' }, ...(childCount ? [{ name: 'toggle', label: collapsed ? 'Expand' : 'Collapse' }] : [])]}
          onAccessibilityAction={e => {
            const a = e.nativeEvent.actionName;
            if (a === 'activate') onOpen(id); else if (a === 'add') onAdd(id); else if (a === 'toggle') onToggle(id);
          }}
          style={[s.card, s.cardBody]}
        >
          <View style={s.row}>
            <SymbolView name={kindSymbol[item.kind]} size={13} tintColor={colors.secondaryLabel} />
            <Text style={s.kind} maxFontSizeMultiplier={1.2}>{kindLabels[item.kind]}</Text>
            <View style={{ flex: 1 }} />
            <SymbolView name={statusSymbol[item.status]} size={15} tintColor={done ? colors.success : item.status === 'in_progress' ? accent : colors.tertiaryLabel} />
          </View>
          <Text style={[s.title, done && { color: colors.secondaryLabel }]} numberOfLines={2} maxFontSizeMultiplier={1.2}>{item.title}</Text>
        </View>
      </GestureDetector>
      {childCount > 0 && (
        <Handle top={0} symbol={collapsed ? 'chevron.right' : 'chevron.down'} label={`${collapsed ? 'Expand' : 'Collapse'} ${childCount} children`} onPress={() => onToggle(id)}>
          {collapsed && <View style={s.badge}><Text style={s.badgeText}>{childCount}</Text></View>}
        </Handle>
      )}
      <Handle top={childCount > 0 ? 44 : 21} symbol="plus" label={`Add child to ${item.title}`} onPress={() => onAdd(id)} />
    </Animated.View>
  );
}
export default memo(ItemNode);

export const RootNode = memo(function RootNode({ name, count, onAdd }: { name: string; count: number; onAdd(): void }) {
  const accent = useAccent();
  return (
    <View style={s.rootAt}>
      <View accessible accessibilityLabel={`Project ${name}, ${count} items`} style={[s.card, s.cardBody, { borderColor: accent, borderWidth: 1.5 }]}>
        <View style={s.row}>
          <SymbolView name="folder.fill" size={14} tintColor={accent} />
          <Text style={s.kind} maxFontSizeMultiplier={1.2}>Project</Text>
        </View>
        <Text style={s.title} numberOfLines={2} maxFontSizeMultiplier={1.2}>{name}</Text>
        <Text style={s.kind} maxFontSizeMultiplier={1.2}>{count} {count === 1 ? 'item' : 'items'}</Text>
      </View>
      <Handle top={21} symbol="plus" label={`Add item to ${name}`} onPress={onAdd} />
    </View>
  );
});

const s = live(() => StyleSheet.create({
  node: { position: 'absolute', left: 0, top: 0, width: NODE_W, height: NODE_H },
  rootAt: { position: 'absolute', left: 0, top: 0, width: NODE_W, height: NODE_H },
  card: { position: 'absolute', left: 0, top: 0, width: NODE_W, height: NODE_H, borderRadius: 14, ...continuous },
  cardBody: { backgroundColor: colors.secondaryGroupedBackground, borderColor: colors.separator, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'space-between' },
  lifted: { backgroundColor: colors.secondaryGroupedBackground, boxShadow: '0 10 24 rgba(0,0,0,0.28)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  kind: { fontSize: 12, fontWeight: '500', color: colors.secondaryLabel },
  title: { fontSize: 15, fontWeight: '600', lineHeight: 19, color: colors.label },
  hit: { position: 'absolute', left: NODE_W + 6, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  circle: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.secondaryGroupedBackground, borderColor: colors.separator, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -6, right: -8, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.fill, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 11, fontWeight: '600', color: colors.label },
}));
