import { describe, expect, it } from 'vitest';
import { applyPlannerDraft, buildPlannerContext, canUndoPlannerBatch, plannerOutputSchema, undoPlannerBatch } from './planner';
import { defaultView, type Project, type WorkItem, type Workspace } from './domain';

const project = (id: string): Project => ({ id, name: `Project ${id}`, folder: '', createdAt: '' });
const item = (id: string, projectId = 'p1', parentId: string | null = null): WorkItem => ({
  id, projectId, parentId, order: 0, title: id, kind: 'feature', status: 'todo', priority: 'normal',
  tags: [], notes: '', createdAt: '', updatedAt: '', x: 20, y: 30,
});
const workspace = (): Workspace => ({
  version: 1, projects: [project('p1'), project('p2')],
  items: [item('parent'), item('child', 'p1', 'parent'), item('other', 'p2')],
  links: [{ id: 'existing-link', projectId: 'p1', sourceId: 'parent', targetId: 'child' }],
  views: { p1: { ...defaultView(), collapsed: ['parent'] }, p2: defaultView() }, activeProjectId: 'p1',
});
const draft = (items: unknown[] = [], links: unknown[] = []) => ({ items, links });
const row = (key: string, parent: null | { type: 'new' | 'existing'; id: string } = null) => ({
  key, title: `Title ${key}`, kind: 'todo', priority: 'high', tags: ['plan'], notes: `Notes ${key}`, parent,
});
const link = (source: { type: 'new' | 'existing'; id: string }, target: { type: 'new' | 'existing'; id: string }) => ({ source, target });

describe('planner draft contract', () => {
  it('declares types throughout the strict output schema, including nullable parent branches', () => {
    const check = (schema: Record<string, unknown>, path: string) => {
      expect(schema.type || schema.$ref || schema.anyOf, `Missing type at ${path}`).toBeTruthy();
      if (schema.type === 'object') {
        const properties = schema.properties as Record<string, Record<string, unknown>>;
        expect(schema.additionalProperties, path).toBe(false);
        expect(new Set(schema.required as string[]), path).toEqual(new Set(Object.keys(properties)));
        for (const [key, property] of Object.entries(properties)) check(property, `${path}.${key}`);
      }
      if (schema.type === 'array') check(schema.items as Record<string, unknown>, `${path}[]`);
      if (Array.isArray(schema.anyOf)) schema.anyOf.forEach((branch, index) => check(branch, `${path}.anyOf[${index}]`));
      if (schema.$defs) for (const [key, definition] of Object.entries(schema.$defs)) check(definition, `${path}.$defs.${key}`);
    };
    check(plannerOutputSchema, '$');
  });

  it('rejects malformed drafts atomically and leaves the input workspace unchanged', () => {
    const invalid = [
      { items: [row('a')], links: [], extra: true },
      draft([{ ...row('a'), title: '  ' }]),
      draft([{ ...row('a'), extra: 'no' }]),
      draft([{ ...row('a'), kind: 'epic' }]),
      draft([row('a'), row('a')]),
      draft([row('a', { type: 'existing', id: 'other' })]),
      draft([row('a', { type: 'new', id: 'missing' })]),
      draft([row('a')], [link({ type: 'new', id: 'missing' }, { type: 'existing', id: 'parent' })]),
      draft([row('a')], [link({ type: 'new', id: 'a' }, { type: 'new', id: 'a' })]),
      draft([row('a', { type: 'new', id: 'b' }), row('b', { type: 'new', id: 'a' })]),
    ];
    for (const value of invalid) {
      const current = workspace();
      const before = structuredClone(current);
      expect(() => applyPlannerDraft(current, 'p1', value)).toThrow();
      expect(current).toEqual(before);
    }
  });

  it('applies child-before-parent drafts, deduplicates undirected links, preserves old data and coordinates, and expands parents', () => {
    const current = workspace();
    current.items[0].x = -300;
    current.items[0].y = 415;
    current.items.push({ ...item('far'), x: 900 });
    const existingBefore = structuredClone(current.items);
    const value = draft(
      [row('child', { type: 'new', id: 'parent-key' }), row('parent-key', { type: 'existing', id: 'parent' })],
      [
        link({ type: 'existing', id: 'parent' }, { type: 'existing', id: 'child' }),
        link({ type: 'existing', id: 'child' }, { type: 'existing', id: 'parent' }),
        link({ type: 'new', id: 'child' }, { type: 'new', id: 'parent-key' }),
      ],
    );
    const result = applyPlannerDraft(current, 'p1', value);
    expect(result.batch.items).toHaveLength(2);
    expect(result.batch.links).toHaveLength(1);
    expect(result.workspace.items.slice(0, existingBefore.length)).toEqual(existingBefore);
    expect(result.workspace.links).toHaveLength(current.links.length + 1);
    expect(result.workspace.views.p1.collapsed).toEqual([]);
    const [child, parent] = result.batch.items;
    expect(child.parentId).toBe(parent.id);
    expect(child.status).toBe('todo');
    expect(child.projectId).toBe('p1');
    expect(child.x).toBeGreaterThan(1_124);
    expect(parent.x).toBeGreaterThan(1_124);
    expect(child.x).toBeGreaterThan(parent.x);
    expect(new Set(result.batch.items.map(created => `${created.x},${created.y}`)).size).toBe(result.batch.items.length);
  });

  it('accepts an empty draft as a no-op', () => {
    const current = workspace();
    const result = applyPlannerDraft(current, 'p1', draft());
    expect(result.workspace).toBe(current);
    expect(result.batch).toEqual({ items: [], links: [] });
    expect(canUndoPlannerBatch(current, result.batch)).toBe(true);
    expect(undoPlannerBatch(current, result.batch)).toBe(current);
  });

  it('rejects outputs above the byte cap and contexts above the character cap', () => {
    const current = workspace();
    expect(() => applyPlannerDraft(current, 'p1', draft([{ ...row('large'), notes: 'x'.repeat(1_048_577) }]))).toThrow('1 MiB');
    current.items = Array.from({ length: 1_000 }, (_, index) => ({ ...item(`item-${index}`), title: 'x'.repeat(100) }));
    current.links = [];
    current.views.p1 = defaultView();
    expect(() => buildPlannerContext(current, 'p1', null)).toThrow('maximum is 100000');
  });

  it('limits selected-item context to its subtree, ancestors, and directly related items with parent closure', () => {
    const current = workspace();
    current.items.push(item('selected', 'p1', 'parent'), item('descendant', 'p1', 'selected'));
    current.items.push(item('related-parent'), item('related', 'p1', 'related-parent'), item('unrelated'));
    current.items.find(entry => entry.id === 'selected')!.notes = 'Selected notes';
    current.links.push({ id: 'scoped-link', projectId: 'p1', sourceId: 'descendant', targetId: 'related' });
    current.links.push({ id: 'unrelated-link', projectId: 'p1', sourceId: 'child', targetId: 'unrelated' });

    const context = JSON.parse(buildPlannerContext(current, 'p1', 'selected')) as {
      items: { id: string; parentId: string | null }[];
      links: { sourceId: string; targetId: string }[];
      selected: { id: string; notes: string };
    };
    const ids = new Set(context.items.map(entry => entry.id));
    expect(ids).toEqual(new Set(['parent', 'child', 'selected', 'descendant', 'related-parent', 'related']));
    expect(context.links).toEqual(expect.arrayContaining([
      { sourceId: 'parent', targetId: 'child' },
      { sourceId: 'descendant', targetId: 'related' },
    ]));
    expect(context.links).not.toContainEqual({ sourceId: 'child', targetId: 'unrelated' });
    expect(context.selected).toEqual({ id: 'selected', notes: 'Selected notes' });
    for (const entry of context.items) if (entry.parentId !== null) expect(ids.has(entry.parentId)).toBe(true);
  });
});

