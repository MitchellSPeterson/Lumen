import { describe, expect, it } from 'vitest';
import { arrangeItems } from './mapLayout';
import type { WorkItem } from './domain';

const item = (id: string, parentId: string | null, order = 0): WorkItem => ({
  id, projectId: 'project', parentId, order, title: id, kind: 'todo', status: 'todo',
  priority: 'normal', tags: [], notes: '', createdAt: '', updatedAt: '', x: -1, y: -1,
});

describe('arrangeItems', () => {
  it('places each child to the right of its parent and keeps the root at the origin', () => {
    const arranged = arrangeItems([item('a', null), item('b', 'a'), item('c', null)]);
    const byId = new Map(arranged.map(value => [value.id, value]));
    expect(byId.get('a')!.x).toBeGreaterThan(0);
    expect(byId.get('b')!.x).toBeGreaterThan(byId.get('a')!.x);
    expect(byId.get('c')!.x).toBe(byId.get('a')!.x);
    expect(byId.get('a')!.y).not.toBe(byId.get('c')!.y);
    expect(arranged.map(value => value.title)).toEqual(['a', 'b', 'c']);
  });
});
