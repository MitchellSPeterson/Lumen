import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, BackHandler, Pressable, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { SymbolView } from '@/lib/symbols';
import * as Haptics from 'expo-haptics';
import { kindLabels, statusLabels, type Priority, type ProjectView, type Status } from '@shared/domain';
import { useProject, useProjectItems, useProjectView, useStore } from '@/lib/store';
import { colors, space, useAccent } from '@/lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MindMap from '@/components/map/MindMap';
import { Board } from '@/components/project/Board';
import { Empty } from '@/components/project/Empty';
import { Outline } from '@/components/project/Outline';
import { SectionHeader } from '@/components/project/SectionHeader';
import { actionSheet, promptText, type Choice } from '@/components/Dialogs';
import { HeaderButton } from '@/components/HeaderButton';
import { removeItems } from '@/components/project/itemActions';
import { flatten, isFiltered, noFilters, priorityLabels, scopes, select, statuses, useCaptured, type Filters } from '@/components/project/model';

const modes: ProjectView['mode'][] = ['outline', 'board', 'map'];
const Toolbar = Stack.Toolbar;
const android = process.env.EXPO_OS === 'android';
const choose = <T,>(title: string, opts: [T, string][], cur: T, set: (v: T) => void) =>
  actionSheet(title, opts.map(([v, label]): Choice => [label, () => set(v), false, v === cur]));

