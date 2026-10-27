import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Link, Stack, router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from '@/lib/symbols';
import * as Haptics from 'expo-haptics';
import { descendants, kindLabels, planningLaneLabels, statusLabels, type ItemKind, type PlanningLane, type Priority, type Status, type WorkItem } from '@shared/domain';
import { useItem, useItemLinks, useProject, useProjectItems, useStore } from '@/lib/store';
import { colors, continuous, radius, space, useAccent } from '@/lib/theme';
import { actionSheet, type Choice } from '@/components/Dialogs';
import { HeaderButton } from '@/components/HeaderButton';
import { Field } from '@/components/item/Field';
import { MenuChip } from '@/components/item/MenuChip';
import { Notes } from '@/components/item/Notes';
import { Planning, Section } from '@/components/item/Planning';
import { Tags } from '@/components/item/Tags';
import { kindSymbol, laneSymbol, priorityLabels, prioritySymbol, statusSymbol } from '@/components/item/meta';

const kinds = (Object.keys(kindLabels) as ItemKind[]).map(value => ({ value, label: kindLabels[value], icon: kindSymbol[value] }));
const statuses = (Object.keys(statusLabels) as Status[]).map(value => ({ value, label: statusLabels[value], icon: statusSymbol[value] }));
const priorities = (Object.keys(priorityLabels) as Priority[]).map(value => ({ value, label: priorityLabels[value], icon: prioritySymbol[value] }));
const lanes = [{ value: 'none', label: 'No lane', icon: laneSymbol.none }, ...(['now', 'next', 'later'] as const).map(value => ({ value, label: planningLaneLabels[value], icon: laneSymbol[value] }))];

const card = () => ({ backgroundColor: colors.secondaryGroupedBackground, borderRadius: radius.card, ...continuous, overflow: 'hidden' } as const);
const open = (id: string) => router.push({ pathname: '/item/[id]', params: { id } });

function Row({ item, last }: { item: WorkItem; last?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.base, paddingHorizontal: space.md, minHeight: 44, borderBottomWidth: last ? 0 : 0.5, borderBottomColor: colors.separator }}>
      <SymbolView name={kindSymbol[item.kind]} size={16} tintColor={colors.secondaryLabel} />
      <Text numberOfLines={1} style={{ flex: 1, color: colors.label, fontSize: 17, paddingVertical: 12 }}>{item.title}</Text>
      <SymbolView name="chevron.right" size={12} weight="semibold" tintColor={colors.tertiaryLabel} />
    </View>
  );
}

const ios = process.env.EXPO_OS !== 'android';

