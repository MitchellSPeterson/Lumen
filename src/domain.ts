export type ItemKind = 'idea' | 'todo' | 'feature' | 'bug';
export type Status = 'todo' | 'in_progress' | 'done';
export type Priority = 'low' | 'normal' | 'high';
export type PlanningLane = 'now' | 'next' | 'later' | null;
export interface AcceptanceCriterion { id: string; text: string; checked: boolean }
export interface FeatureDetails { problem: string; expectedBehavior: string; acceptanceCriteria: AcceptanceCriterion[]; openQuestions: string }
export interface BugDetails { stepsToReproduce: string; expectedBehavior: string; actualBehavior: string }
export interface ItemDetails { feature?: FeatureDetails; bug?: BugDetails }
export interface Project { id: string; name: string; folder: string; createdAt: string }
export interface WorkItem {
  id: string; projectId: string; parentId: string | null; order: number;
  title: string; kind: ItemKind; status: Status; priority: Priority; tags: string[];
  notes: string; planningLane: PlanningLane; details: ItemDetails; createdAt: string; updatedAt: string; x: number; y: number;
}
export interface RelatedLink { id: string; projectId: string; sourceId: string; targetId: string }
export interface ProjectView {
  mode: 'outline' | 'map' | 'board'; collapsed: string[];
  viewport: { x: number; y: number; zoom: number };
}
export interface Workspace {
  version: 2; projects: Project[]; items: WorkItem[]; links: RelatedLink[];
  views: Record<string, ProjectView>; activeProjectId: string | null;
}
export const kindLabels: Record<ItemKind, string> = { idea: 'Idea', todo: 'Todo', feature: 'Feature', bug: 'Bug' };
export const statusLabels: Record<Status, string> = { todo: 'Todo', in_progress: 'In progress', done: 'Done' };
export const planningLaneLabels: Record<Exclude<PlanningLane, null>, string> = { now: 'Now', next: 'Next', later: 'Later' };
export const emptyWorkspace = (): Workspace => ({ version: 2, projects: [], items: [], links: [], views: {}, activeProjectId: null });
export const defaultView = (): ProjectView => ({ mode: 'outline', collapsed: [], viewport: { x: 40, y: 40, zoom: 0.85 } });
export function createItem(projectId: string, kind: ItemKind = 'todo', parentId: string | null = null, count = 0): WorkItem {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), projectId, kind, parentId, order: count, title: `Untitled ${kind}`, status: 'todo', priority: 'normal', tags: [], notes: '', planningLane: null, details: {}, createdAt: now, updatedAt: now, x: parentId ? 560 : 280, y: count * 100 };
}
export function descendants(items: WorkItem[], id: string): Set<string> {
  const children = new Map<string, string[]>();
  for (const item of items) if (item.parentId) children.set(item.parentId, [...children.get(item.parentId) ?? [], item.id]);
  const found = new Set<string>();
  const queue = [id];
  while (queue.length) {
    const parent = queue.pop()!;
    for (const child of children.get(parent) ?? []) if (!found.has(child) && child !== id) { found.add(child); queue.push(child); }
  }
  return found;
}
export function validParent(items: WorkItem[], item: WorkItem, parentId: string | null): boolean {
  if (parentId === null) return true;
  const parent = items.find(i => i.id === parentId);
  return !!parent && parent.projectId === item.projectId && parentId !== item.id && !descendants(items, item.id).has(parentId);
}
function validDetails(value: unknown): value is ItemDetails {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const details = value as ItemDetails;
  if (details.feature !== undefined) {
    const f = details.feature;
    if (!f || typeof f !== 'object' || Array.isArray(f) || typeof f.problem !== 'string' || typeof f.expectedBehavior !== 'string' || typeof f.openQuestions !== 'string' || !Array.isArray(f.acceptanceCriteria)) return false;
    const ids = new Set<string>();
    for (const c of f.acceptanceCriteria) {
      if (!c || typeof c !== 'object' || typeof c.id !== 'string' || !c.id || ids.has(c.id) || typeof c.text !== 'string' || typeof c.checked !== 'boolean') return false;
      ids.add(c.id);
    }
  }
  if (details.bug !== undefined) {
    const b = details.bug;
    if (!b || typeof b !== 'object' || Array.isArray(b) || typeof b.stepsToReproduce !== 'string' || typeof b.expectedBehavior !== 'string' || typeof b.actualBehavior !== 'string') return false;
  }
  return true;
}
export function normalizeWorkspace(value: unknown): Workspace {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('This is not a Codebase Planner backup.');
  const raw = value as Record<string, unknown>;
  if (raw.version !== 1 && raw.version !== 2) throw new Error('Unsupported workspace version.');
  const normalized = structuredClone(raw);
  if (normalized.version === 1) {
    normalized.version = 2;
    if (Array.isArray(normalized.items)) normalized.items = normalized.items.map(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
      return { ...item, planningLane: item.planningLane === undefined ? null : item.planningLane, details: item.details === undefined ? {} : item.details };
    });
    if (normalized.views && typeof normalized.views === 'object' && !Array.isArray(normalized.views)) {
      for (const view of Object.values(normalized.views)) if (view && typeof view === 'object' && view.mode === 'list') view.mode = 'outline';
    }
  }
  validateWorkspace(normalized);
  return normalized;
}
export function validateWorkspace(value: unknown): asserts value is Workspace {
  const w = value as Workspace;
  if (!w || w.version !== 2 || !Array.isArray(w.projects) || !Array.isArray(w.items) || !Array.isArray(w.links) || !w.views || typeof w.views !== 'object' || Array.isArray(w.views)) throw new Error('This is not a version 2 Codebase Planner backup.');
  const projectIds = new Set<string>(), itemIds = new Set<string>(), linkIds = new Set<string>(), pairs = new Set<string>();
  for (const p of w.projects) {
    if (!p || typeof p.id !== 'string' || !p.id || projectIds.has(p.id) || typeof p.name !== 'string' || !p.name.trim() || typeof p.folder !== 'string' || typeof p.createdAt !== 'string') throw new Error('Backup contains an invalid project.');
    projectIds.add(p.id);
  }
  for (const i of w.items) {
    if (!i || typeof i.id !== 'string' || !i.id || itemIds.has(i.id) || !projectIds.has(i.projectId) || typeof i.title !== 'string' || !i.title.trim() || !['idea', 'todo', 'feature', 'bug'].includes(i.kind) || !['todo', 'in_progress', 'done'].includes(i.status) || !['low', 'normal', 'high'].includes(i.priority) || !Array.isArray(i.tags) || i.tags.some(t => typeof t !== 'string') || typeof i.notes !== 'string' || !(i.planningLane === null || ['now', 'next', 'later'].includes(i.planningLane)) || !validDetails(i.details) || typeof i.createdAt !== 'string' || typeof i.updatedAt !== 'string' || !Number.isFinite(i.x) || !Number.isFinite(i.y) || !Number.isFinite(i.order) || !(i.parentId === null || typeof i.parentId === 'string')) throw new Error('Backup contains an invalid item.');
    itemIds.add(i.id);
  }
  const byId = new Map(w.items.map(i => [i.id, i]));
  for (const item of w.items) {
    const seen = new Set([item.id]);
    let parentId = item.parentId;
    while (parentId !== null) {
      const parent = byId.get(parentId);
      if (!parent || parent.projectId !== item.projectId || seen.has(parentId)) throw new Error('Backup contains an invalid hierarchy.');
      seen.add(parentId); parentId = parent.parentId;
    }
  }
  for (const l of w.links) {
    const source = w.items.find(i => i.id === l?.sourceId), target = w.items.find(i => i.id === l?.targetId);
    const pair = [l?.sourceId, l?.targetId].sort().join(':');
    if (!l || typeof l.id !== 'string' || !l.id || linkIds.has(l.id) || !source || !target || source.id === target.id || source.projectId !== l.projectId || target.projectId !== l.projectId || pairs.has(pair)) throw new Error('Backup contains an invalid related link.');
    linkIds.add(l.id); pairs.add(pair);
  }
  if (w.activeProjectId !== null && !projectIds.has(w.activeProjectId)) throw new Error('Backup references a missing project.');
  for (const [id, view] of Object.entries(w.views)) {
    if (!projectIds.has(id) || !view || !['outline', 'map', 'board'].includes(view.mode) || !Array.isArray(view.collapsed) || view.collapsed.some(i => !w.items.some(item => item.id === i && item.projectId === id)) || !view.viewport || !Number.isFinite(view.viewport.x) || !Number.isFinite(view.viewport.y) || !Number.isFinite(view.viewport.zoom) || view.viewport.zoom <= 0) throw new Error('Backup contains an invalid map view.');
  }
}
export function importCopies(current: Workspace, incoming: Workspace): Workspace {
  validateWorkspace(incoming);
  const projects = new Map(incoming.projects.map(p => [p.id, crypto.randomUUID()]));
  const items = new Map(incoming.items.map(i => [i.id, crypto.randomUUID()]));
  const copiedProjects = incoming.projects.map(p => ({ ...p, id: projects.get(p.id)!, name: `${p.name} (imported)` }));
  const views = { ...current.views };
  for (const [id, v] of Object.entries(incoming.views)) views[projects.get(id)!] = { ...v, collapsed: v.collapsed.map(i => items.get(i)!) };
  return { ...current, projects: [...current.projects, ...copiedProjects], items: [...current.items, ...incoming.items.map(i => ({ ...i, id: items.get(i.id)!, projectId: projects.get(i.projectId)!, parentId: i.parentId ? items.get(i.parentId)! : null }))], links: [...current.links, ...incoming.links.map(l => ({ ...l, id: crypto.randomUUID(), projectId: projects.get(l.projectId)!, sourceId: items.get(l.sourceId)!, targetId: items.get(l.targetId)! }))], views, activeProjectId: copiedProjects[0]?.id ?? current.activeProjectId };
}

