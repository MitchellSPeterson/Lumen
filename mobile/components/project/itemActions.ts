import { Alert } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { descendants, planningLaneLabels, statusLabels, type PlanningLane, type Priority, type Status, type WorkItem } from '@shared/domain';
import { useStore } from '@/lib/store';
import { actionSheet, type Choice } from '@/components/Dialogs';
import { priorityLabels, statuses } from './model';

const st = () => useStore.getState();
export function toggleDone(item: WorkItem) {
  void Haptics.selectionAsync();
  st().updateItem(item.id, { status: item.status === 'done' ? 'todo' : 'done' });
}

export function removeItems(items: WorkItem[], after?: () => void) {
  const all = st().workspace.items;
  const nested = items.reduce((n, i) => n + descendants(all, i.id).size, 0);
  const go = () => { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); items.forEach(i => st().deleteItem(i.id)); after?.(); };
  if (!nested && items.length === 1) return go();
  const what = items.length === 1 ? `“${items[0].title}”` : `${items.length} items`;
  Alert.alert(items.length === 1 ? 'Delete this branch?' : `Delete ${items.length} items?`,
    `${what}${nested ? ` and ${nested} nested ${nested === 1 ? 'item' : 'items'}` : ''} will be deleted.`,
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: go }]);
}

const setStatus = (item: WorkItem, status: Status) => st().updateItem(item.id, { status });
const statusSheet = (item: WorkItem) => actionSheet(`Status: ${statusLabels[item.status]}`, statuses.map(s => [statusLabels[s], () => setStatus(item, s)]));
const prioritySheet = (item: WorkItem) => actionSheet(`Priority: ${priorityLabels[item.priority]}`,
  (['high', 'normal', 'low'] as Priority[]).map(p => [priorityLabels[p], () => st().updateItem(item.id, { priority: p })]));
const laneSheet = (item: WorkItem) => actionSheet(`Planning: ${item.planningLane ? planningLaneLabels[item.planningLane] : 'Unplanned'}`,
  ([['now'], ['next'], ['later'], [null]] as [PlanningLane][]).map(([l]) => [l ? planningLaneLabels[l] : 'Unplanned', () => st().updateItem(item.id, { planningLane: l })]));
const open = (item: WorkItem) => router.push({ pathname: '/item/[id]', params: { id: item.id } });

/** Long-press menu. `board` swaps hierarchy actions for direct status moves. */
export function itemMenu(item: WorkItem, board = false) {
  void Haptics.selectionAsync();
  const common: Choice[] = [
    ['Priority…', () => prioritySheet(item)], ['Planning…', () => laneSheet(item)],
    ['Delete', () => removeItems([item]), true],
  ];
  if (board) {
    return actionSheet(item.title, [
      ...statuses.filter(s => s !== item.status).map((s): Choice => [`Move to ${statusLabels[s]}`, () => setStatus(item, s)]),
      ['Open', () => open(item)], ...common,
    ]);
  }
  actionSheet(item.title, [
    ['Add child', () => { const id = st().addItem(item.projectId, 'todo', item.id); router.push({ pathname: '/item/[id]', params: { id } }); }],
    ['Move up', () => st().reorderItem(item.id, -1)], ['Move down', () => st().reorderItem(item.id, 1)],
    ['Move to…', () => router.push({ pathname: '/move-picker', params: { itemId: item.id } })],
    ['Status…', () => statusSheet(item)], ...common,
  ]);
}
