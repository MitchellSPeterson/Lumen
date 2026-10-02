import { useState, type DragEvent } from 'react';
import { Bug, CheckCircle2, ChevronDown, ChevronRight, Circle, CircleDot, GripVertical, Lightbulb, Sparkles } from 'lucide-react';
import { kindLabels, matchingWithAncestors, planningLaneLabels, statusLabels, type ItemKind, type ProjectView, type Status, type WorkItem } from './domain';

export function KindIcon({ kind, size = 15 }: { kind: ItemKind; size?: number }) {
  switch (kind) {
    case 'idea': return <Lightbulb size={size} />;
    case 'feature': return <Sparkles size={size} />;
    case 'bug': return <Bug size={size} />;
    case 'todo': return <CheckCircle2 size={size} />;
  }
}

export function StatusIcon({ status }: { status: Status }) {
  return status === 'done' ? <CheckCircle2 size={15} /> : status === 'in_progress' ? <CircleDot size={15} /> : <Circle size={15} />;
}

interface OutlineProps {
  items: WorkItem[];
  matchingIds: Set<string>;
  filtered: boolean;
  view: ProjectView;
  selectedId: string | null;
  checkedIds: Set<string>;
  onSelect(id: string): void;
  onCheck(id: string, checked: boolean): void;
  onCollapse(id: string): void;
  onMove(id: string, parentId: string | null, beforeId?: string | null): void;
}

export function Outline({ items, matchingIds, filtered, view, selectedId, checkedIds, onSelect, onCheck, onCollapse, onMove }: OutlineProps) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState('');
  const visible = matchingWithAncestors(items, matchingIds);
  function drop(event: DragEvent, parentId: string | null, beforeId?: string | null) {
    event.preventDefault(); event.stopPropagation();
    const id = event.dataTransfer.getData('text/plain');
    if (items.some(item => item.id === id)) onMove(id, parentId, beforeId);
    setDragging(null); setDropTarget('');
  }
  function target(event: DragEvent, id: string) {
    if (!dragging) return;
    event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'move'; setDropTarget(id);
  }
  function branch(parentId: string | null, depth: number) {
    return items.filter(item => item.parentId === parentId && visible.has(item.id)).map(item => {
      const children = items.some(child => child.parentId === item.id && visible.has(child.id));
      const collapsed = !filtered && view.collapsed.includes(item.id);
      return <div key={item.id}>
        <div className={`outline-drop-before ${dropTarget === `before:${item.id}` ? 'is-target' : ''}`} onDragOver={event => target(event, `before:${item.id}`)} onDrop={event => drop(event, item.parentId, item.id)}>{dropTarget === `before:${item.id}` && <span>Move before {item.title}</span>}</div>
        <div className={`outline-row ${selectedId === item.id ? 'selected' : ''} ${!matchingIds.has(item.id) ? 'is-context' : ''} ${dropTarget === item.id ? 'is-drop-target' : ''}`}
          style={{ paddingLeft: 10 + depth * 18 }} draggable
          onDragStart={event => { event.dataTransfer.setData('text/plain', item.id); event.dataTransfer.effectAllowed = 'move'; setDragging(item.id); }}
          onDragEnd={() => { setDragging(null); setDropTarget(''); }}
          onDragOver={event => target(event, item.id)} onDrop={event => drop(event, item.id)}>
          <GripVertical size={13} className="drag-grip" aria-hidden="true" />
          <input type="checkbox" aria-label={`Select ${item.title} for grouping`} checked={checkedIds.has(item.id)} onChange={event => onCheck(item.id, event.target.checked)} />
          <button className={`tree-disclosure ${children ? '' : 'invisible'}`} aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${item.title}`} aria-expanded={!collapsed} tabIndex={children ? 0 : -1} disabled={filtered} onClick={() => onCollapse(item.id)}>{collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}</button>
          <button className="outline-title" onClick={() => onSelect(item.id)}><span className={`kind-icon ${item.kind}`}><KindIcon kind={item.kind} /></span><span className={item.status === 'done' ? 'completed' : ''}>{item.title}</span></button>
          <span className={`status-label ${item.status}`}><StatusIcon status={item.status} />{statusLabels[item.status]}</span>
          <span className={`planning-label ${item.planningLane ?? ''}`}>{item.planningLane ? planningLaneLabels[item.planningLane] : 'Unplanned'}</span>
          {dropTarget === item.id && <span className="nest-hint">Move inside</span>}
        </div>
        {children && !collapsed && branch(item.id, depth + 1)}
      </div>;
    });
  }
  return <div className="outline-surface" aria-label="Project outline">
    <div className={`outline-root-drop ${dropTarget === 'root' ? 'is-drop-target' : ''}`} onDragOver={event => target(event, 'root')} onDrop={event => drop(event, null)}>{dragging ? 'Drop here to move to project level' : 'Select siblings to group. Drag a row to organize.'}</div>
    <div className="outline-columns"><span>Item</span><span>Status</span><span>Plan</span></div>
    {branch(null, 0)}
  </div>;
}

interface BoardProps {
  items: WorkItem[];
  matchingIds: Set<string>;
  selectedId: string | null;
  onSelect(id: string): void;
  onStatus(id: string, status: Status): void;
}

const statuses: Status[] = ['todo', 'in_progress', 'done'];
export function Board({ items, matchingIds, selectedId, onSelect, onStatus }: BoardProps) {
  const [dropStatus, setDropStatus] = useState<Status | null>(null);
  const visible = items.filter(item => item.kind !== 'idea' && matchingIds.has(item.id));
  return <div className="status-board" aria-label="Status board">{statuses.map(status => {
    const cards = visible.filter(item => item.status === status);
    return <section key={status} className={`board-column ${dropStatus === status ? 'is-drop-target' : ''}`} aria-label={statusLabels[status]}
      onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropStatus(status); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget instanceof Node ? event.relatedTarget : null)) setDropStatus(null); }}
      onDrop={event => { event.preventDefault(); const id = event.dataTransfer.getData('text/plain'); if (visible.some(item => item.id === id)) onStatus(id, status); setDropStatus(null); }}>
      <h2><StatusIcon status={status} />{statusLabels[status]}<span>{cards.length}</span></h2>
      {cards.map(item => <article key={item.id} className={`board-card ${selectedId === item.id ? 'selected' : ''}`} draggable onDragStart={event => { event.dataTransfer.setData('text/plain', item.id); event.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => setDropStatus(null)}>
        <button className="board-card-title" onClick={() => onSelect(item.id)}><span className={`kind-icon ${item.kind}`}><KindIcon kind={item.kind} /></span><span>{item.title}</span></button>
        <p>{item.parentId ? items.find(parent => parent.id === item.parentId)?.title : kindLabels[item.kind]}</p>
        <div className="board-card-bottom"><span className={`planning-label ${item.planningLane ?? ''}`}>{item.planningLane ? planningLaneLabels[item.planningLane] : 'Unplanned'}</span><select aria-label={`Status of ${item.title}`} value={item.status} onChange={event => { const value = statuses.find(candidate => candidate === event.target.value); if (value) onStatus(item.id, value); }}>{statuses.map(value => <option key={value} value={value}>{statusLabels[value]}</option>)}</select></div>
      </article>)}
      {!cards.length && <p className="board-empty">No items here</p>}
    </section>;
  })}</div>;
}