export function captureIdea(workspace: Workspace, projectId: string, title: string): { workspace: Workspace; itemId: string } {
  if (!workspace.projects.some(project => project.id === projectId)) throw new Error('Project does not exist.');
  if (!title.trim()) throw new Error('Idea title cannot be empty.');
  const siblings = workspace.items.filter(item => item.projectId === projectId && item.parentId === null);
  const item = { ...createItem(projectId, 'idea', null, Math.max(-1, ...siblings.map(item => item.order)) + 1), title: title.trim() };
  return { workspace: { ...workspace, items: [...workspace.items, item] }, itemId: item.id };
}
export function moveItem(workspace: Workspace, id: string, parentId: string | null, beforeId?: string | null): Workspace {
  const item = workspace.items.find(item => item.id === id);
  if (!item) throw new Error('Item does not exist.');
  if (!validParent(workspace.items, item, parentId)) throw new Error('Cannot move item to this parent.');
  if (beforeId === id && parentId === item.parentId) return workspace;
  const siblings = workspace.items.filter(other => other.id !== id && other.projectId === item.projectId && other.parentId === parentId).sort((a, b) => a.order - b.order);
  const index = beforeId == null ? siblings.length : siblings.findIndex(other => other.id === beforeId);
  if (index < 0) throw new Error('Destination sibling does not exist.');
  siblings.splice(index, 0, item);
  const orders = new Map(siblings.map((other, order) => [other.id, order]));
  return { ...workspace, items: workspace.items.map(other => orders.has(other.id) ? { ...other, parentId, order: orders.get(other.id)!, updatedAt: new Date().toISOString() } : other) };
}
export function reorderItem(workspace: Workspace, id: string, direction: -1 | 1): Workspace {
  if (direction !== -1 && direction !== 1) throw new Error('Invalid reorder direction.');
  const item = workspace.items.find(item => item.id === id);
  if (!item) throw new Error('Item does not exist.');
  const siblings = workspace.items.filter(other => other.projectId === item.projectId && other.parentId === item.parentId).sort((a, b) => a.order - b.order);
  const index = siblings.findIndex(other => other.id === id);
  if (index + direction < 0 || index + direction >= siblings.length) return workspace;
  const before = direction === -1 ? siblings[index - 1].id : siblings[index + 2]?.id;
  return moveItem(workspace, id, item.parentId, before);
}
export function groupItems(workspace: Workspace, ids: string[], title: string): { workspace: Workspace; featureId: string } {
  const selectedIds = new Set(ids);
  const selected = workspace.items.filter(item => selectedIds.has(item.id)).sort((a, b) => a.order - b.order);
  if (!selected.length || selected.length !== selectedIds.size || !title.trim()) throw new Error('Choose existing sibling items and a feature title.');
  const first = selected[0];
  if (selected.some(item => item.projectId !== first.projectId || item.parentId !== first.parentId)) throw new Error('Only sibling items can be grouped.');
  const feature = { ...createItem(first.projectId, 'feature', first.parentId, first.order), title: title.trim(), x: first.x, y: first.y };
  const childOrders = new Map(selected.map((item, index) => [item.id, index]));
  const siblings = workspace.items.filter(item => item.projectId === first.projectId && item.parentId === first.parentId).sort((a, b) => a.order - b.order);
  const groupedSiblings = siblings.flatMap(item => item.id === first.id ? [feature] : selectedIds.has(item.id) ? [] : [item]);
  const siblingOrders = new Map(groupedSiblings.map((item, index) => [item.id, index]));
  feature.order = siblingOrders.get(feature.id)!;
  return { workspace: { ...workspace, items: [...workspace.items.map(item => selectedIds.has(item.id) ? { ...item, parentId: feature.id, order: childOrders.get(item.id)!, updatedAt: feature.updatedAt } : siblingOrders.has(item.id) ? { ...item, order: siblingOrders.get(item.id)! } : item), feature] }, featureId: feature.id };
}
export function matchingWithAncestors(items: WorkItem[], matchingIds: Set<string>): Set<string> {
  const byId = new Map(items.map(item => [item.id, item]));
  const visible = new Set<string>();
  for (const id of matchingIds) {
    let item = byId.get(id);
    while (item && !visible.has(item.id)) {
      visible.add(item.id);
      item = item.parentId ? byId.get(item.parentId) : undefined;
    }
  }
  return visible;
}
export function itemSearchText(item: WorkItem): string {
  const f = item.details.feature, b = item.details.bug;
  return [item.title, item.notes, ...item.tags, f?.problem, f?.expectedBehavior, f?.openQuestions, ...(f?.acceptanceCriteria.map(criterion => criterion.text) ?? []), b?.stepsToReproduce, b?.expectedBehavior, b?.actualBehavior].filter(value => value !== undefined).join(' ').toLowerCase();
}
