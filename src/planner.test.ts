import { describe, expect, it, vi, beforeEach } from 'vitest';
import { applyPlannerDraft, buildPlannerContext, canUndoPlannerBatch, plannerOutputSchema, parsePlannerDraft, undoPlannerBatch } from './planner';
import { usePlanner } from './usePlanner';
import { connectCodex, generatePlan } from './agent';
import { defaultView, type Project, type WorkItem, type Workspace } from './domain';

// Run the real orchestration hook with deterministic state/effect scheduling.
const hooks = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, effects: [] as (() => void)[] }));
vi.mock('react', () => ({
  useState(initial: unknown) {
    const index = hooks.cursor++;
    if (!hooks.slots[index]) hooks.slots[index] = { value: typeof initial === 'function' ? initial() : initial };
    const slot = hooks.slots[index] as { value: unknown };
    return [slot.value, (value: unknown) => { slot.value = value; }];
  },
  useRef(initial: unknown) {
    const index = hooks.cursor++;
    if (!hooks.slots[index]) hooks.slots[index] = { current: initial };
    return hooks.slots[index];
  },
  useEffect(effect: () => void, dependencies: unknown[]) {
    const index = hooks.cursor++;
    const previous = hooks.slots[index] as unknown[] | undefined;
    if (!previous || dependencies.some((value, position) => !Object.is(value, previous[position]))) hooks.effects.push(effect);
    hooks.slots[index] = dependencies;
  },
}));
vi.mock('./agent', () => ({
  connectCodex: vi.fn(), generatePlan: vi.fn(), cancelCodex: vi.fn().mockResolvedValue(undefined), disconnectCodex: vi.fn(),
}));

