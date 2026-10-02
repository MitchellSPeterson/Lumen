import { describe, expect, it } from 'vitest';
import {
  captureIdea, defaultView, emptyWorkspace, groupItems, importCopies, itemSearchText, matchingWithAncestors, moveItem, normalizeWorkspace, reorderItem, validateWorkspace, validParent,
  type Project, type WorkItem, type Workspace,
} from './domain';

const project = (id: string): Project => ({ id, name: id, folder: `/tmp/${id}`, createdAt: '' });
const item = (id: string, projectId = 'p1', parentId: string | null = null): WorkItem => ({
  id, projectId, parentId, order: 0, title: id, kind: 'todo', status: 'todo',
  priority: 'normal', tags: ['tag'], notes: '', planningLane: null, details: {}, createdAt: '', updatedAt: '', x: 10, y: 20,
});
const workspace = (): Workspace => ({
  version: 2,
  projects: [project('p1'), project('p2')],
  items: [item('a'), item('b', 'p1', 'a'), item('c', 'p2')],
  links: [{ id: 'link', projectId: 'p1', sourceId: 'a', targetId: 'b' }],
  views: { p1: { ...defaultView(), collapsed: ['a'] }, p2: defaultView() },
  activeProjectId: 'p1',
});

const rejects = (change: (value: Workspace) => void, message: string) => {
  const value = workspace();
  change(value);
  expect(() => validateWorkspace(value)).toThrow(message);
};

describe('validateWorkspace', () => {
  it('accepts an empty backup and a valid hierarchy within one project', () => {
    expect(() => validateWorkspace(emptyWorkspace())).not.toThrow();
    expect(() => validateWorkspace(workspace())).not.toThrow();
    const value = workspace();
    expect(validParent(value.items, value.items[1], 'a')).toBe(true);
    expect(validParent(value.items, value.items[0], 'c')).toBe(false);
  });

  it('rejects missing, cross-project, self, and cyclic parents', () => {
    for (const parentId of ['missing', 'c', 'b']) {
      rejects(value => { value.items[0].parentId = parentId; }, 'invalid hierarchy');
    }
    rejects(value => { value.items[1].parentId = 'b'; }, 'invalid hierarchy');
  });

  it('rejects duplicate IDs and missing project references', () => {
    rejects(value => { value.projects[1].id = 'p1'; }, 'invalid project');
    rejects(value => { value.items[1].id = 'a'; }, 'invalid item');
    rejects(value => { value.items[1].projectId = 'missing'; }, 'invalid item');
    rejects(value => { value.activeProjectId = 'missing'; }, 'missing project');
  });

  it('rejects missing, self, cross-project, and duplicate related links', () => {
    rejects(value => { value.links[0].sourceId = 'missing'; }, 'invalid related link');
    rejects(value => { value.links[0].targetId = 'a'; }, 'invalid related link');
    rejects(value => { value.links[0].targetId = 'c'; }, 'invalid related link');
    rejects(value => {
      value.items.push(item('d'));
      value.links.push({ id: 'link', projectId: 'p1', sourceId: 'a', targetId: 'd' });
    }, 'invalid related link');
    rejects(value => { value.links.push({ ...value.links[0], id: 'other', sourceId: 'b', targetId: 'a' }); }, 'invalid related link');
  });

  it.each([
    ['kind', 'task'], ['status', 'blocked'], ['priority', 'urgent'],
    ['x', Number.NaN], ['y', Number.POSITIVE_INFINITY], ['order', Number.NEGATIVE_INFINITY],
  ])('rejects invalid item %s', (field, invalid) => {
    rejects(value => { Object.assign(value.items[0], { [field]: invalid }); }, 'invalid item');
  });

  it('rejects views that refer to items in another project', () => {
    rejects(value => { value.views.p1.collapsed = ['c']; }, 'invalid map view');
  });

  it('validates a 500-item hierarchy', () => {
    const value = emptyWorkspace();
    value.projects.push(project('p1'));
    value.items = Array.from({ length: 500 }, (_, index) =>
      item(`item-${index}`, 'p1', index ? `item-${index - 1}` : null));
    expect(() => validateWorkspace(value)).not.toThrow();
    value.items[0].parentId = 'item-499';
    expect(() => validateWorkspace(value)).toThrow('invalid hierarchy');
  });
});

