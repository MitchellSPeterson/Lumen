import { createItem, defaultView, type Workspace } from './domain';
import { arrangeItems } from './mapLayout';

export function demoWorkspace(): Workspace {
  const projectId = crypto.randomUUID();
  const feature = createItem(projectId, 'feature');
  feature.title = 'Plan work before implementation'; feature.planningLane = 'now'; feature.details = { feature: { problem: 'Loose ideas lose context before anyone starts implementation.', expectedBehavior: 'Capture ideas, shape a feature, and break it into actionable tasks.', acceptanceCriteria: [{ id: crypto.randomUUID(), text: 'Capture an idea without choosing its place in the hierarchy', checked: true }, { id: crypto.randomUUID(), text: 'Keep requirements and implementation tasks together', checked: false }], openQuestions: 'Should every idea be promoted into a feature?' } }; feature.status = 'in_progress'; feature.notes = '## A place for the whole picture\n\nKeep ideas, implementation tasks, and bugs connected.\n\n- Plan the feature here\n- Break it into small todos\n- Link bugs back to their context'; feature.tags = ['v1', 'workspace'];
  const capture = createItem(projectId, 'feature', null, 1);
  capture.title = 'Keyboard-first capture'; capture.planningLane = 'next'; capture.tags = ['workflow']; capture.notes = 'Add a thought before it gets lost. Give it structure later.';
  const a = createItem(projectId, 'todo', feature.id); a.title = 'Sketch the project sidebar'; a.status = 'done';
  const b = createItem(projectId, 'todo', feature.id, 1); b.title = 'Connect outline, map, and board views'; b.status = 'in_progress'; b.priority = 'high';
  const c = createItem(projectId, 'todo', feature.id, 2); c.title = 'Save work locally';
  const d = createItem(projectId, 'bug', feature.id, 3); d.title = 'Long titles overflow on small screens'; d.priority = 'high'; d.planningLane = 'now'; d.details = { bug: { stepsToReproduce: 'Create an item with a long title, then narrow the window.', expectedBehavior: 'Title wraps without covering nearby controls.', actualBehavior: 'Title overlaps action buttons.' } }; d.tags = ['interface']; d.notes = '## Steps to reproduce\n\n1. Create an item with a long title.\n2. Make the window narrower.\n\n## Expected\n\nTitle wraps without covering nearby controls.';
  const e = createItem(projectId, 'todo', capture.id); e.title = 'Add keyboard shortcuts';
  const f = createItem(projectId, 'todo', capture.id, 1); f.title = 'Design the empty state';
  const idea = createItem(projectId, 'idea', null, 2); idea.title = 'Try weekly planning reviews'; idea.tags = ['inbox']; idea.notes = 'A rough thought, ready to shape when it matters.';
  const later = createItem(projectId, 'feature', null, 3); later.title = 'Share a read-only planning snapshot'; later.planningLane = 'later';
  return { version: 2, projects: [{ id: projectId, name: 'Planner playground', folder: '', createdAt: new Date().toISOString() }], items: arrangeItems([feature, capture, a, b, c, d, e, f, idea, later]), links: [{ id: crypto.randomUUID(), projectId, sourceId: b.id, targetId: d.id }], views: { [projectId]: defaultView() }, activeProjectId: projectId };
}
