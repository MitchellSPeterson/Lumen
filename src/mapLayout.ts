import dagre from '@dagrejs/dagre';
import type { WorkItem } from './domain';

const ROOT = '\0project-root';
const WIDTH = 224;
const HEIGHT = 86;

export function arrangeItems(items: WorkItem[]): WorkItem[] {
  if (!items.length) return [];

  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: 'LR', ranksep: 104, nodesep: 32, marginx: 0, marginy: 0 });
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setNode(ROOT, { width: WIDTH, height: HEIGHT });

  const ids = new Set(items.map(item => item.id));
  for (const item of [...items].sort((a, b) => a.order - b.order)) {
    graph.setNode(item.id, { width: WIDTH, height: HEIGHT });
  }
  for (const item of items) {
    graph.setEdge(item.parentId && ids.has(item.parentId) ? item.parentId : ROOT, item.id);
  }

  dagre.layout(graph);
  const origin = graph.node(ROOT);
  return items.map(item => {
    const node = graph.node(item.id);
    return { ...item, x: Math.round(node.x - origin.x), y: Math.round(node.y - origin.y) };
  });
}
