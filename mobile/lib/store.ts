import { AppState } from 'react-native';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import {
  captureItem as domainCapture, createItem, defaultView, descendants, emptyWorkspace, groupItems as domainGroup,
  importCopies, moveItem as domainMove, reorderItem as domainReorder, validParent,
  type ItemKind, type Project, type ProjectView, type RelatedLink, type WorkItem, type Workspace,
} from '@shared/domain';
import { arrangeItems } from '@shared/mapLayout';
import { defaultPrefs, loadPrefs, loadWorkspace, savePrefs, saveWorkspace, type Prefs } from './storage';

export type SaveStatus = 'saved' | 'saving' | 'error';
export type ItemPatch = Partial<Omit<WorkItem, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>>;
export type ProjectPatch = Partial<Pick<Project, 'name' | 'folder' | 'image'>>;

interface State {
  workspace: Workspace; loaded: boolean; loadError: string; saveStatus: SaveStatus; saveError: string; prefs: Prefs;
  loadAll(): Promise<void>;
  createProject(name: string, folder?: string, image?: string): string;
  updateProject(id: string, patch: ProjectPatch): void;
  deleteProject(id: string): void;
  setActiveProject(id: string | null): void;
  addItem(projectId: string, kind: ItemKind, parentId?: string | null): string;
  captureItem(projectId: string, title: string, kind: ItemKind): string;
  updateItem(id: string, patch: ItemPatch): void;
  deleteItem(id: string): void;
  moveItem(id: string, parentId: string | null, beforeId?: string | null): void;
  reorderItem(id: string, dir: -1 | 1): void;
  groupItems(ids: string[], title: string): string;
  addLink(projectId: string, sourceId: string, targetId: string): void;
  removeLink(id: string): void;
  setView(projectId: string, patch: Partial<ProjectView>): void;
  toggleCollapsed(projectId: string, itemId: string): void;
  arrange(projectId: string): void;
  importBackup(workspace: Workspace): void;
  setPrefs(patch: Partial<Prefs>): void;
  flush(): Promise<void>;
}

const msg = (e: unknown) => String(e instanceof Error ? e.message : e);
const now = () => new Date().toISOString();
const emptyFeature = () => ({ problem: '', expectedBehavior: '', acceptanceCriteria: [], openQuestions: '' });
const emptyBug = () => ({ stepsToReproduce: '', expectedBehavior: '', actualBehavior: '' });

let timer: ReturnType<typeof setTimeout> | undefined;
let revision = 0, savedRevision = 0;
let queue: Promise<void> = Promise.resolve();