export default function ItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = useItem(id);
  const items = useProjectItems(item?.projectId ?? '');
  const project = useProject(item?.projectId ?? '');
  const links = useItemLinks(id);
  const accent = useAccent();
  const { updateItem, addItem, deleteItem, removeLink } = useStore.getState();

  if (!item) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.base, backgroundColor: colors.groupedBackground }}>
        <SymbolView name="questionmark.folder" size={44} tintColor={colors.tertiaryLabel} />
        <Text style={{ color: colors.label, fontSize: 20, fontWeight: '600' }}>Item not found</Text>
        <Text style={{ color: colors.secondaryLabel, fontSize: 15 }}>It may have been deleted.</Text>
      </View>
    );
  }

  const byId = new Map(items.map(i => [i.id, i]));
  const ancestors: WorkItem[] = [];
  for (let p = item.parentId ? byId.get(item.parentId) : undefined; p && ancestors.length < 50; p = p.parentId ? byId.get(p.parentId) : undefined) ancestors.unshift(p);
  const children = items.filter(i => i.parentId === item.id).sort((a, b) => a.order - b.order);
  const related = links.flatMap(l => { const o = byId.get(l.sourceId === item.id ? l.targetId : l.sourceId); return o ? [{ link: l, item: o }] : []; });
  const tags = [...new Set(items.flatMap(i => i.tags))].sort();
  const patch = (p: Parameters<typeof updateItem>[1]) => updateItem(item.id, p);

  const confirmDelete = () => {
    const n = descendants(items, item.id).size;
    Alert.alert(`Delete “${item.title}”?`, n ? `${n} child ${n === 1 ? 'item' : 'items'} will also be deleted.` : 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteItem(item.id); void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); router.back(); } },
    ]);
  };
  const organize = (kind: 'feature' | 'todo') => { patch({ kind }); void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); };

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: colors.groupedBackground }} contentContainerStyle={{ padding: space.md, gap: space.lg, paddingBottom: space.lg * 2 }}>
      {process.env.EXPO_OS === 'android' && <Stack.Screen options={{ headerRight: () => <HeaderButton icon="ellipsis.circle" label="More" onPress={() => actionSheet(item.title, [
        ['Move to…', () => router.push({ pathname: '/move-picker', params: { itemId: item.id } })],
        ...(item.kind === 'idea' ? [['Make a feature', () => organize('feature')], ['Make a task', () => organize('todo')]] as Choice[] : []),
        ['Delete', confirmDelete, true],
      ])} /> }} />}
      {ios && <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu icon="ellipsis.circle" accessibilityLabel="More">
          <Stack.Toolbar.MenuAction icon="folder" onPress={() => router.push({ pathname: '/move-picker', params: { itemId: item.id } })}>Move to…</Stack.Toolbar.MenuAction>
          {item.kind === 'idea' && <Stack.Toolbar.MenuAction icon={kindSymbol.feature} onPress={() => organize('feature')}>Make a feature</Stack.Toolbar.MenuAction>}
          {item.kind === 'idea' && <Stack.Toolbar.MenuAction icon={kindSymbol.todo} onPress={() => organize('todo')}>Make a task</Stack.Toolbar.MenuAction>}
          <Stack.Toolbar.MenuAction icon="trash" destructive onPress={confirmDelete}>Delete</Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>}

      <View style={{ gap: space.base }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center', gap: space.base }}>
          <Text style={{ color: colors.tertiaryLabel, fontSize: 13 }}>{project?.name}</Text>
          {ancestors.map(a => (
            <Pressable key={a.id} onPress={() => open(a.id)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: space.base, minHeight: 28 }}>
              <SymbolView name="chevron.right" size={9} weight="semibold" tintColor={colors.tertiaryLabel} />
              <Text style={{ color: accent, fontSize: 13, maxWidth: 160 }} numberOfLines={1}>{a.title}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Field key={item.id} value={item.title} multiline submitBehavior="blurAndSubmit" returnKeyType="done" maxLength={500} accessibilityLabel="Title" placeholder="Title" placeholderTextColor={colors.tertiaryLabel}
          onCommit={t => { if (t.trim()) patch({ title: t.trim() }); }} style={{ color: colors.label, fontSize: 28, fontWeight: '700', paddingVertical: 0, paddingHorizontal: 0 }} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.base, alignItems: 'center' }}>
          <MenuChip label={kindLabels[item.kind]} icon={kindSymbol[item.kind]} options={kinds} value={item.kind} onSelect={kind => patch({ kind })} />
          <MenuChip label={statusLabels[item.status]} icon={statusSymbol[item.status]} options={statuses} value={item.status} onSelect={status => patch({ status })} />
          <MenuChip label={priorityLabels[item.priority]} icon={prioritySymbol[item.priority]} options={priorities} value={item.priority} onSelect={priority => patch({ priority })} />
          <MenuChip label={item.planningLane ? planningLaneLabels[item.planningLane] : 'No lane'} icon={laneSymbol[item.planningLane ?? 'none']} options={lanes} value={item.planningLane ?? 'none'}
            onSelect={v => patch({ planningLane: (v === 'none' ? null : v) as PlanningLane })} />
        </ScrollView>
      </View>

      <Section title="Tags"><Tags key={item.id} tags={item.tags} suggestions={tags} onChange={t => patch({ tags: t })} /></Section>
      <Section title="Notes"><Notes key={item.id} notes={item.notes} onCommit={t => patch({ notes: t })} /></Section>
      <Planning item={item} onChange={details => patch({ details })} />

      <Section title="Child items" detail={children.length ? String(children.length) : undefined}>
        {children.length > 0 && (
          <View style={card()}>
            {children.map((c, i) => (
              <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: i < children.length - 1 ? 0.5 : 0, borderBottomColor: colors.separator }}>
                <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: c.status === 'done' }} accessibilityLabel={`Mark ${c.title} ${c.status === 'done' ? 'to do' : 'done'}`}
                  style={{ width: 52, height: 44, alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => { void Haptics.selectionAsync(); updateItem(c.id, { status: c.status === 'done' ? 'todo' : 'done' }); }}>
                  <SymbolView name={statusSymbol[c.status]} size={24} tintColor={c.status === 'done' ? accent : colors.tertiaryLabel} />
                </Pressable>
                <Pressable onPress={() => open(c.id)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.base, paddingRight: space.md, minHeight: 44 }}>
                  <Text numberOfLines={1} style={{ flex: 1, color: c.status === 'done' ? colors.secondaryLabel : colors.label, fontSize: 17, paddingVertical: 12, textDecorationLine: c.status === 'done' ? 'line-through' : 'none' }}>{c.title}</Text>
                  <SymbolView name="chevron.right" size={12} weight="semibold" tintColor={colors.tertiaryLabel} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
        <View style={{ flexDirection: 'row' }}>
          <MenuChip<ItemKind> label="Add child" icon="plus" options={kinds} onSelect={kind => open(addItem(item.projectId, kind, item.id))} />
        </View>
      </Section>

      <Section title="Related">
        {related.length > 0 && (
          <View style={card()}>
            {related.map(({ link, item: o }, i) => !ios ? (
              <Pressable key={link.id} android_ripple={{ color: colors.fill }} onPress={() => open(o.id)}
                onLongPress={() => actionSheet(o.title, [['Remove related link', () => removeLink(link.id), true]])}>
                <Row item={o} last={i === related.length - 1} />
              </Pressable>
            ) : (
              <Link key={link.id} push href={{ pathname: '/item/[id]', params: { id: o.id } }}>
                <Link.Trigger><Row item={o} last={i === related.length - 1} /></Link.Trigger>
                <Link.Menu>
                  <Link.MenuAction icon="xmark.circle" destructive onPress={() => removeLink(link.id)}>Remove related link</Link.MenuAction>
                </Link.Menu>
              </Link>
            ))}
          </View>
        )}
        <Pressable onPress={() => router.push({ pathname: '/link-picker', params: { itemId: item.id } })} style={{ ...card(), flexDirection: 'row', alignItems: 'center', gap: space.base, paddingHorizontal: space.md, minHeight: 44 }}>
          <SymbolView name="plus.circle.fill" size={22} tintColor={accent} />
          <Text style={{ color: accent, fontSize: 17 }}>Add related item</Text>
        </Pressable>
      </Section>
    </ScrollView>
  );
}
