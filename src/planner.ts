import { createItem, descendants, validateWorkspace } from './domain';
import type { RelatedLink, WorkItem, Workspace } from './domain';
import { arrangeItems } from './mapLayout';

const MAX_CONTEXT_CHARS = 100_000;
const MAX_OUTPUT_BYTES = 1024 * 1024;
const MAX_ITEMS = 100;
const MAX_LINKS = 200;
const MAX_KEY_LENGTH = 128;
const MAX_TITLE_LENGTH = 300;
const MAX_TAG_LENGTH = 64;
const MAX_TAGS = 20;
const MAX_NOTES_LENGTH = 8_000;

export const plannerOutputSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['items', 'links'],
  properties: {
    items: {
      type: 'array', maxItems: MAX_ITEMS,
      items: {
        type: 'object', additionalProperties: false,
        required: ['key', 'title', 'kind', 'priority', 'tags', 'notes', 'parent'],
        properties: {
          key: { type: 'string', minLength: 1, maxLength: MAX_KEY_LENGTH },
          title: { type: 'string', minLength: 1, maxLength: MAX_TITLE_LENGTH },
          kind: { type: 'string', enum: ['feature', 'todo', 'bug'] },
          priority: { type: 'string', enum: ['low', 'normal', 'high'] },
          tags: { type: 'array', maxItems: MAX_TAGS, items: { type: 'string', maxLength: MAX_TAG_LENGTH } },
          notes: { type: 'string', maxLength: MAX_NOTES_LENGTH },
          parent: {
            anyOf: [
              { type: 'null' },
              { type: 'object', additionalProperties: false, required: ['type', 'id'], properties: { type: { type: 'string', enum: ['new'] }, id: { type: 'string', minLength: 1, maxLength: MAX_KEY_LENGTH } } },
              { type: 'object', additionalProperties: false, required: ['type', 'id'], properties: { type: { type: 'string', enum: ['existing'] }, id: { type: 'string', minLength: 1, maxLength: MAX_KEY_LENGTH } } },
            ],
          },
        },
      },
    },
    links: {
      type: 'array', maxItems: MAX_LINKS,
      items: {
        type: 'object', additionalProperties: false, required: ['source', 'target'],
        properties: {
          source: { $ref: '#/$defs/reference' },
          target: { $ref: '#/$defs/reference' },
        },
      },
    },
  },
  $defs: {
    reference: {
      type: 'object', additionalProperties: false, required: ['type', 'id'],
      properties: {
        type: { type: 'string', enum: ['new', 'existing'] },
        id: { type: 'string', minLength: 1, maxLength: MAX_KEY_LENGTH },
      },
    },
  },
} as const;

export interface PlannerBatch {
  items: WorkItem[];
  links: RelatedLink[];
}

interface Reference { type: 'new' | 'existing'; id: string }
interface DraftItem {
  key: string; title: string; kind: WorkItem['kind']; priority: WorkItem['priority'];
  tags: string[]; notes: string; parent: null | Reference;
}
interface DraftLink { source: Reference; target: Reference }
interface PlannerDraft { items: DraftItem[]; links: DraftLink[] }

export function buildPlannerContext(workspace: Workspace, projectId: string, selectedId: string | null): string {
  validateWorkspace(workspace);
  const project = workspace.projects.find(candidate => candidate.id === projectId);
  if (!project) throw new Error('Cannot build planning context: project no longer exists.');
  const items = workspace.items.filter(item => item.projectId === projectId);
  const byId = new Map(items.map(item => [item.id, item]));
  if (selectedId !== null && !byId.has(selectedId)) throw new Error('Cannot build planning context: selected item is missing or belongs to another project.');
  const projectLinks = workspace.links.filter(link => link.projectId === projectId);
  const includedIds = selectedId === null ? new Set(byId.keys()) : new Set(descendants(items, selectedId));
  if (selectedId !== null) {
    includedIds.add(selectedId);
    let ancestorId = byId.get(selectedId)!.parentId;
    while (ancestorId !== null) {
      includedIds.add(ancestorId);
      ancestorId = byId.get(ancestorId)!.parentId;
    }
    const relatedIds = new Set<string>();
    for (const link of projectLinks) {
      if (includedIds.has(link.sourceId) && !includedIds.has(link.targetId)) relatedIds.add(link.targetId);
      if (includedIds.has(link.targetId) && !includedIds.has(link.sourceId)) relatedIds.add(link.sourceId);
    }
    for (const id of relatedIds) {
      includedIds.add(id);
      let parentId = byId.get(id)!.parentId;
      while (parentId !== null) {
        includedIds.add(parentId);
        parentId = byId.get(parentId)!.parentId;
      }
    }
  }
  const context = JSON.stringify({
    project: { id: project.id, name: project.name },
    items: items.filter(item => includedIds.has(item.id)).map(({ id, title, kind, parentId, status }) => ({ id, title, kind, parentId, status })),
    links: projectLinks.filter(link => includedIds.has(link.sourceId) && includedIds.has(link.targetId)).map(({ sourceId, targetId }) => ({ sourceId, targetId })),
    selected: selectedId === null ? null : { id: selectedId, notes: byId.get(selectedId)!.notes },
  });
  if (context.length > MAX_CONTEXT_CHARS) {
    throw new Error(`Project planning context is too large (${context.length} characters; maximum is ${MAX_CONTEXT_CHARS}). Narrow the project or select a smaller scope.`);
  }
  return context;
}

