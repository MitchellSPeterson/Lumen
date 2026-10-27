import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useColorScheme, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDecay, withSpring,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Circle, Defs, Path, Pattern, Rect } from 'react-native-svg';
import { SymbolView } from '@/lib/symbols';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { WorkItem } from '@shared/domain';
import { useProject, useProjectItems, useProjectLinks, useProjectView, useStore } from '../../lib/store';
import { colors, continuous, live, useAccent } from '../../lib/theme';
import ItemNode, { NODE_H, NODE_W, RootNode } from './MapNode';

const MIN_ZOOM = 0.3, MAX_ZOOM = 2;
const SPRING = { duration: 400, dampingRatio: 1 };
const GRID = 24;
// World space is centered in a huge, content-less view so off-screen children stay hit-testable on iOS.
const OFF = 10000;
const WORLD = OFF * 2;
const isDefaultViewport = (v: { x: number; y: number; zoom: number }) => v.x === 40 && v.y === 40 && v.zoom === 0.85;

const Edge = memo(function Edge({ sx, sy, ex, ey, color, dashed, faded }: { sx: number; sy: number; ex: number; ey: number; color: string; dashed?: boolean; faded?: boolean }) {
  const c = Math.max(40, Math.abs(ex - sx) / 2), pad = 4;
  const ox = Math.min(sx, ex, sx + c, ex - c) - pad, oy = Math.min(sy, ey) - pad;
  const w = Math.max(sx, ex, sx + c, ex - c) + pad - ox, h = Math.max(sy, ey) + pad - oy;
  return (
    <Svg pointerEvents="none" width={w} height={h} style={{ position: 'absolute', left: OFF + ox, top: OFF + oy, opacity: faded ? 0.25 : 1 }}>
      <Path d={`M${sx - ox} ${sy - oy}C${sx + c - ox} ${sy - oy} ${ex - c - ox} ${ey - oy} ${ex - ox} ${ey - oy}`} stroke={color} strokeWidth={dashed ? 1.6 : 1.5} strokeDasharray={dashed ? '5 5' : undefined} fill="none" />
    </Svg>
  );
});

function MapButton({ symbol, label, onPress }: { symbol: 'arrow.up.left.and.arrow.down.right' | 'wand.and.stars'; label: string; onPress(): void }) {
  const accent = useAccent();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [s.ctl, pressed && { opacity: 0.5 }]}>
      <SymbolView name={symbol} size={18} tintColor={accent} />
    </Pressable>
  );
}

