import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyNodeChanges, Background, BackgroundVariant, Controls, Handle, MiniMap,
  Position, ReactFlow, type Connection, type Edge, type Node, type NodeChange,
  type NodeProps, type Viewport,
} from '@xyflow/react';
import { Bug, CheckCircle2, ChevronDown, ChevronRight, Circle, CircleDashed, FolderKanban, ListTodo, Plus, Sparkles } from 'lucide-react';
import '@xyflow/react/dist/style.css';
import type { Project, ProjectView, RelatedLink, WorkItem } from './domain';

export interface MindMapProps {
  project: Project;
  items: WorkItem[];
  links: RelatedLink[];
  view: ProjectView;
  selectedId: string | null;
  matchingIds: Set<string>;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onAdd: (parentId: string | null) => void;
  onMove: (id: string, x: number, y: number) => void;
  onLink: (sourceId: string, targetId: string) => void;
  onCollapse: (id: string) => void;
  onViewport: (viewport: { x: number; y: number; zoom: number }) => void;
}

type MapData = Record<string, unknown> & {
  item?: WorkItem;
  project?: Project;
  selected: boolean;
  dimmed: boolean;
  collapsed: boolean;
  childCount: number;
  visibleCount: number;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onAdd: (parentId: string | null) => void;
  onCollapse: (id: string) => void;
};
type MapNode = Node<MapData, 'item' | 'root'>;

const kindIcons = { todo: ListTodo, feature: Sparkles, bug: Bug };
const statusIcons = { todo: Circle, in_progress: CircleDashed, done: CheckCircle2 };
const rootId = (projectId: string) => `root:${projectId}`;

function ItemNode({ data }: NodeProps<MapNode>) {
  const item = data.item!;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.title);
  const cancelled = useRef(false);
  const KindIcon = kindIcons[item.kind];
  const StatusIcon = statusIcons[item.status];
  return (
    <div
      className={`mindmap-card mindmap-card--${item.kind}${data.selected ? ' is-selected' : ''}${data.dimmed ? ' is-dimmed' : ''}`}
      style={{ width: 224, height: 86, boxSizing: 'border-box' }}
      role="button"
      tabIndex={0}
      aria-label={`${item.title}, ${item.kind}, ${item.status.replace('_', ' ')}`}
      onKeyDown={event => {
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          data.onSelect(item.id);
        }
      }}
    >
      <Handle type="target" position={Position.Left} className="mindmap-handle" />
      <div className="mindmap-card__top">
        <span className="mindmap-card__kind"><KindIcon size={15} aria-hidden="true" />{item.kind}</span>
        <StatusIcon size={15} className={`mindmap-card__status mindmap-card__status--${item.status}`} aria-label={item.status.replace('_', ' ')} />
      </div>
      {editing ? <input className="mindmap-rename nodrag nowheel" aria-label={`Rename ${item.title}`} autoFocus value={draft} onChange={e => setDraft(e.target.value)} onBlur={() => { if (!cancelled.current && draft.trim()) data.onRename(item.id, draft.trim()); setEditing(false); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } if (e.key === 'Escape') { e.stopPropagation(); cancelled.current = true; setEditing(false); } }} /> : <div className="mindmap-card__title" title={item.title} onDoubleClick={e => { e.stopPropagation(); cancelled.current = false; setDraft(item.title); setEditing(true); }}>{item.title}</div>}
      <div className="mindmap-card__actions">
        {data.childCount > 0 && (
          <button type="button" className="mindmap-card__action nodrag" aria-label={`${data.collapsed ? 'Expand' : 'Collapse'} children of ${item.title}`} onClick={event => { event.stopPropagation(); data.onCollapse(item.id); }}>
            {data.collapsed ? <ChevronRight size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
            <span>{data.childCount}</span>
          </button>
        )}
        <button type="button" className="mindmap-card__action mindmap-card__add nodrag" aria-label={`Add child to ${item.title}`} onClick={event => { event.stopPropagation(); data.onAdd(item.id); }}><Plus size={15} aria-hidden="true" /></button>
      </div>
      <Handle type="source" position={Position.Right} className="mindmap-handle" />
    </div>
  );
}