export function applyPlannerDraft(workspace: Workspace, projectId: string, value: unknown): { workspace: Workspace; batch: PlannerBatch } {
  validateWorkspace(workspace);
  if (!workspace.projects.some(project => project.id === projectId)) throw new Error('Cannot apply plan: project no longer exists.');
  const draft = parseDraft(value);
  if (draft.items.length === 0 && draft.links.length === 0) return { workspace, batch: { items: [], links: [] } };

  const projectItems = workspace.items.filter(item => item.projectId === projectId);
  const existingById = new Map(projectItems.map(item => [item.id, item]));
  const draftsByKey = new Map<string, DraftItem>();
  for (const item of draft.items) {
    if (draftsByKey.has(item.key)) throw new Error(`Plan contains duplicate item key "${item.key}".`);
    draftsByKey.set(item.key, item);
  }

  const parentKeys = new Map<string, string | null>();
  const parentExistingIds = new Map<string, string | null>();
  for (const item of draft.items) {
    if (item.parent === null) {
      parentKeys.set(item.key, null); parentExistingIds.set(item.key, null);
    } else if (item.parent.type === 'new') {
      if (!draftsByKey.has(item.parent.id)) throw new Error(`Plan item "${item.key}" references unknown new parent "${item.parent.id}".`);
      parentKeys.set(item.key, item.parent.id); parentExistingIds.set(item.key, null);
    } else {
      if (!existingById.has(item.parent.id)) throw new Error(`Plan item "${item.key}" references missing or cross-project parent "${item.parent.id}".`);
      parentKeys.set(item.key, null); parentExistingIds.set(item.key, item.parent.id);
    }
  }
  assertAcyclic(parentKeys);

  const idsByKey = new Map<string, string>();
  for (const item of draft.items) idsByKey.set(item.key, crypto.randomUUID());
  const batchItems: WorkItem[] = [];
  const orderByParent = new Map<string | null, number>();
  for (const old of projectItems) orderByParent.set(old.parentId, Math.max(orderByParent.get(old.parentId) ?? -1, old.order));
  for (const item of draft.items) {
    const parentKey = parentKeys.get(item.key);
    const parentId = parentExistingIds.get(item.key) ?? (parentKey == null ? null : idsByKey.get(parentKey)!);
    const nextOrder = (orderByParent.get(parentId) ?? -1) + 1;
    orderByParent.set(parentId, nextOrder);
    const created = createItem(projectId, item.kind, parentId, nextOrder);
    Object.assign(created, { id: idsByKey.get(item.key)!, title: item.title, priority: item.priority, tags: [...item.tags], notes: item.notes });
    batchItems.push(created);
  }

  const laidOut = arrangeItems(batchItems);
  if (batchItems.length) {
    const maxExistingRight = projectItems.reduce((max, item) => Math.max(max, item.x + 224), 0);
    const minGeneratedX = Math.min(...laidOut.map(item => item.x));
    const shiftX = maxExistingRight + 104 - minGeneratedX;
    laidOut.forEach((item, index) => {
      batchItems[index].x = item.x + shiftX;
      batchItems[index].y = item.y;
    });
  }

  const known = new Set([...existingById.keys(), ...batchItems.map(item => item.id)]);
  const pairs = new Set(workspace.links.map(link => undirectedPair(link.sourceId, link.targetId)));
  const batchLinks: RelatedLink[] = [];
  for (const link of draft.links) {
    const sourceId = resolveReference(link.source, existingById, idsByKey);
    const targetId = resolveReference(link.target, existingById, idsByKey);
    if (!known.has(sourceId) || !known.has(targetId)) throw new Error('Plan link references an unknown item.');
    if (sourceId === targetId) throw new Error('Plan cannot link an item to itself.');
    const pair = undirectedPair(sourceId, targetId);
    if (pairs.has(pair)) continue;
    pairs.add(pair);
    batchLinks.push({ id: crypto.randomUUID(), projectId, sourceId, targetId });
  }

  const views = { ...workspace.views };
  const view = views[projectId];
  if (view) {
    const revealParents = new Set(batchItems.flatMap(item => item.parentId ? [item.parentId] : []));
    let changed = true;
    while (changed) {
      changed = false;
      for (const item of projectItems) if (item.parentId && revealParents.has(item.id) && !revealParents.has(item.parentId)) {
        revealParents.add(item.parentId); changed = true;
      }
    }
    views[projectId] = { ...view, collapsed: view.collapsed.filter(id => !revealParents.has(id)) };
  }
  const next: Workspace = {
    ...workspace, views,
    items: [...workspace.items, ...batchItems],
    links: [...workspace.links, ...batchLinks],
  };
  validateWorkspace(next);
  return { workspace: next, batch: { items: batchItems.map(item => ({ ...item, tags: [...item.tags] })), links: batchLinks.map(link => ({ ...link })) } };
}

