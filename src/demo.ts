import { createItem, defaultView, type Workspace } from './domain';
import { arrangeItems } from './mapLayout';

export function demoWorkspace(): Workspace {
  const projectId = crypto.randomUUID();
  const feature = createItem(projectId, 'feature');
  feature.title = 'Build a better workspace'; feature.status = 'in_progress'; feature.notes = '## A place for the whole picture\n\nKeep ideas, implementation tasks, and bugs connected.\n\n- Plan the feature here\n- Break it into small todos\n- Link bugs back to their context'; feature.tags = ['v1', 'workspace'];
  const capture = createItem(projectId, 'feature', null, 1);
  capture.title = 'Quick capture'; capture.tags = ['workflow']; capture.notes = 'Add a thought before it gets lost. Give it structure later.';
  const a = createItem(projectId, 'todo', feature.id); a.title = 'Sketch the project sidebar'; a.status = 'done';
  const b = createItem(projectId, 'todo', feature.id, 1); b.title = 'Connect map and list views'; b.status = 'in_progress'; b.priority = 'high';
  const c = createItem(projectId, 'todo', feature.id, 2); c.title = 'Save work locally';
  const d = createItem(projectId, 'bug', feature.id, 3); d.title = 'Long titles overflow on small screens'; d.priority = 'high'; d.tags = ['interface']; d.notes = '## Steps to reproduce\n\n1. Create an item with a long title.\n2. Make the window narrower.\n\n## Expected\n\nTitle wraps without covering nearby controls.';
  const e = createItem(projectId, 'todo', capture.id); e.title = 'Add keyboard shortcuts';
  const f = createItem(projectId, 'todo', capture.id, 1); f.title = 'Design the empty state';
  return { version: 1, projects: [{ id: projectId, name: 'Planner playground', folder: '', createdAt: new Date().toISOString() }], items: arrangeItems([feature, capture, a, b, c, d, e, f]), links: [{ id: crypto.randomUUID(), projectId, sourceId: b.id, targetId: d.id }], views: { [projectId]: defaultView() }, activeProjectId: projectId };
}
