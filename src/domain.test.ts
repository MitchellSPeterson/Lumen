import { describe, expect, it } from 'vitest';
import {
  defaultView, emptyWorkspace, importCopies, validateWorkspace, validParent,
  type Project, type WorkItem, type Workspace,
} from './domain';

const project = (id: string): Project => ({ id, name: id, folder: `/tmp/${id}`, createdAt: '' });
const item = (id: string, projectId = 'p1', parentId: string | null = null): WorkItem => ({
  id, projectId, parentId, order: 0, title: id, kind: 'todo', status: 'todo',
  priority: 'normal', tags: ['tag'], notes: '', createdAt: '', updatedAt: '', x: 10, y: 20,
});
const workspace = (): Workspace => ({
  version: 1,
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