export function canUndoPlannerBatch(workspace: Workspace, batch: PlannerBatch): boolean {
  const itemIds = new Set(batch.items.map(item => item.id));
  const linkIds = new Set(batch.links.map(link => link.id));
  if (itemIds.size !== batch.items.length || linkIds.size !== batch.links.length) return false;
  for (const snapshot of batch.items) {
    const current = workspace.items.find(item => item.id === snapshot.id);
    if (!current || !sameItem(current, snapshot)) return false;
  }
  for (const snapshot of batch.links) {
    const current = workspace.links.find(link => link.id === snapshot.id);
    if (!current || !sameLink(current, snapshot)) return false;
  }
  if (workspace.items.some(item => !itemIds.has(item.id) && item.parentId !== null && itemIds.has(item.parentId))) return false;
  if (workspace.links.some(link => !linkIds.has(link.id) && (itemIds.has(link.sourceId) || itemIds.has(link.targetId)))) return false;
  return true;
}

export function undoPlannerBatch(workspace: Workspace, batch: PlannerBatch): Workspace {
  if (!canUndoPlannerBatch(workspace, batch)) throw new Error('This generated batch can no longer be undone safely.');
  if (batch.items.length === 0 && batch.links.length === 0) return workspace;
  const itemIds = new Set(batch.items.map(item => item.id));
  const linkIds = new Set(batch.links.map(link => link.id));
  const views = { ...workspace.views };
  for (const [projectId, view] of Object.entries(views)) {
    const collapsed = view.collapsed.filter(id => !itemIds.has(id));
    if (collapsed.length !== view.collapsed.length) views[projectId] = { ...view, collapsed };
  }
  const result: Workspace = {
    ...workspace, views,
    items: workspace.items.filter(item => !itemIds.has(item.id)),
    links: workspace.links.filter(link => !linkIds.has(link.id)),
  };
  validateWorkspace(result);
  return result;
}