export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const project = useProject(id);
  const allItems = useProjectItems(id);
  const view = useProjectView(id);
  const accent = useAccent();
  const insets = useSafeAreaInsets();
  const [filters, setFilters] = useState<Filters>(noFilters);
  const [query, setQuery] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState('');
  const search = useRef<{ clearText?: () => void }>(null);

  const items = useMemo(() => [...allItems].sort((a, b) => a.order - b.order), [allItems]);
  const { matching, filtered, visible } = useMemo(() => select(items, filters, query), [items, filters, query]);
  const rows = useMemo(() => flatten(items, visible, matching, view.collapsed, filtered), [items, visible, matching, view.collapsed, filtered]);
  const tags = useMemo(() => [...new Set(items.flatMap(i => i.tags))].sort(), [items]);
  const boardItems = useMemo(() => items.filter(i => i.kind !== 'idea' && matching.has(i.id)), [items, matching]);
  const mode = view.mode;
  const store = useStore.getState;

  const checkedItems = items.filter(i => checked.has(i.id));
  const canGroup = checkedItems.length >= 2 && checkedItems.every(i => i.parentId === checkedItems[0].parentId);

  const clearFilters = () => { setFilters(noFilters); setQuery(''); search.current?.clearText?.(); };
  const exitSelect = () => { setSelecting(false); setChecked(new Set()); };
  const setMode = (m: ProjectView['mode']) => { exitSelect(); store().setView(id, { mode: m }); };
  const capture = () => router.push({ pathname: '/capture', params: { projectId: id } });
  const check = (itemId: string) => setChecked(c => { const n = new Set(c); if (!n.delete(itemId)) n.add(itemId); return n; });

  // Capture sheet hands off here: like desktop, an idea lands you in Inbox, anything else in All items.
  const seq = useCaptured(s => s.seq);
  const seen = useRef(seq);
  useEffect(() => {
    if (seq === seen.current) return;
    seen.current = seq;
    const kind = useCaptured.getState().kind;
    setFilters(kind === 'idea' ? { ...noFilters, scope: 'inbox' } : noFilters);
    setQuery(''); search.current?.clearText?.(); exitSelect();
    const msg = `${kindLabels[kind]} saved${kind === 'idea' ? ' to Inbox' : ''}.`;
    setNotice(msg); AccessibilityInfo.announceForAccessibility(msg);
    const t = setTimeout(() => setNotice(''), 2500);
    return () => clearTimeout(t);
  }, [seq]);

  function group() {
    promptText('Group into feature', 'Name the feature that will contain these items.', 'Create feature', text => {
      const title = text.trim();
      if (!title) return;
      const featureId = store().groupItems([...checked], title);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      exitSelect(); clearFilters();
      router.push({ pathname: '/item/[id]', params: { id: featureId } });
    });
  }

  // Android back leaves multi-select first, like the Cancel button.
  useEffect(() => {
    if (!selecting) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { exitSelect(); return true; });
    return () => sub.remove();
  }, [selecting]);

  // Android has no Stack.Toolbar menus: the same actions as nested bottom sheets. The header can hold a stale closure after
  // returning from the capture sheet, so anything that changes while this screen is blurred is read from the store.
  const filterMenu = () => actionSheet('Filters', [
    ['Show…', () => choose('Show', scopes, filters.scope, scope => setFilters({ ...filters, scope }))],
    ['Status…', () => choose<Status | null>('Status', [[null, 'Any status'], ...statuses.map((s): [Status, string] => [s, statusLabels[s]])], filters.status, status => setFilters({ ...filters, status }))],
    ['Priority…', () => choose<Priority | null>('Priority', [[null, 'Any priority'], ...(['high', 'normal', 'low'] as const).map((p): [Priority, string] => [p, priorityLabels[p]])], filters.priority, priority => setFilters({ ...filters, priority }))],
    ...(tags.length ? [['Tag…', () => choose<string | null>('Tag', [[null, 'Any tag'], ...tags.map((t): [string, string] => [t, `#${t}`])], filters.tag, tag => setFilters({ ...filters, tag }))] as Choice] : []),
    ...(isFiltered(filters) ? [['Clear filters', clearFilters] as Choice] : []),
  ]);
  const moreMenu = () => actionSheet(project?.name ?? '', [
    ['Capture', capture],
    ...(mode === 'outline' && store().workspace.items.some(i => i.projectId === id) ? [['Select', () => setSelecting(true)] as Choice] : []),
    ...(mode === 'map' ? [['Arrange', () => store().arrange(id)] as Choice] : []),
    ['Project settings', () => router.push({ pathname: '/project-settings/[id]', params: { id } })],
  ]);

  if (!project) return <Empty symbol="questionmark.folder" title="Project not found" body="It may have been deleted." />;

  const noItems = items.length === 0;
  const inboxClear = filters.scope === 'inbox' && !items.some(i => i.kind === 'idea' && i.parentId === null);
  const noMatch = !noItems && matching.size === 0;
  const common = noItems
    ? <Empty symbol="lightbulb" title="What are you building?" body="Capture a thought. Give it structure when you’re ready." action="Capture your first item" onAction={capture} />
    : noMatch
      ? <Empty symbol="magnifyingglass" title={inboxClear ? 'Inbox is clear' : 'No items match'}
          body={inboxClear ? 'Capture a new thought, or review the work in your plan.' : isFiltered(filters) ? 'Clear your filters to see more items.' : 'Try a different search.'}
          action={inboxClear ? undefined : isFiltered(filters) ? 'Show all items' : undefined} onAction={clearFilters} />
      : null;
  const boardEmpty = common ?? (boardItems.length ? null :
    <Empty symbol="lightbulb" title="Your ideas are ready to shape" body="The board tracks features, tasks, and bugs. Open an idea to turn it into work you can track." action="Open Inbox"
      onAction={() => { setFilters({ ...noFilters, scope: 'inbox' }); setMode('outline'); }} />);
  const header = <SectionHeader filters={filters} onChange={setFilters} count={mode === 'board' ? boardItems.length : matching.size} />;
  const showFab = !selecting && mode !== 'map';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: selecting ? `${checked.size} selected` : project.name, headerBackVisible: !selecting, gestureEnabled: !selecting }} />
      {android && <Stack.Screen options={{
        headerLeft: selecting ? () => <HeaderButton icon="xmark" label="Cancel" onPress={exitSelect} /> : undefined,
        headerRight: selecting ? undefined : () => (
          <>
            {mode !== 'map' && <HeaderButton icon={isFiltered(filters) ? 'line.3.horizontal.decrease.circle.fill' : 'line.3.horizontal.decrease.circle'} label="Filters" onPress={filterMenu} />}
            <HeaderButton icon="ellipsis.circle" label="More" onPress={moreMenu} />
          </>
        ),
      }} />}
      {mode !== 'map' && <Stack.SearchBar ref={search as never} placeholder="Search" hideWhenScrolling={false} onChangeText={e => setQuery(e.nativeEvent.text)} onCancelButtonPress={() => setQuery('')} />}
      {!android && selecting && (
        <Toolbar placement="left"><Toolbar.Button onPress={exitSelect}>Cancel</Toolbar.Button></Toolbar>
      )}
      {!android && !selecting && (
        <Toolbar placement="right">
          <Toolbar.Menu icon={isFiltered(filters) ? 'line.3.horizontal.decrease.circle.fill' : 'line.3.horizontal.decrease.circle'} title="Filters" hidden={mode === 'map'}>
            <Toolbar.Menu title="Show">
              {scopes.map(([s, label]) => <Toolbar.MenuAction key={s} isOn={filters.scope === s} onPress={() => setFilters({ ...filters, scope: s })}>{label}</Toolbar.MenuAction>)}
            </Toolbar.Menu>
            <Toolbar.Menu title="Status">
              <Toolbar.MenuAction isOn={!filters.status} onPress={() => setFilters({ ...filters, status: null })}>Any status</Toolbar.MenuAction>
              {statuses.map(s => <Toolbar.MenuAction key={s} isOn={filters.status === s} onPress={() => setFilters({ ...filters, status: s })}>{statusLabels[s]}</Toolbar.MenuAction>)}
            </Toolbar.Menu>
            <Toolbar.Menu title="Priority">
              <Toolbar.MenuAction isOn={!filters.priority} onPress={() => setFilters({ ...filters, priority: null })}>Any priority</Toolbar.MenuAction>
              {(['high', 'normal', 'low'] as const).map(p => <Toolbar.MenuAction key={p} isOn={filters.priority === p} onPress={() => setFilters({ ...filters, priority: p })}>{priorityLabels[p]}</Toolbar.MenuAction>)}
            </Toolbar.Menu>
            {tags.length > 0 && (
              <Toolbar.Menu title="Tag">
                <Toolbar.MenuAction isOn={!filters.tag} onPress={() => setFilters({ ...filters, tag: null })}>Any tag</Toolbar.MenuAction>
                {tags.map(t => <Toolbar.MenuAction key={t} isOn={filters.tag === t} onPress={() => setFilters({ ...filters, tag: t })}>{`#${t}`}</Toolbar.MenuAction>)}
              </Toolbar.Menu>
            )}
            <Toolbar.MenuAction icon="xmark.circle" hidden={!isFiltered(filters)} onPress={clearFilters}>Clear filters</Toolbar.MenuAction>
          </Toolbar.Menu>
          <Toolbar.Menu icon="ellipsis.circle" title={project.name}>
            <Toolbar.MenuAction icon="plus" onPress={capture}>Capture</Toolbar.MenuAction>
            <Toolbar.MenuAction icon="checkmark.circle" hidden={mode !== 'outline'} disabled={noItems} onPress={() => setSelecting(true)}>Select</Toolbar.MenuAction>
            <Toolbar.MenuAction icon="wand.and.stars" hidden={mode !== 'map'} onPress={() => store().arrange(id)}>Arrange</Toolbar.MenuAction>
            <Toolbar.MenuAction icon="gearshape" onPress={() => router.push({ pathname: '/project-settings/[id]', params: { id } })}>Project settings</Toolbar.MenuAction>
          </Toolbar.Menu>
        </Toolbar>
      )}
      {!android && selecting && (
        <Toolbar placement="bottom">
          <Toolbar.Button icon="square.stack.3d.up" disabled={!canGroup} onPress={group}>Group into feature</Toolbar.Button>
          <Toolbar.Spacer />
          <Toolbar.Menu icon="circle.lefthalf.filled" title="Set status" disabled={!checked.size}>
            {statuses.map(s => <Toolbar.MenuAction key={s} onPress={() => { checkedItems.forEach(i => store().updateItem(i.id, { status: s })); exitSelect(); }}>{statusLabels[s]}</Toolbar.MenuAction>)}
          </Toolbar.Menu>
          <Toolbar.Button icon="trash" tintColor={colors.destructive} disabled={!checked.size} onPress={() => removeItems(checkedItems, exitSelect)} />
        </Toolbar>
      )}

      <View style={{ paddingHorizontal: space.md, paddingTop: space.base, gap: space.base }}>
        <SegmentedControl values={['List', 'Board', 'Map']} selectedIndex={modes.indexOf(mode)} onChange={e => setMode(modes[e.nativeEvent.selectedSegmentIndex])} />
        {selecting && !canGroup && <Text style={{ color: colors.secondaryLabel, fontSize: 13 }}>{checked.size} selected · Choose at least two items inside the same parent to group them.</Text>}
      </View>

      <View style={{ flex: 1 }}>
        {mode === 'map' ? <MindMap projectId={id} />
          : mode === 'board' ? <Board items={boardItems} header={header} empty={boardEmpty} />
          : <Outline rows={rows} projectId={id} selecting={selecting} checked={checked} onCheck={check} header={header} empty={common} />}
      </View>

      {notice !== '' && (
        <View pointerEvents="none" style={{ position: 'absolute', left: space.md, right: 88, bottom: insets.bottom + space.md, minHeight: 44, justifyContent: 'center', paddingHorizontal: space.md, borderRadius: 22, backgroundColor: colors.label }}>
          <Text style={{ color: colors.background, fontSize: 15 }}>{notice}</Text>
        </View>
      )}
      {android && selecting && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md, paddingBottom: insets.bottom, minHeight: 56 + insets.bottom, backgroundColor: colors.secondaryGroupedBackground }}>
          <Pressable disabled={!canGroup} onPress={group} style={{ flexDirection: 'row', alignItems: 'center', gap: space.base, minHeight: 48, opacity: canGroup ? 1 : 0.4 }}>
            <SymbolView name="square.stack.3d.up" size={22} tintColor={accent} /><Text style={{ color: accent, fontSize: 15, fontWeight: '500' }}>Group into feature</Text>
          </Pressable>
          <View style={{ flexDirection: 'row' }}>
            <HeaderButton icon="circle.lefthalf.filled" label="Set status" disabled={!checked.size} onPress={() => choose<Status | null>('Set status', statuses.map((s): [Status, string] => [s, statusLabels[s]]), null, s => { checkedItems.forEach(i => store().updateItem(i.id, { status: s! })); exitSelect(); })} />
            <HeaderButton icon="trash" label="Delete" tint={colors.destructive as string} disabled={!checked.size} onPress={() => removeItems(checkedItems, exitSelect)} />
          </View>
        </View>
      )}
      {showFab && (
        <Pressable onPress={capture} accessibilityRole="button" accessibilityLabel="Capture"
          style={({ pressed }) => ({ position: 'absolute', right: space.md, bottom: insets.bottom + space.md, width: 56, height: 56, borderRadius: android ? 16 : 28, borderCurve: 'continuous', elevation: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: accent, opacity: pressed ? 0.8 : 1, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } })}>
          <SymbolView name="plus" size={24} weight="semibold" tintColor="#fff" />
        </Pressable>
      )}
    </View>
  );
}