export default function MindMap({ projectId }: { projectId: string }) {
  const project = useProject(projectId);
  const items = useProjectItems(projectId);
  const links = useProjectLinks(projectId);
  const view = useProjectView(projectId);
  const accent = useAccent();
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [dragId, setDragId] = useState<string | null>(null);

  const tx = useSharedValue(view.viewport.x), ty = useSharedValue(view.viewport.y), z = useSharedValue(view.viewport.zoom);

  // ---- derived graph (collapsed descendants hidden) ----
  const { shown, childCount, byId } = useMemo(() => {
    const byId = new Map(items.map(i => [i.id, i]));
    const collapsed = new Set(view.collapsed);
    const childCount = new Map<string, number>();
    for (const i of items) if (i.parentId) childCount.set(i.parentId, (childCount.get(i.parentId) ?? 0) + 1);
    const hidden = (i: WorkItem) => {
      const seen = new Set<string>();
      for (let p = i.parentId && byId.get(i.parentId); p && !seen.has(p.id); p = p.parentId ? byId.get(p.parentId) : undefined) {
        if (collapsed.has(p.id)) return true;
        seen.add(p.id);
      }
      return false;
    };
    return { shown: items.filter(i => !hidden(i)), childCount, byId };
  }, [items, view.collapsed]);
  const shownIds = useMemo(() => new Set(shown.map(i => i.id)), [shown]);
  const collapsedSet = useMemo(() => new Set(view.collapsed), [view.collapsed]);

  // ---- viewport persistence (debounced, flushed on unmount) ----
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<{ x: number; y: number; zoom: number } | null>(null);
  const flush = useCallback(() => {
    clearTimeout(timer.current);
    if (pending.current) { useStore.getState().setView(projectId, { viewport: pending.current }); pending.current = null; }
  }, [projectId]);
  const persist = useCallback((x: number, y: number, zoom: number) => {
    pending.current = { x, y, zoom };
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 250);
  }, [flush]);
  useEffect(() => flush, [flush]);

  // ---- fit to content ----
  const bounds = useRef({ minX: 0, minY: 0, maxX: NODE_W, maxY: NODE_H });
  const sizeRef = useRef(size);
  sizeRef.current = size;
  bounds.current = shown.reduce((b, i) => ({
    minX: Math.min(b.minX, i.x), minY: Math.min(b.minY, i.y), maxX: Math.max(b.maxX, i.x + NODE_W + 50), maxY: Math.max(b.maxY, i.y + NODE_H),
  }), { minX: 0, minY: 0, maxX: NODE_W + 50, maxY: NODE_H });
  const fit = useCallback((animate: boolean) => {
    const { w, h } = sizeRef.current, b = bounds.current;
    if (!w || !h) return;
    const bw = b.maxX - b.minX, bh = b.maxY - b.minY;
    const top = 48, bottom = 96, side = 40;
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min((w - 2 * side) / bw, (h - top - bottom) / bh, 1)));
    const x = (w - bw * zoom) / 2 - b.minX * zoom;
    const y = top + (h - top - bottom - bh * zoom) / 2 - b.minY * zoom;
    if (animate && !reduced) { tx.set(withSpring(x, SPRING)); ty.set(withSpring(y, SPRING)); z.set(withSpring(zoom, SPRING)); }
    else { cancelAnimation(tx); cancelAnimation(ty); cancelAnimation(z); tx.set(x); ty.set(y); z.set(zoom); }
    persist(x, y, zoom);
  }, [reduced, tx, ty, z, persist]);

  const firstFit = useRef(isDefaultViewport(view.viewport));
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    sizeRef.current = { w: width, h: height };
    setSize({ w: width, h: height });
    if (firstFit.current) { firstFit.current = false; fit(false); }
  }, [fit]);

  // Never-opened map whose items sit on top of each other: lay out once.
  const pendingFit = useRef(false);
  useEffect(() => {
    if (!isDefaultViewport(view.viewport) || items.length < 2) return;
    const seen = new Set(items.map(i => `${i.x},${i.y}`));
    if (seen.size < items.length) { pendingFit.current = true; useStore.getState().arrange(projectId); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const prevItems = useRef(items);
  useEffect(() => {
    if (pendingFit.current && prevItems.current !== items) { pendingFit.current = false; fit(true); }
    prevItems.current = items;
  }, [items, fit]);

  // ---- gestures (UI thread) ----
  const gesture = useMemo(() => {
    const commit = () => { 'worklet'; scheduleOnRN(persist, tx.get(), ty.get(), z.get()); };
    const pan = Gesture.Pan().maxPointers(1)
      .onBegin(() => { cancelAnimation(tx); cancelAnimation(ty); })
      .onChange(e => { tx.set(tx.get() + e.changeX); ty.set(ty.get() + e.changeY); })
      .onEnd(e => {
        if (reduced) { commit(); return; }
        tx.set(withDecay({ velocity: e.velocityX, deceleration: 0.996 }));
        ty.set(withDecay({ velocity: e.velocityY, deceleration: 0.996 }, done => { if (done) commit(); }));
      });
    const pinch = Gesture.Pinch()
      .onBegin(() => { cancelAnimation(tx); cancelAnimation(ty); cancelAnimation(z); })
      .onChange(e => {
        const prev = z.get(), next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev * e.scaleChange)), k = next / prev;
        tx.set(e.focalX - (e.focalX - tx.get()) * k); // keep the pinch focal point fixed (also follows two-finger drift)
        ty.set(e.focalY - (e.focalY - ty.get()) * k);
        z.set(next);
      })
      .onEnd(commit);
    return Gesture.Simultaneous(pan, pinch);
  }, [persist, reduced, tx, ty, z]);

  const world = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() - OFF * z.get() }, { translateY: ty.get() - OFF * z.get() }, { scale: z.get() }],
  }));
  const grid = useAnimatedStyle(() => ({
    transform: [{ translateX: (((tx.get() % GRID) + GRID) % GRID) - GRID }, { translateY: (((ty.get() % GRID) + GRID) % GRID) - GRID }],
  }));

  // ---- actions ----
  const open = useCallback((id: string) => router.push({ pathname: '/item/[id]', params: { id } }), []);
  const onDrop = useCallback((id: string, x: number, y: number) => useStore.getState().updateItem(id, { x, y }), []);
  const onToggle = useCallback((id: string) => useStore.getState().toggleCollapsed(projectId, id), [projectId]);
  const add = useCallback((parentId: string | null) => {
    const st = useStore.getState();
    const all = st.workspace.items.filter(i => i.projectId === projectId);
    const parent = parentId ? all.find(i => i.id === parentId) : undefined;
    const sibs = all.filter(i => i.parentId === parentId);
    const id = st.addItem(projectId, 'todo', parentId);
    // Drop the new node beside its parent, below existing siblings (items default to overlapping coordinates).
    st.updateItem(id, { x: parent ? parent.x + NODE_W + 80 : 280, y: sibs.length ? Math.max(...sibs.map(i => i.y)) + 100 : parent?.y ?? 0 });
    if (parentId && view.collapsed.includes(parentId)) st.toggleCollapsed(projectId, parentId);
    open(id);
  }, [projectId, view.collapsed, open]);
  const onAddChild = useCallback((id: string) => add(id), [add]);
  const onAddRoot = useCallback(() => add(null), [add]);
  const arrange = useCallback(() => { pendingFit.current = true; useStore.getState().arrange(projectId); }, [projectId]);

  if (!project) return null;
  const edge = dark ? '#6e6e73' : '#a1a1a6';
  const dot = dark ? '#48484a' : '#c7c7cc'; // ~ separator; PlatformColor can't be used inside SVG
  return (
    <View style={s.fill}>
      <GestureDetector gesture={gesture}>
        <View style={s.canvas} onLayout={onLayout}>
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0 }, grid]}>
            <Svg width={size.w + GRID * 2} height={size.h + GRID * 2}>
              <Defs>
                <Pattern id="dots" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
                  <Circle cx={GRID / 2} cy={GRID / 2} r={1.2} fill={dot} />
                </Pattern>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#dots)" />
            </Svg>
          </Animated.View>
          <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: WORLD, height: WORLD, transformOrigin: '0% 0%' }, world]}>
            {shown.map(i => (
              <Edge key={i.id} sx={i.parentId && shownIds.has(i.parentId) ? byId.get(i.parentId)!.x + NODE_W : NODE_W} sy={i.parentId && shownIds.has(i.parentId) ? byId.get(i.parentId)!.y + NODE_H / 2 : NODE_H / 2}
                ex={i.x} ey={i.y + NODE_H / 2} color={edge} faded={dragId === i.id || (!!i.parentId && dragId === i.parentId)} />
            ))}
            {links.filter(l => shownIds.has(l.sourceId) && shownIds.has(l.targetId)).map(l => {
              const a = byId.get(l.sourceId)!, b = byId.get(l.targetId)!;
              return <Edge key={l.id} dashed sx={a.x + NODE_W} sy={a.y + NODE_H / 2} ex={b.x} ey={b.y + NODE_H / 2} color={accent} faded={dragId === a.id || dragId === b.id} />;
            })}
            <View style={{ position: 'absolute', left: OFF, top: OFF }}>
              <RootNode name={project.name} count={items.length} onAdd={onAddRoot} />
              {shown.map(i => (
                <ItemNode key={i.id} item={i} childCount={childCount.get(i.id) ?? 0} collapsed={collapsedSet.has(i.id)} dragging={dragId === i.id}
                  scale={z} onOpen={open} onAdd={onAddChild} onToggle={onToggle} onDrop={onDrop} onDragState={setDragId} />
              ))}
            </View>
          </Animated.View>
        </View>
      </GestureDetector>
      {items.length === 0 && (
        <View pointerEvents="none" style={s.hint}><Text style={s.hintText}>Tap + to add your first item</Text></View>
      )}
      <View style={[s.controls, { bottom: insets.bottom + 12 }]}>
        <MapButton symbol="arrow.up.left.and.arrow.down.right" label="Fit to content" onPress={() => fit(true)} />
        <View style={s.sep} />
        <MapButton symbol="wand.and.stars" label="Arrange items" onPress={arrange} />
      </View>
    </View>
  );
}

const s = live(() => StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.groupedBackground },
  canvas: { flex: 1, overflow: 'hidden' },
  hint: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', paddingTop: 150 },
  hintText: { fontSize: 15, color: colors.secondaryLabel },
  controls: { position: 'absolute', left: 16, width: 48, borderRadius: 24, backgroundColor: colors.secondaryGroupedBackground, borderColor: colors.separator, borderWidth: StyleSheet.hairlineWidth, boxShadow: '0 4 12 rgba(0,0,0,0.12)', ...continuous },
  ctl: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  sep: { height: StyleSheet.hairlineWidth, marginHorizontal: 12, backgroundColor: colors.separator },
}));
