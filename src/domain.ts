export type ItemKind = 'todo' | 'feature' | 'bug';
export type Status = 'todo' | 'in_progress' | 'done';
export type Priority = 'low' | 'normal' | 'high';
export interface Project { id: string; name: string; folder: string; createdAt: string }
export interface WorkItem {
  id: string; projectId: string; parentId: string | null; order: number;
  title: string; kind: ItemKind; status: Status; priority: Priority; tags: string[];
  notes: string; createdAt: string; updatedAt: string; x: number; y: number;
}
export interface RelatedLink { id: string; projectId: string; sourceId: string; targetId: string }
export interface ProjectView {
  mode: 'map' | 'list'; collapsed: string[];
  viewport: { x: number; y: number; zoom: number };
}
export interface Workspace {
  version: 1; projects: Project[]; items: WorkItem[]; links: RelatedLink[];
  views: Record<string, ProjectView>; activeProjectId: string | null;
}
export const kindLabels: Record<ItemKind, string> = { todo: 'Todo', feature: 'Feature', bug: 'Bug' };
export const statusLabels: Record<Status, string> = { todo: 'Todo', in_progress: 'In progress', done: 'Done' };
export const emptyWorkspace = (): Workspace => ({ version: 1, projects: [], items: [], links: [], views: {}, activeProjectId: null });
export const defaultView = (): ProjectView => ({ mode: 'map', collapsed: [], viewport: { x: 40, y: 40, zoom: 0.85 } });
export function createItem(projectId: string, kind: ItemKind = 'todo', parentId: string | null = null, count = 0): WorkItem {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), projectId, kind, parentId, order: count, title: `Untitled ${kind}`, status: 'todo', priority: 'normal', tags: [], notes: '', createdAt: now, updatedAt: now, x: parentId ? 560 : 280, y: count * 100 };
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
export function validateWorkspace(value: unknown): asserts value is Workspace {
  const w = value as Workspace;
  if (!w || w.version !== 1 || !Array.isArray(w.projects) || !Array.isArray(w.items) || !Array.isArray(w.links) || !w.views || typeof w.views !== 'object' || Array.isArray(w.views)) throw new Error('This is not a version 1 Codebase Planner backup.');
  const projectIds = new Set<string>(), itemIds = new Set<string>(), linkIds = new Set<string>(), pairs = new Set<string>();
  for (const p of w.projects) {
    if (!p || typeof p.id !== 'string' || !p.id || projectIds.has(p.id) || typeof p.name !== 'string' || !p.name.trim() || typeof p.folder !== 'string' || typeof p.createdAt !== 'string') throw new Error('Backup contains an invalid project.');
    projectIds.add(p.id);
  }
  for (const i of w.items) {
    if (!i || typeof i.id !== 'string' || !i.id || itemIds.has(i.id) || !projectIds.has(i.projectId) || typeof i.title !== 'string' || !i.title.trim() || !['todo', 'feature', 'bug'].includes(i.kind) || !['todo', 'in_progress', 'done'].includes(i.status) || !['low', 'normal', 'high'].includes(i.priority) || !Array.isArray(i.tags) || i.tags.some(t => typeof t !== 'string') || typeof i.notes !== 'string' || typeof i.createdAt !== 'string' || typeof i.updatedAt !== 'string' || !Number.isFinite(i.x) || !Number.isFinite(i.y) || !Number.isFinite(i.order) || !(i.parentId === null || typeof i.parentId === 'string')) throw new Error('Backup contains an invalid item.');
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
    if (!projectIds.has(id) || !view || !['map', 'list'].includes(view.mode) || !Array.isArray(view.collapsed) || view.collapsed.some(i => !w.items.some(item => item.id === i && item.projectId === id)) || !view.viewport || !Number.isFinite(view.viewport.x) || !Number.isFinite(view.viewport.y) || !Number.isFinite(view.viewport.zoom) || view.viewport.zoom <= 0) throw new Error('Backup contains an invalid map view.');
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