describe('planner undo', () => {
  it('removes only batch records and preserves unrelated edits', () => {
    const initial = workspace();
    const applied = applyPlannerDraft(initial, 'p1', draft([row('new')], [link({ type: 'new', id: 'new' }, { type: 'existing', id: 'parent' })]));
    const edited: Workspace = structuredClone(applied.workspace);
    edited.items.find(entry => entry.id === 'parent')!.title = 'Edited later';
    edited.projects[1].name = 'Unrelated project edit';
    expect(canUndoPlannerBatch(edited, applied.batch)).toBe(true);
    const undone = undoPlannerBatch(edited, applied.batch);
    expect(undone.items.map(entry => entry.id)).toEqual(initial.items.map(entry => entry.id));
    expect(undone.links).toEqual(initial.links);
    expect(undone.items.find(entry => entry.id === 'parent')!.title).toBe('Edited later');
    expect(undone.projects[1].name).toBe('Unrelated project edit');
    expect(undone.views.p1.collapsed).toEqual(['parent']);
  });

  it('invalidates undo when generated content changes or outside records depend on it', () => {
    const applied = applyPlannerDraft(workspace(), 'p1', draft([row('new')]));
    const changedItem = structuredClone(applied.workspace);
    changedItem.items.at(-1)!.notes = 'changed';
    expect(canUndoPlannerBatch(changedItem, applied.batch)).toBe(false);

    const externalChild = structuredClone(applied.workspace);
    externalChild.items.push({ ...item('manual'), parentId: applied.batch.items[0].id });
    expect(canUndoPlannerBatch(externalChild, applied.batch)).toBe(false);

    const externalLink = structuredClone(applied.workspace);
    externalLink.items.push(item('manual'));
    externalLink.links.push({ id: 'manual-link', projectId: 'p1', sourceId: applied.batch.items[0].id, targetId: 'manual' });
    expect(canUndoPlannerBatch(externalLink, applied.batch)).toBe(false);
    expect(() => undoPlannerBatch(externalLink, applied.batch)).toThrow('no longer be undone safely');
  });
});