function RootNode({ data }: NodeProps<MapNode>) {
  const project = data.project!;
  return (
    <div
      className={`mindmap-root${data.selected ? ' is-selected' : ''}`}
      style={{ width: 224, height: 86, boxSizing: 'border-box' }}
      role="button"
      tabIndex={0}
      aria-label={`Project ${project.name}`}
      onKeyDown={event => {
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          data.onSelect(rootId(project.id));
        }
      }}
    >
      <div className="mindmap-root__icon"><FolderKanban size={20} aria-hidden="true" /></div>
      <div className="mindmap-root__body">
        <span className="mindmap-root__eyebrow">PROJECT ROOT</span>
        <strong className="mindmap-root__title" title={project.name}>{project.name}</strong>
        <span className="mindmap-root__count">{data.visibleCount === 0 ? 'No matching items' : `${data.visibleCount} visible item${data.visibleCount === 1 ? '' : 's'}`}</span>
      </div>
      <button type="button" className="mindmap-root__add nodrag" aria-label={`Add item to ${project.name}`} onClick={event => { event.stopPropagation(); data.onAdd(null); }}><Plus size={18} aria-hidden="true" /></button>
      <Handle type="source" position={Position.Right} isConnectable={false} className="mindmap-handle" />
    </div>
  );
}

const nodeTypes = { item: ItemNode, root: RootNode };