const project = (id: string): Project => ({ id, name: `Project ${id}`, folder: '', createdAt: '' });
const item = (id: string, projectId = 'p1', parentId: string | null = null): WorkItem => ({
  id, projectId, parentId, order: 0, title: id, kind: 'feature', status: 'todo', priority: 'normal',
  tags: [], notes: '', planningLane: null, details: {}, createdAt: '', updatedAt: '', x: 20, y: 30,
});
const workspace = (): Workspace => ({
  version: 2, projects: [project('p1'), project('p2')],
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
    expect(context.selected).toMatchObject({ id: 'selected', notes: 'Selected notes', details: {}, planningLane: null });
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

const featureDetails = () => ({ feature: { problem: 'Missing search', expectedBehavior: 'Find matching items', acceptanceCriteria: [{ id: 'ac1', text: 'Find items by title', checked: false }], openQuestions: 'How should ranking work?' } });
describe('reviewed planning safety', () => {
  it('parses an editable preview without changing workspace, and persists edited structured details only on apply', () => {
    const current = workspace();
    const before = structuredClone(current);
    const preview = parsePlannerDraft(draft([{ ...row('search'), kind: 'feature', details: featureDetails(), planningLane: 'next' }]));
    preview.items[0].title = 'Edited search';
    preview.items[0].details!.feature!.problem = 'Edited problem';
    expect(current).toEqual(before);
    const applied = applyPlannerDraft(current, 'p1', preview);
    expect(applied.batch.items[0]).toMatchObject({ title: 'Edited search', planningLane: 'next', details: { feature: { problem: 'Edited problem' } } });
    applied.workspace.items.at(-1)!.details.feature!.acceptanceCriteria[0].checked = true;
    expect(applied.batch.items[0].details.feature!.acceptanceCriteria[0].checked).toBe(false);
    expect(canUndoPlannerBatch(applied.workspace, applied.batch)).toBe(false);
  });

  it('applies only selected planning fields and undo preserves later unrelated fields', () => {
    const current = workspace();
    const selected = current.items[0];
    selected.details.bug = { stepsToReproduce: 'A', expectedBehavior: 'B', actualBehavior: 'C' };
    const scope = { selectedId: selected.id, baseline: structuredClone(selected) };
    const proposal = { ...draft(), update: { id: selected.id, notes: 'Clarified idea', details: featureDetails() } };
    const applied = applyPlannerDraft(current, 'p1', proposal, scope);
    expect(current.items[0]).toEqual(scope.baseline);
    expect(applied.workspace.items[0]).toMatchObject({ notes: 'Clarified idea', title: 'parent', details: { ...featureDetails(), bug: selected.details.bug } });
    const later = structuredClone(applied.workspace);
    later.items[0].title = 'Manual title';
    later.items[0].x = 800;
    expect(canUndoPlannerBatch(later, applied.batch)).toBe(true);
    const undone = undoPlannerBatch(later, applied.batch);
    expect(undone.items[0]).toMatchObject({ title: 'Manual title', x: 800, notes: '', details: scope.baseline.details });
  });

  it('rejects stale, cross-project, unselected, and broad patches atomically', () => {
    const current = workspace();
    const baseline = structuredClone(current.items[0]);
    current.items[0].notes = 'Changed during review';
    const before = structuredClone(current);
    const scope = { selectedId: 'parent', baseline };
    for (const update of [
      { id: 'parent', notes: 'Overwrite' },
      { id: 'child', notes: 'Unrelated' },
      { id: 'other', notes: 'Cross-project' },
      { id: 'parent', title: 'Forbidden' },
    ]) {
      expect(() => applyPlannerDraft(current, 'p1', { ...draft([row('new')]), update }, scope)).toThrow();
      expect(current).toEqual(before);
    }
    expect(() => applyPlannerDraft(workspace(), 'p1', { ...draft(), update: { id: 'parent', notes: 'No selection' } })).toThrow('only the selected');
  });

  it('validates references after edits and removals against the latest workspace', () => {
    const current = workspace();
    const proposal = draft([row('a'), row('b', { type: 'new', id: 'a' })]);
    proposal.items.shift();
    expect(() => applyPlannerDraft(current, 'p1', proposal)).toThrow('unknown new parent');
    const missing = { ...current, items: [current.items[2]], links: [], views: { p1: defaultView(), p2: defaultView() } };
    expect(() => applyPlannerDraft(missing, 'p1', draft([row('a', { type: 'existing', id: 'parent' })]))).toThrow('missing or cross-project parent');
  });

  it('keeps unchanged planning fields and refuses undo after edited planning details', () => {
    const current = workspace();
    const applied = applyPlannerDraft(current, 'p1', { ...draft(), update: { id: 'parent', notes: null, details: featureDetails() } }, { selectedId: 'parent', baseline: structuredClone(current.items[0]) });
    expect(applied.workspace.items[0].notes).toBe('');
    const later = structuredClone(applied.workspace);
    later.items[0].details.feature!.openQuestions = 'Manual decision';
    expect(canUndoPlannerBatch(later, applied.batch)).toBe(false);
    expect(() => undoPlannerBatch(later, applied.batch)).toThrow('no longer be undone safely');
  });

  it('rejects excessive or malformed details and criteria', () => {
    for (const details of [
      { feature: { ...featureDetails().feature, problem: 'x'.repeat(8001) } },
      { feature: { ...featureDetails().feature, acceptanceCriteria: [{ id: 'a', text: 'A', checked: false }, { id: 'a', text: 'B', checked: false }] } },
      { feature: { ...featureDetails().feature, unknown: true } },
      { bug: { stepsToReproduce: 'A', expectedBehavior: 'B', actualBehavior: 'C', status: 'done' } },
      { unrelated: 'no' },
    ]) expect(() => parsePlannerDraft(draft([{ ...row('a'), details }]))).toThrow();
  });
});

describe('planner session lifecycle', () => {
  beforeEach(() => {
    hooks.slots = []; hooks.cursor = 0; hooks.effects = [];
    vi.clearAllMocks();
    vi.mocked(connectCodex).mockResolvedValue({ connected: true, models: [{ id: 'm', name: 'Model' }], account: null });
    vi.mocked(generatePlan).mockResolvedValue(draft([row('generated')]));
  });
  function session() {
    let current = workspace();
    const update = vi.fn((change: (value: Workspace) => Workspace) => { current = change(current); });
    const flush = vi.fn().mockResolvedValue(undefined);
    const options = { workspace: current, projectId: 'p1' as string | null, selectedId: 'parent' as string | null, current: () => current, update, flush, saveError: '', onCreated: vi.fn() };
    const render = () => {
      hooks.cursor = 0;
      options.workspace = current;
      const planner = usePlanner(options);
      for (const effect of hooks.effects.splice(0)) effect();
      return planner;
    };
    const ready = async () => {
      let planner = render();
      await planner.connect();
      planner = render();
      planner.setModel('m'); planner.setPrompt('Plan search');
      return render();
    };
    return { render, ready, options, update, flush, current: () => current };
  }

  it('generation creates only preview; edited Apply runs once and save retry cannot regenerate or duplicate', async () => {
    const test = session();
    let planner = await test.ready();
    const initial = structuredClone(test.current());
    await planner.generate();
    planner = test.render();
    expect(planner.preview?.items).toHaveLength(1);
    expect(test.update).not.toHaveBeenCalled();
    expect(test.current()).toEqual(initial);
    planner.setPreview({ ...planner.preview!, items: [{ ...planner.preview!.items[0], title: 'Reviewed title' }] });
    planner = test.render();
    test.flush.mockRejectedValueOnce(new Error('Disk full'));
    await planner.apply();
    planner = test.render();
    expect(test.current().items.at(-1)?.title).toBe('Reviewed title');
    expect(planner.preview).toBeNull();
    expect(planner.error).toContain('Use Retry save');
    await planner.apply();
    await planner.retrySave();
    expect(test.update).toHaveBeenCalledTimes(1);
    expect(generatePlan).toHaveBeenCalledTimes(1);
    expect(test.current().items).toHaveLength(initial.items.length + 1);
  });

  it('discard and project switching clear pending previews without committing', async () => {
    const test = session();
    let planner = await test.ready();
    await planner.generate(); planner = test.render();
    planner.discard(); planner = test.render();
    expect(planner.preview).toBeNull();
    await planner.apply(); expect(test.update).not.toHaveBeenCalled();
    await planner.generate(); planner = test.render();
    expect(planner.preview).not.toBeNull();
    test.options.projectId = 'p2'; test.render(); planner = test.render();
    expect(planner.preview).toBeNull();
    await planner.apply(); expect(test.update).not.toHaveBeenCalled();
  });

  it('cancellation ignores late generation output and leaves workspace unchanged', async () => {
    const test = session();
    let planner = await test.ready();
    let resolve: (value: unknown) => void = () => {};
    vi.mocked(generatePlan).mockImplementationOnce(() => new Promise(value => { resolve = value; }));
    const generation = planner.generate();
    await Promise.resolve(); await Promise.resolve();
    await planner.cancel();
    resolve(draft([row('late')])); await generation;
    planner = test.render();
    expect(planner.preview).toBeNull();
    expect(test.update).not.toHaveBeenCalled();
  });

  it('rejects contextual additions when selected item changes during review and preserves preview for correction', async () => {
    const test = session();
    let planner = await test.ready();
    planner.setAction('tasks'); planner = test.render();
    await planner.generate(); planner = test.render();
    test.current().items[0].notes = 'New decision';
    await planner.apply(); planner = test.render();
    expect(planner.error).toContain('Selected item changed');
    expect(planner.preview).not.toBeNull();
    expect(test.current().items).toHaveLength(3);
    expect(generatePlan).toHaveBeenCalledTimes(1);
  });
  it('keeps contextual instructions inside bounded context and transmits a full 8,000-character prompt', async () => {
    const test = session();
    let planner = await test.ready();
    planner.setAction('requirements'); planner = test.render();
    planner.setPrompt('x'.repeat(8000)); planner = test.render();
    await planner.generate();
    const [, , prompt, context] = vi.mocked(generatePlan).mock.calls[0];
    expect(prompt).toHaveLength(8000);
    expect(context.length).toBeLessThanOrEqual(100000);
    expect(JSON.parse(context)).toMatchObject({ planningAction: 'requirements', selected: { id: 'parent', details: {} } });
  });

  it('rejects changing selection during review even for an additive contextual plan', async () => {
    const test = session();
    let planner = await test.ready();
    planner.setAction('tasks'); planner = test.render();
    await planner.generate(); planner = test.render();
    test.options.selectedId = 'child'; planner = test.render();
    await planner.apply(); planner = test.render();
    expect(planner.error).toContain('Selection changed');
    expect(test.update).not.toHaveBeenCalled();
  });

});