export const useStore = create<State>((set, get) => {
  /** Apply a pure workspace transform, then schedule a debounced save. */
  const mutate = (fn: (w: Workspace) => Workspace) => {
    set(s => ({ workspace: fn(s.workspace) }));
    revision++;
    clearTimeout(timer);
    timer = setTimeout(() => { void get().flush().catch(() => {}); }, 400);
  };
  const viewOf = (w: Workspace, projectId: string): ProjectView => w.views[projectId] ?? defaultView();
  const touch = (w: Workspace, id: string, fn: (i: WorkItem) => WorkItem): Workspace =>
    ({ ...w, items: w.items.map(i => i.id === id ? { ...fn(i), updatedAt: now() } : i) });

  return {
    workspace: emptyWorkspace(), loaded: false, loadError: '', saveStatus: 'saved', saveError: '', prefs: defaultPrefs,

    async loadAll() {
      set({ loadError: '' });
      try {
        const [workspace, prefs] = await Promise.all([loadWorkspace(), loadPrefs()]);
        revision = savedRevision = 0;
        set({ workspace, prefs, loaded: true });
      } catch (e) { set({ loadError: msg(e) }); }
    },

    createProject(name, folder = '', image) {
      const id = crypto.randomUUID();
      mutate(w => ({
        ...w, activeProjectId: id,
        projects: [...w.projects, { id, name: name.trim(), folder, createdAt: now(), ...(image ? { image } : {}) }],
        views: { ...w.views, [id]: defaultView() },
      }));
      return id;
    },
    updateProject(id, patch) {
      mutate(w => ({ ...w, projects: w.projects.map(p => {
        if (p.id !== id) return p;
        const next = { ...p, ...patch };
        if (next.image === undefined) delete next.image;
        return next;
      }) }));
    },
    deleteProject(id) {
      mutate(w => {
        const projects = w.projects.filter(p => p.id !== id);
        const { [id]: _gone, ...views } = w.views;
        return {
          ...w, projects, views,
          items: w.items.filter(i => i.projectId !== id), links: w.links.filter(l => l.projectId !== id),
          activeProjectId: projects.some(p => p.id === w.activeProjectId) ? w.activeProjectId : projects[0]?.id ?? null,
        };
      });
    },
    setActiveProject(id) { mutate(w => ({ ...w, activeProjectId: id })); },

    addItem(projectId, kind, parentId = null) {
      const w = get().workspace;
      const items = w.items.filter(i => i.projectId === projectId);
      const item = createItem(projectId, kind, parentId, items.length);
      // Same placement as desktop App.addItem; sibling order = next index among siblings.
      const parent = items.find(i => i.id === parentId), siblings = items.filter(i => i.parentId === parentId);
      item.order = siblings.length ? Math.max(...siblings.map(i => i.order)) + 1 : 0;
      item.x = parent ? parent.x + 310 : 280;
      item.y = siblings.length ? Math.max(...siblings.map(i => i.y)) + 130 : parent?.y ?? 0;
      if (kind === 'feature') item.details = { feature: emptyFeature() };
      if (kind === 'bug') item.details = { bug: emptyBug() };
      mutate(w => {
        const v = viewOf(w, projectId);
        return { ...w, items: [...w.items, item], views: { ...w.views, [projectId]: { ...v, collapsed: v.collapsed.filter(c => c !== parentId) } } };
      });
      return item.id;
    },
    captureItem(projectId, title, kind) {
      const { workspace, itemId } = domainCapture(get().workspace, projectId, title, kind);
      mutate(() => workspace);
      return itemId;
    },
    updateItem(id, patch) {
      mutate(w => touch(w, id, i => {
        const next = { ...i, ...patch };
        if (patch.kind && patch.kind !== i.kind) {
          if (patch.kind === 'feature' && !next.details.feature) next.details = { ...next.details, feature: emptyFeature() };
          if (patch.kind === 'bug' && !next.details.bug) next.details = { ...next.details, bug: emptyBug() };
        }
        return next;
      }));
    },
    // Desktop semantics: deleting an item deletes its whole branch (descendants) and their links.
    deleteItem(id) {
      mutate(w => {
        const gone = new Set([id, ...descendants(w.items, id)]);
        return {
          ...w, items: w.items.filter(i => !gone.has(i.id)),
          links: w.links.filter(l => !gone.has(l.sourceId) && !gone.has(l.targetId)),
          views: Object.fromEntries(Object.entries(w.views).map(([k, v]) => [k, { ...v, collapsed: v.collapsed.filter(c => !gone.has(c)) }])),
        };
      });
    },
    moveItem(id, parentId, beforeId) {
      const w = get().workspace, item = w.items.find(i => i.id === id);
      if (!item || !validParent(w.items, item, parentId)) return;
      mutate(w => touch(domainMove(w, id, parentId, beforeId), id, i => i));
    },
    reorderItem(id, dir) {
      const before = get().workspace;
      const next = domainReorder(before, id, dir);
      if (next === before) return;
      mutate(() => touch(next, id, i => i));
    },
    groupItems(ids, title) {
      const { workspace, featureId } = domainGroup(get().workspace, ids, title);
      mutate(() => workspace);
      return featureId;
    },
    addLink(projectId, sourceId, targetId) {
      const w = get().workspace;
      const has = (id: string) => w.items.some(i => i.id === id && i.projectId === projectId);
      if (sourceId === targetId || !has(sourceId) || !has(targetId)) return;
      if (w.links.some(l => (l.sourceId === sourceId && l.targetId === targetId) || (l.sourceId === targetId && l.targetId === sourceId))) return;
      const link: RelatedLink = { id: crypto.randomUUID(), projectId, sourceId, targetId };
      mutate(w => ({ ...w, links: [...w.links, link] }));
    },
    removeLink(id) { mutate(w => ({ ...w, links: w.links.filter(l => l.id !== id) })); },
    setView(projectId, patch) {
      mutate(w => ({ ...w, views: { ...w.views, [projectId]: { ...viewOf(w, projectId), ...patch } } }));
    },
    toggleCollapsed(projectId, itemId) {
      mutate(w => {
        const v = viewOf(w, projectId);
        const collapsed = v.collapsed.includes(itemId) ? v.collapsed.filter(c => c !== itemId) : [...v.collapsed, itemId];
        return { ...w, views: { ...w.views, [projectId]: { ...v, collapsed } } };
      });
    },
    arrange(projectId) {
      mutate(w => {
        const arranged = new Map(arrangeItems(w.items.filter(i => i.projectId === projectId)).map(i => [i.id, i]));
        return { ...w, items: w.items.map(i => { const a = arranged.get(i.id); return a ? { ...i, x: a.x, y: a.y, updatedAt: now() } : i; }) };
      });
    },
    importBackup(incoming) { mutate(w => importCopies(w, incoming)); },
    setPrefs(patch) { const prefs = { ...get().prefs, ...patch }; set({ prefs }); savePrefs(prefs); },

    flush() {
      clearTimeout(timer);
      const run = async () => {
        try {
          while (savedRevision < revision) {
            const target = revision, snapshot = get().workspace;
            set({ saveStatus: 'saving' });
            await saveWorkspace(snapshot);
            savedRevision = target;
          }
          set({ saveStatus: 'saved', saveError: '' });
        } catch (e) { set({ saveStatus: 'error', saveError: msg(e) }); throw e; }
      };
      const next = queue.catch(() => {}).then(run);
      queue = next;
      return next;
    },
  };
});

AppState.addEventListener('change', s => { if (s !== 'active' && useStore.getState().loaded) void useStore.getState().flush().catch(() => {}); });

// ---- Selectors (stable: primitives, or arrays through useShallow) ----
export const useProject = (id: string) => useStore(s => s.workspace.projects.find(p => p.id === id));
export const useProjects = () => useStore(s => s.workspace.projects);
export const useItem = (id: string) => useStore(s => s.workspace.items.find(i => i.id === id));
export const useProjectItems = (projectId: string) =>
  useStore(useShallow(s => s.workspace.items.filter(i => i.projectId === projectId)));
export const useProjectLinks = (projectId: string) =>
  useStore(useShallow(s => s.workspace.links.filter(l => l.projectId === projectId)));
export const useItemLinks = (itemId: string) =>
  useStore(useShallow(s => s.workspace.links.filter(l => l.sourceId === itemId || l.targetId === itemId)));
export const useProjectView = (projectId: string): ProjectView =>
  useStore(s => s.workspace.views[projectId]) ?? defaultViewConst;
export const useItemCount = (projectId: string) => useStore(s => s.workspace.items.reduce((n, i) => n + (i.projectId === projectId ? 1 : 0), 0));
const defaultViewConst = defaultView();