describe('importCopies', () => {
  it('remaps projects, hierarchy, links, and views without changing inputs', () => {
    const current = workspace();
    const incoming = workspace(); // IDs deliberately collide with current workspace IDs.
    const currentBefore = structuredClone(current);
    const incomingBefore = structuredClone(incoming);

    const result = importCopies(current, incoming);
    expect(current).toEqual(currentBefore);
    expect(incoming).toEqual(incomingBefore);
    expect(result.projects.slice(0, 2)).toEqual(current.projects);
    expect(result.items.slice(0, 3)).toEqual(current.items);
    expect(result.links.slice(0, 1)).toEqual(current.links);
    expect(result.views.p1).toEqual(current.views.p1);
    expect(result.activeProjectId).not.toBe(current.activeProjectId);

    const importedProjects = result.projects.slice(2);
    const importedItems = result.items.slice(3);
    const importedLink = result.links[1];
    const importedA = importedItems.find(value => value.title === 'a')!;
    const importedB = importedItems.find(value => value.title === 'b')!;
    const importedC = importedItems.find(value => value.title === 'c')!;
    expect(importedProjects.map(value => value.name)).toEqual(['p1 (imported)', 'p2 (imported)']);
    expect(importedProjects.map(value => value.id)).not.toContain('p1');
    expect(importedProjects.map(value => value.id)).not.toContain('p2');
    expect(new Set(importedItems.map(value => value.id)).size).toBe(3);
    expect(importedItems.map(value => value.id)).not.toContain('a');
    expect(importedA.projectId).toBe(importedProjects[0].id);
    expect(importedB.parentId).toBe(importedA.id);
    expect(importedC.projectId).toBe(importedProjects[1].id);
    expect(importedLink).toMatchObject({
      projectId: importedProjects[0].id, sourceId: importedA.id, targetId: importedB.id,
    });
    expect(importedLink.id).not.toBe('link');
    expect(result.views[importedProjects[0].id].collapsed).toEqual([importedA.id]);
    expect(result.views[importedProjects[0].id].viewport).toEqual(incoming.views.p1.viewport);
    expect(result.activeProjectId).toBe(importedProjects[0].id);
    expect(() => validateWorkspace(result)).not.toThrow();
  });

  it('accepts an empty backup without changing the active project', () => {
    const current = workspace();
    const result = importCopies(current, emptyWorkspace());
    expect(result).toEqual(current);
    expect(result).not.toBe(current);
  });
});