function parseDraft(value: unknown): PlannerDraft {
  let serialized: string;
  try { serialized = JSON.stringify(value); }
  catch { throw new Error('Planner output must be valid JSON.'); }
  if (typeof serialized !== 'string') throw new Error('Planner output must be a JSON object.');
  if (new TextEncoder().encode(serialized).byteLength > MAX_OUTPUT_BYTES) throw new Error('Planner output exceeds the 1 MiB limit.');
  if (!isRecord(value) || !hasOnly(value, ['items', 'links']) || !Array.isArray(value.items) || !Array.isArray(value.links)) throw new Error('Planner output must contain only items and links arrays.');
  if (value.items.length > MAX_ITEMS) throw new Error(`Planner output may contain at most ${MAX_ITEMS} items.`);
  if (value.links.length > MAX_LINKS) throw new Error(`Planner output may contain at most ${MAX_LINKS} links.`);
  const items = value.items.map((item, index): DraftItem => {
    if (!isRecord(item) || !hasOnly(item, ['key', 'title', 'kind', 'priority', 'tags', 'notes', 'parent'])) throw new Error(`Planner item ${index + 1} has missing or extra fields.`);
    const key = boundedString(item.key, `item ${index + 1} key`, MAX_KEY_LENGTH, true);
    const title = boundedString(item.title, `item "${key}" title`, MAX_TITLE_LENGTH, true);
    if (!title.trim()) throw new Error(`Planner item "${key}" needs a non-blank title.`);
    if (!['feature', 'todo', 'bug'].includes(item.kind as string)) throw new Error(`Planner item "${key}" has an invalid kind.`);
    if (!['low', 'normal', 'high'].includes(item.priority as string)) throw new Error(`Planner item "${key}" has an invalid priority.`);
    if (!Array.isArray(item.tags) || item.tags.length > MAX_TAGS || item.tags.some(tag => typeof tag !== 'string' || tag.length > MAX_TAG_LENGTH)) throw new Error(`Planner item "${key}" has invalid tags.`);
    const notes = boundedString(item.notes, `item "${key}" notes`, MAX_NOTES_LENGTH, false);
    const parent = item.parent === null ? null : parseReference(item.parent, `item "${key}" parent`, ['new', 'existing']);
    return { key, title, kind: item.kind as DraftItem['kind'], priority: item.priority as DraftItem['priority'], tags: [...item.tags] as string[], notes, parent };
  });
  const links = value.links.map((link, index): DraftLink => {
    if (!isRecord(link) || !hasOnly(link, ['source', 'target'])) throw new Error(`Planner link ${index + 1} has missing or extra fields.`);
    return {
      source: parseReference(link.source, `link ${index + 1} source`, ['new', 'existing']),
      target: parseReference(link.target, `link ${index + 1} target`, ['new', 'existing']),
    };
  });
  return { items, links };
}

function parseReference(value: unknown, label: string, types: readonly string[]): Reference {
  if (!isRecord(value) || !hasOnly(value, ['type', 'id']) || !types.includes(value.type as string)) throw new Error(`Planner ${label} is invalid.`);
  return { type: value.type as Reference['type'], id: boundedString(value.id, `${label} ID`, MAX_KEY_LENGTH, true) };
}

function boundedString(value: unknown, label: string, maxLength: number, nonEmpty: boolean): string {
  if (typeof value !== 'string' || value.length > maxLength || (nonEmpty && value.length === 0)) throw new Error(`Planner ${label} must be a string up to ${maxLength} characters${nonEmpty ? ' and cannot be empty' : ''}.`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOnly(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value);
  return keys.every(key => Object.hasOwn(value, key)) && actual.every(key => keys.includes(key));
}

function assertAcyclic(parents: Map<string, string | null>): void {
  const done = new Set<string>();
  for (const key of parents.keys()) {
    const path = new Set<string>();
    let cursor: string | null = key;
    while (cursor !== null && parents.has(cursor) && !done.has(cursor)) {
      if (path.has(cursor)) throw new Error(`Planner item hierarchy contains a cycle at "${cursor}".`);
      path.add(cursor);
      cursor = parents.get(cursor) ?? null;
    }
    for (const visited of path) done.add(visited);
  }
}

function resolveReference(reference: Reference, existing: Map<string, WorkItem>, created: Map<string, string>): string {
  if (reference.type === 'existing') {
    const item = existing.get(reference.id);
    if (!item) throw new Error(`Plan references missing or cross-project item "${reference.id}".`);
    return item.id;
  }
  const id = created.get(reference.id);
  if (!id) throw new Error(`Plan references unknown new item "${reference.id}".`);
  return id;
}

function undirectedPair(a: string, b: string): string {
  return a < b ? `${a}\0${b}` : `${b}\0${a}`;
}

function sameItem(a: WorkItem, b: WorkItem): boolean {
  return a.id === b.id && a.projectId === b.projectId && a.parentId === b.parentId && a.order === b.order
    && a.title === b.title && a.kind === b.kind && a.status === b.status && a.priority === b.priority
    && JSON.stringify(a.tags) === JSON.stringify(b.tags) && a.notes === b.notes
    && a.createdAt === b.createdAt && a.updatedAt === b.updatedAt && a.x === b.x && a.y === b.y;
}

function sameLink(a: RelatedLink, b: RelatedLink): boolean {
  return a.id === b.id && a.projectId === b.projectId && a.sourceId === b.sourceId && a.targetId === b.targetId;
}
