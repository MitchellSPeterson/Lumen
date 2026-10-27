import { create } from 'zustand';
import { itemSearchText, matchingWithAncestors, type ItemKind, type Priority, type Status, type WorkItem } from '@shared/domain';

export type Scope = 'all' | 'inbox' | 'now' | 'next' | 'later' | 'unplanned' | ItemKind;
export interface Filters { scope: Scope; status: Status | null; priority: Priority | null; tag: string | null }
export const noFilters: Filters = { scope: 'all', status: null, priority: null, tag: null };

export const scopes: [Scope, string][] = [
  ['all', 'All items'], ['inbox', 'Inbox'], ['now', 'Now'], ['next', 'Next'], ['later', 'Later'], ['unplanned', 'Unplanned'],
  ['feature', 'Features'], ['todo', 'Tasks'], ['bug', 'Bugs'], ['idea', 'Ideas'],
];
export const scopeLabel = Object.fromEntries(scopes) as Record<Scope, string>;
export const priorityLabels: Record<Priority, string> = { high: 'High', normal: 'Normal', low: 'Low' };
export const statuses: Status[] = ['todo', 'in_progress', 'done'];

export function scopeHint(scope: Scope) {
  return scope === 'inbox' ? 'Capture a thought. Turn it into a feature or task when you’re ready.'
    : scope === 'now' ? 'The work you’re focusing on today.'
    : scope === 'next' ? 'What you want to tackle next.'
    : scope === 'later' ? 'Good ideas for another time.'
    : 'Collect ideas, shape features, and decide what comes next.';
}

export const isFiltered = (f: Filters) => f.scope !== 'all' || f.status !== null || f.priority !== null || f.tag !== null;

function inScope(i: WorkItem, s: Scope) {
  switch (s) {
    case 'all': return true;
    case 'inbox': return i.kind === 'idea' && i.parentId === null;
    case 'unplanned': return i.planningLane === null;
    case 'now': case 'next': case 'later': return i.planningLane === s;
    default: return i.kind === s;
  }
}

/** Items matching filters + search, and the set to display (matches plus their ancestors, like desktop). */
export function select(items: WorkItem[], f: Filters, query: string) {
  const q = query.trim().toLowerCase();
  const matching = new Set(items.filter(i =>
    inScope(i, f.scope) && (!f.status || i.status === f.status) && (!f.priority || i.priority === f.priority) &&
    (!f.tag || i.tags.includes(f.tag)) && (!q || itemSearchText(i).includes(q))).map(i => i.id));
  const filtered = isFiltered(f) || !!q;
  return { matching, filtered, visible: filtered ? matchingWithAncestors(items, matching) : null };
}

export interface Row { item: WorkItem; depth: number; children: number; collapsed: boolean; context: boolean }
export function flatten(items: WorkItem[], visible: Set<string> | null, matching: Set<string>, collapsed: string[], filtered: boolean): Row[] {
  const kids = new Map<string | null, WorkItem[]>();
  for (const i of items) if (!visible || visible.has(i.id)) kids.set(i.parentId, [...kids.get(i.parentId) ?? [], i]);
  const out: Row[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const item of kids.get(parent) ?? []) {
      const n = kids.get(item.id)?.length ?? 0, isCollapsed = !filtered && n > 0 && collapsed.includes(item.id);
      out.push({ item, depth, children: n, collapsed: isCollapsed, context: !matching.has(item.id) });
      if (!isCollapsed) walk(item.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/** Capture sheet -> project screen handoff (desktop jumps to Inbox after capturing an idea). */
export const useCaptured = create<{ seq: number; kind: ItemKind }>(() => ({ seq: 0, kind: 'idea' }));