describe('planning workflows', () => {
  it('migrates v1 backups without mutating or losing existing content', () => {
    const value = workspace();
    value.items[0].notes = 'Keep this note';
    value.items[0].details = { feature: { problem: 'Context', expectedBehavior: 'Saved', acceptanceCriteria: [{ id: 'a', text: 'Round trip', checked: false }], openQuestions: '' } };
    const legacy = JSON.parse(JSON.stringify(value));
    legacy.version = 1;
    legacy.views.p1.mode = 'list';
    legacy.views.p2.mode = 'map';
    delete legacy.items[1].planningLane;
    delete legacy.items[1].details;
    const before = structuredClone(legacy);
    const result = normalizeWorkspace(legacy);
    expect(legacy).toEqual(before);
    expect(result.version).toBe(2);
    expect(result.views.p1.mode).toBe('outline');
    expect(result.views.p2.mode).toBe('map');
    expect(result.items[0].details).toEqual(value.items[0].details);
    expect(result.items[0].notes).toBe('Keep this note');
    expect(result.items[1]).toMatchObject({ planningLane: null, details: {} });
    expect(result.links).toEqual(value.links);
    expect(() => normalizeWorkspace({ ...value, version: 3 })).toThrow('Unsupported');
  });

  it('rejects malformed structured details and lanes', () => {
    const feature = { problem: '', expectedBehavior: '', acceptanceCriteria: [{ id: 'a', text: '', checked: false }], openQuestions: '' };
    for (const details of [null, [], { feature: null }, { feature: { ...feature, problem: 2 } }, { feature: { ...feature, acceptanceCriteria: [{ id: 'a', text: '', checked: 'yes' }] } }, { feature: { ...feature, acceptanceCriteria: [{ id: 'a', text: '', checked: false }, { id: 'a', text: '', checked: false }] } }, { feature: { ...feature, acceptanceCriteria: [{ id: '', text: '', checked: false }] } }, { bug: { stepsToReproduce: '', expectedBehavior: '', actualBehavior: false } }]) {
      const value = workspace();
      Object.assign(value.items[0], { details });
      expect(() => normalizeWorkspace(value)).toThrow('invalid item');
    }
    rejects(value => { Object.assign(value.items[0], { planningLane: 'urgent' }); }, 'invalid item');
  });

  it('captures trimmed inbox ideas without changing input', () => {
    const value = workspace(), before = structuredClone(value);
    const result = captureIdea(value, 'p1', '  Improve navigation  ');
    expect(value).toEqual(before);
    expect(result.workspace.items.find(item => item.id === result.itemId)).toMatchObject({ title: 'Improve navigation', kind: 'idea', parentId: null, planningLane: null, details: {} });
    expect(() => captureIdea(value, 'missing', 'Title')).toThrow('Project');
    expect(() => captureIdea(value, 'p1', ' ')).toThrow('empty');
  });

  it('moves and reorders branches without breaking links or unrelated projects', () => {
    const value = workspace();
    value.items.push({ ...item('d'), order: 1 }, { ...item('e'), order: 2 });
    const before = structuredClone(value);
    const moved = moveItem(value, 'a', null, 'e');
    expect(value).toEqual(before);
    expect(moved.items.filter(item => item.projectId === 'p1' && item.parentId === null).sort((a, b) => a.order - b.order).map(item => item.id)).toEqual(['d', 'a', 'e']);
    expect(moved.items.find(item => item.id === 'b')!.parentId).toBe('a');
    expect(moved.links).toEqual(value.links);
    const reordered = reorderItem(moved, 'a', 1);
    expect(reordered.items.find(item => item.id === 'a')!.order).toBe(2);
    expect(reorderItem(reordered, 'a', 1)).toBe(reordered);
    const nested = moveItem(value, 'd', 'a');
    expect(nested.items.find(item => item.id === 'd')).toMatchObject({ parentId: 'a', order: 1 });
    for (const parent of ['b', 'c', 'missing', 'a']) expect(() => moveItem(value, 'a', parent)).toThrow('parent');
    expect(() => moveItem(value, 'a', null, 'b')).toThrow('sibling');
  });

  it('groups siblings at their earliest position and preserves descendants and links', () => {
    const value = workspace();
    value.items.push({ ...item('d'), order: 1 }, { ...item('e'), order: 2 });
    const before = structuredClone(value);
    const { workspace: result, featureId } = groupItems(value, ['e', 'a'], 'Combined feature');
    expect(value).toEqual(before);
    expect(result.items.find(item => item.id === featureId)).toMatchObject({ title: 'Combined feature', kind: 'feature', parentId: null, order: 0 });
    expect(result.items.find(item => item.id === 'a')).toMatchObject({ parentId: featureId, order: 0 });
    expect(result.items.find(item => item.id === 'e')).toMatchObject({ parentId: featureId, order: 1 });
    expect(result.items.find(item => item.id === 'd')!.order).toBe(1);
    expect(result.items.find(item => item.id === 'b')!.parentId).toBe('a');
    expect(result.links).toEqual(value.links);
    expect(() => validateWorkspace(result)).not.toThrow();
    for (const ids of [[], ['missing'], ['a', 'b'], ['a', 'c']]) expect(() => groupItems(value, ids, 'Group')).toThrow();
  });

  it('searches all detail fields and includes ancestors independently of status and lane', () => {
    const value = workspace();
    value.items[0].status = 'done'; value.items[0].planningLane = 'later';
    value.items[1].planningLane = 'now';
    value.items[1].details = { feature: { problem: 'Discoverability', expectedBehavior: 'Sidebar', acceptanceCriteria: [{ id: 'a', text: 'Keyboard capture', checked: true }], openQuestions: 'Shortcuts?' }, bug: { stepsToReproduce: 'Resize', expectedBehavior: 'Wrap', actualBehavior: 'Overflow' } };
    expect(itemSearchText(value.items[1])).toContain('keyboard capture');
    expect(itemSearchText(value.items[1])).toContain('discoverability sidebar');
    expect(itemSearchText(value.items[1])).toContain('resize wrap overflow');
    expect(matchingWithAncestors(value.items, new Set(['b']))).toEqual(new Set(['b', 'a']));
    expect(matchingWithAncestors(value.items, new Set(['missing']))).toEqual(new Set());
  });
});