function visibleIds(items: WorkItem[], matchingIds: Set<string>, collapsed: Set<string>): Set<string> {
  const byId = new Map(items.map(item => [item.id, item]));
  const included = new Set<string>();
  for (const id of matchingIds) {
    let current = byId.get(id);
    const visited = new Set<string>();
    while (current && !visited.has(current.id)) {
      included.add(current.id);
      visited.add(current.id);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
  }
  return new Set([...included].filter(id => {
    let current = byId.get(id);
    const visited = new Set<string>();
    while (current?.parentId && !visited.has(current.id)) {
      if (collapsed.has(current.parentId)) return false;
      visited.add(current.id);
      current = byId.get(current.parentId);
    }
    return true;
  }));
}

function makeNodes(props: MindMapProps): MapNode[] {
  const { project, items, view, selectedId, matchingIds, onSelect, onRename, onAdd, onCollapse } = props;
  const shown = visibleIds(items, matchingIds, new Set(view.collapsed));
  const counts = new Map<string, number>();
  for (const item of items) if (item.parentId) counts.set(item.parentId, (counts.get(item.parentId) ?? 0) + 1);
  const root: MapNode = {
    id: rootId(project.id), type: 'root', position: { x: 0, y: 0 },
    sourcePosition: Position.Right, draggable: false,
    data: { project, selected: selectedId === rootId(project.id), dimmed: false, collapsed: false, childCount: 0, visibleCount: shown.size, onSelect, onRename, onAdd, onCollapse },
  };
  return [root, ...items.filter(item => shown.has(item.id)).map(item => ({
    id: item.id, type: 'item' as const, position: { x: item.x, y: item.y },
    sourcePosition: Position.Right, targetPosition: Position.Left,
    data: { item, selected: item.id === selectedId, dimmed: !matchingIds.has(item.id), collapsed: view.collapsed.includes(item.id), childCount: counts.get(item.id) ?? 0, visibleCount: 0, onSelect, onRename, onAdd, onCollapse },
  }))];
}

function makeEdges(project: Project, items: WorkItem[], links: RelatedLink[], nodes: MapNode[]): Edge[] {
  const visible = new Set(nodes.map(node => node.id));
  const ids = new Set(items.map(item => item.id));
  const hierarchy: Edge[] = items.filter(item => visible.has(item.id)).map(item => ({
    id: `hierarchy:${item.id}`,
    source: item.parentId && ids.has(item.parentId) && visible.has(item.parentId) ? item.parentId : rootId(project.id),
    target: item.id,
    type: 'default',
    className: 'mindmap-edge--hierarchy',
    style: { stroke: 'var(--map-hierarchy, #8f948e)', strokeWidth: 1.5 },
  }));
  const related: Edge[] = links.filter(link => visible.has(link.sourceId) && visible.has(link.targetId)).map(link => ({
    id: `related:${link.id}`, source: link.sourceId, target: link.targetId,
    type: 'default', className: 'mindmap-edge--related',
    style: { stroke: 'var(--map-related, #bc735b)', strokeWidth: 1.6, strokeDasharray: '5 5' },
  }));
  return [...hierarchy, ...related];
}

function MindMapCanvas(props: MindMapProps) {
  const { project, items, links, view, onSelect, onMove, onLink, onViewport } = props;
  const computedNodes = useMemo(() => makeNodes(props), [props]);
  const [nodes, setNodes] = useState<MapNode[]>(computedNodes);
  const draggingId = useRef<string | null>(null);
  const savedViewport = useRef<Viewport>(view.viewport);

  useEffect(() => {
    setNodes(previous => computedNodes.map(node => {
      const dragging = draggingId.current === node.id ? previous.find(old => old.id === node.id) : undefined;
      return dragging ? { ...node, position: dragging.position } : node;
    }));
  }, [computedNodes]);

  const onNodesChange = useCallback((changes: NodeChange<MapNode>[]) => {
    setNodes(previous => applyNodeChanges(changes, previous));
  }, []);

  const edges = useMemo(() => makeEdges(project, items, links, nodes), [project, items, links, nodes]);
  const ids = useMemo(() => new Set(items.map(item => item.id)), [items]);
  const onConnect = useCallback((connection: Connection) => {
    const { source, target } = connection;
    if (!source || !target || source === target || !ids.has(source) || !ids.has(target)) return;
    if (links.some(link => (link.sourceId === source && link.targetId === target) || (link.sourceId === target && link.targetId === source))) return;
    onLink(source, target);
  }, [ids, links, onLink]);

  const onMoveEnd = useCallback((_: MouseEvent | TouchEvent | null, viewport: Viewport) => {
    const saved = savedViewport.current;
    if (Math.abs(saved.x - viewport.x) < 0.01 && Math.abs(saved.y - viewport.y) < 0.01 && Math.abs(saved.zoom - viewport.zoom) < 0.001) return;
    savedViewport.current = viewport;
    onViewport(viewport);
  }, [onViewport]);

  return (
    <div className="mindmap" style={{ width: '100%', height: '100%', minHeight: 0 }}>
      <ReactFlow<MapNode, Edge>
        key={project.id}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeClick={(_, node) => onSelect(node.id)}
        onNodeDragStart={(_, node) => { draggingId.current = node.id; }}
        onNodeDragStop={(_, node) => { draggingId.current = null; onMove(node.id, Math.round(node.position.x), Math.round(node.position.y)); }}
        onConnect={onConnect}
        isValidConnection={connection => !!connection.source && !!connection.target && connection.source !== connection.target && ids.has(connection.source) && ids.has(connection.target)}
        onMoveEnd={onMoveEnd}
        defaultViewport={view.viewport}
        fitView={view.viewport.x === 40 && view.viewport.y === 40 && view.viewport.zoom === 0.85}
        fitViewOptions={{ padding: 0.16, minZoom: 0.3, maxZoom: 1 }}
        minZoom={0.3}
        maxZoom={2}
        nodesFocusable
        edgesFocusable={false}
        deleteKeyCode={null}
        aria-label={`${project.name} mind map`}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="var(--map-grid, #d7d8d1)" />
        <MiniMap style={{ width: 120, height: 80 }} pannable zoomable nodeColor={node => node.type === 'root' ? '#273e36' : '#d6cbbb'} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

export default function MindMap(props: MindMapProps) {
  return <MindMapCanvas key={props.project.id} {...props} />;
}
