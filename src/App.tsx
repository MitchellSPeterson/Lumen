import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, ArrowUpRight, Bug, Check, CheckCircle2, ChevronDown, ChevronRight, Circle, CircleDot, Folder, FolderOpen, GitBranch, LayoutList, Link2, Loader2, Map as MapIcon, PanelLeftClose, PanelLeftOpen, PanelRightClose, Plus, Search, Settings2, Sparkles, Trash2, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { createItem, defaultView, descendants, importCopies, kindLabels, statusLabels, type ItemKind, type Priority, type Project, type ProjectView, type Status, type WorkItem } from './domain';
import { chooseFolder, exportWorkspace, importWorkspace, inspectFolder, native } from './persistence';
import { useWorkspace } from './useWorkspace';
import { demoWorkspace } from './demo';
import MindMap from './MindMap';
import { arrangeItems } from './mapLayout';
import { applyAppearance, readAppearance, saveAppearance, type Appearance } from './appearance';
import { PlannerComposer } from './PlannerComposer';
import { usePlanner } from './usePlanner';
import { SettingsPanel } from './SettingsPanel';

const kinds: ItemKind[] = ['todo', 'feature', 'bug'];
const KindIcon = ({ kind, size = 15 }: { kind: ItemKind; size?: number }) => kind === 'bug' ? <Bug size={size} /> : kind === 'feature' ? <Sparkles size={size} /> : <CheckCircle2 size={size} />;
const StatusIcon = ({ status }: { status: Status }) => status === 'done' ? <CheckCircle2 size={15} /> : status === 'in_progress' ? <CircleDot size={15} /> : <Circle size={15} />;
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);

function Dialog({ title, children, close }: { title: string; children: ReactNode; close: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    (ref.current?.querySelector<HTMLElement>('input:not(:disabled), textarea:not(:disabled), select:not(:disabled)') ?? ref.current?.querySelector<HTMLElement>('button'))?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.isComposing || event.keyCode === 229) return;
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); }
      if (event.key === 'Tab') {
        const nodes = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, a[href], [tabindex="0"]') ?? []).filter(node => node.getClientRects().length > 0);
        const first = nodes[0], last = nodes.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); if (previous?.isConnected) previous.focus(); else document.querySelector<HTMLElement>('.new-item-wrap button, .welcome .primary-button, .sidebar-search')?.focus(); };
  }, []);
  return <div className="dialog-shade" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}><div ref={ref} className="dialog" role="dialog" aria-modal="true" aria-label={title}><div className="dialog-heading"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={close}><X size={18} /></button></div>{children}</div></div>;
}

function TagsEditor({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [text, setText] = useState(tags.join(', '));
  useEffect(() => setText(tags.join(', ')), [tags.join(',')]);
  return <input aria-label="Tags" value={text} placeholder="e.g. interface, v1" onChange={e => setText(e.target.value)} onBlur={() => onChange([...new Set(text.split(',').map(t => t.trim()).filter(Boolean))])} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />;
}

function TitleEditor({ title, onChange }: { title: string; onChange: (title: string) => void }) {
  const [text, setText] = useState(title);
  useEffect(() => setText(title), [title]);
  return <><textarea className="item-title-input" aria-label="Item title" aria-invalid={!text.trim()} aria-describedby={!text.trim() ? 'title-required' : undefined} value={text} rows={2} onChange={e => { const value = e.target.value.replace(/\n/g, ' '); setText(value); if (value.trim()) onChange(value); }} onBlur={() => { if (!text.trim()) setText(title); }} />{!text.trim() && <p id="title-required" className="field-error">Title required. Previous title stays saved.</p>}</>;
}

export default function App() {
  const { workspace, update, loaded, loadError, saveError, saveStatus, flush, load, current } = useWorkspace();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<ItemKind | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');
  const [tagFilter, setTagFilter] = useState('');
  const [query, setQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsSection, setSettingsSection] = useState<'appearance' | 'codex' | 'general'>('appearance');
  const [settingsFromPlanner, setSettingsFromPlanner] = useState(false);
  const connectionRestored = useRef(false);
  const [appearance, setAppearance] = useState(readAppearance);
  function changeAppearance(patch: Partial<Appearance>) {
    const next = { ...appearance, ...patch };
    setAppearance(next); applyAppearance(next); saveAppearance(next);
  }
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectFolder, setProjectFolder] = useState('');
  const [showPalette, setShowPalette] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [previewNotes, setPreviewNotes] = useState(false);
  const [relatedTarget, setRelatedTarget] = useState('');
  const [deleting, setDeleting] = useState<{ type: 'item' | 'project'; id: string; title: string } | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [missingFolder, setMissingFolder] = useState(false);
  const [showPlanner, setShowPlanner] = useState(false);
  const [revealedBatch, setRevealedBatch] = useState<{ projectId: string; ids: string[] } | null>(null);
  const project = workspace.projects.find(p => p.id === workspace.activeProjectId) ?? workspace.projects[0];
  const items = useMemo(() => workspace.items.filter(i => i.projectId === project?.id).sort((a, b) => a.order - b.order), [workspace.items, project?.id]);
  const links = workspace.links.filter(l => l.projectId === project?.id);
  const view = project ? workspace.views[project.id] ?? defaultView() : defaultView();
  const selected = items.find(i => i.id === selectedId);
  const invalidParents = useMemo(() => selected ? new Set([selected.id, ...descendants(items, selected.id)]) : new Set<string>(), [items, selected?.id]);
  const tags = [...new Set(items.flatMap(i => i.tags))].sort();
  const matching = items.filter(i => (kindFilter === 'all' || i.kind === kindFilter) && (statusFilter === 'all' || i.status === statusFilter) && (priorityFilter === 'all' || i.priority === priorityFilter) && (!tagFilter || i.tags.includes(tagFilter)) && `${i.title} ${i.notes}`.toLowerCase().includes(query.toLowerCase()));
  const matchingIds = useMemo(() => new Set(matching.map(i => i.id)), [matching.map(i => i.id).join(',')]);
  const completion = items.filter(i => i.status === 'done').length;
  const planner = usePlanner({ workspace, projectId: project?.id ?? null, selectedId, current, update, flush, saveError, onCreated: (ids, message) => {
    if (project && ids.length) setRevealedBatch({ projectId: project.id, ids });
    setSelectedId(ids[0] ?? null); setShowPlanner(false); setNotice(message);
    setKindFilter('all'); setStatusFilter('all'); setPriorityFilter('all'); setTagFilter(''); setQuery('');
  } });
  function openSettings(section: 'appearance' | 'codex' | 'general' = 'appearance', fromPlanner = false) {
    setSettingsSection(section); setSettingsFromPlanner(fromPlanner); setShowPlanner(false); setShowSettings(true);
  }
  function closeSettings() {
    if (planner.phase === 'connecting' || planner.phase === 'signing-in') void planner.cancel();
    setShowSettings(false);
    if (settingsFromPlanner && project) setShowPlanner(true);
  }
  useEffect(() => {
    if (native && loaded && (showSettings || showPlanner) && !connectionRestored.current) {
      connectionRestored.current = true;
      void planner.connect();
    }
  }, [loaded, showSettings, showPlanner]);

  function closePlanner() { if (planner.phase === 'saving') return; void planner.cancel(); setShowPlanner(false); }

  useEffect(() => { setShowPlanner(false); setSelectedId(null); setQuery(''); setKindFilter('all'); setStatusFilter('all'); setPriorityFilter('all'); setTagFilter(''); }, [project?.id]);
  useEffect(() => { setPreviewNotes(false); setRelatedTarget(''); }, [selectedId]);
  useEffect(() => {
    let cancelled = false; setMissingFolder(false);
    if (project?.folder) void inspectFolder(project.folder).then(exists => { if (!cancelled) setMissingFolder(!exists); }).catch(() => { if (!cancelled) setMissingFolder(true); });
    return () => { cancelled = true; };
  }, [project?.folder]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 6000); return () => clearTimeout(timer);
  }, [notice]);

  function openProjectForm(existing?: Project) {
    setEditingProject(existing?.id ?? null); setProjectName(existing?.name ?? ''); setProjectFolder(existing?.folder ?? ''); setShowProjectForm(true);
  }
  function patchView(patch: Partial<ProjectView>) {
    if (!project) return;
    update(w => ({ ...w, views: { ...w.views, [project.id]: { ...w.views[project.id] ?? defaultView(), ...patch } } }));
  }
  function patchItem(id: string, patch: Partial<WorkItem>) {
    update(w => ({ ...w, items: w.items.map(i => i.id === id ? { ...i, ...patch, updatedAt: new Date().toISOString() } : i) }));
  }
  function addItem(kind: ItemKind = 'todo', parentId: string | null = null) {
    if (!project) { openProjectForm(); return; }
    const item = createItem(project.id, kind, parentId, items.length);
    const parent = items.find(i => i.id === parentId), siblings = items.filter(i => i.parentId === parentId);
    item.x = parent ? parent.x + 310 : 280;
    item.y = siblings.length ? Math.max(...siblings.map(i => i.y)) + 130 : parent?.y ?? 0;
    update(w => ({ ...w, items: [...w.items, item], views: { ...w.views, [project.id]: { ...view, collapsed: view.collapsed.filter(id => id !== parentId) } } }));
    setSelectedId(item.id); setShowNewMenu(false); setKindFilter('all'); setStatusFilter('all'); setPriorityFilter('all'); setTagFilter(''); setQuery('');
  }
  function addLink(sourceId: string, targetId: string) {
    if (!project || sourceId === targetId || !items.some(i => i.id === sourceId) || !items.some(i => i.id === targetId)) return;
    if (links.some(l => (l.sourceId === sourceId && l.targetId === targetId) || (l.sourceId === targetId && l.targetId === sourceId))) { setNotice('These items are already related.'); return; }
    update(w => ({ ...w, links: [...w.links, { id: crypto.randomUUID(), projectId: project.id, sourceId, targetId }] })); setRelatedTarget('');
  }
  function collapse(id: string) { patchView({ collapsed: view.collapsed.includes(id) ? view.collapsed.filter(i => i !== id) : [...view.collapsed, id] }); }
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (showSettings || showPlanner || event.isComposing || event.keyCode === 229) return;
      if (event.metaKey || event.ctrlKey) {
        if (event.key === ',' && !showPalette && !showProjectForm && !deleting) { event.preventDefault(); openSettings(); }
        if (event.key.toLowerCase() === 'k') { event.preventDefault(); setShowPalette(v => !v); setPaletteQuery(''); }
        if (event.key.toLowerCase() === 'n' && !showProjectForm && !deleting) { event.preventDefault(); addItem(); }
      }
      if (event.key === 'Escape') { setShowNewMenu(false); if (!showPalette && !showProjectForm && !deleting) setSelectedId(null); }
    };
    document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key);
  });
  async function runBackup(action: 'export' | 'import') {
    if (action === 'import') { await planner.cancel(); setShowPlanner(false); }
    setBusy(true);
    try {
      await flush();
      if (action === 'export') { if (await exportWorkspace(workspace)) setNotice('Backup exported.'); }
      else {
        const incoming = await importWorkspace();
        if (incoming) { update(w => importCopies(w, incoming)); await flush(); setNotice(`Imported ${incoming.projects.length} project${incoming.projects.length === 1 ? '' : 's'} as independent copies.`); }
      }
    } catch (error) { setNotice(errorText(error)); }
    finally { setBusy(false); }
  }
  function deleteConfirmed() {
    if (!deleting) return;
    const deletedIds = deleting.type === 'project' ? new Set(workspace.items.filter(i => i.projectId === deleting.id).map(i => i.id)) : new Set([deleting.id, ...descendants(workspace.items, deleting.id)]);
    update(w => {
      const projects = w.projects.filter(p => deleting.type !== 'project' || p.id !== deleting.id);
      const views = Object.fromEntries(Object.entries(w.views).filter(([id]) => deleting.type !== 'project' || id !== deleting.id).map(([id, v]) => [id, { ...v, collapsed: v.collapsed.filter(i => !deletedIds.has(i)) }]));
      return { ...w, projects, views, items: w.items.filter(i => !deletedIds.has(i.id)), links: w.links.filter(l => !deletedIds.has(l.sourceId) && !deletedIds.has(l.targetId)), activeProjectId: projects.some(p => p.id === w.activeProjectId) ? w.activeProjectId : projects[0]?.id ?? null };
    });
    if (selectedId && deletedIds.has(selectedId)) setSelectedId(null); setDeleting(null);
  }
  function tree(parentId: string | null, depth = 0): ReactNode {
    return items.filter(i => i.parentId === parentId).map(item => {
      const children = items.some(i => i.parentId === item.id), collapsed = view.collapsed.includes(item.id);
      return <div key={item.id}><div className={`tree-row ${selectedId === item.id ? 'selected' : ''}`} style={{ paddingLeft: 12 + depth * 14 }}>
        <button className={`tree-disclosure ${children ? '' : 'invisible'}`} onClick={() => collapse(item.id)} aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${item.title}`} aria-expanded={!collapsed} tabIndex={children ? 0 : -1}>{collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}</button>
        <button className="tree-item" onClick={() => setSelectedId(item.id)}><span className={`kind-icon ${item.kind}`}><KindIcon kind={item.kind} size={14} /></span><span className={item.status === 'done' ? 'completed' : ''}>{item.title}</span></button>
      </div>{children && !collapsed && tree(item.id, depth + 1)}</div>;
    });
  }

  if (!loaded) return <div className="startup"><GitBranch size={32} /><h1>Codebase Planner</h1>{loadError ? <><p role="alert">Couldn't open your workspace. {loadError}</p><button className="primary-button" onClick={() => void load()}>Retry loading</button><p>Your existing data has not been replaced.</p></> : <p><Loader2 className="spin" size={16} /> Opening your workspace…</p>}</div>;

  return <div className={`app ${sidebarOpen ? '' : 'sidebar-hidden'} ${selected ? 'has-inspector' : ''}`}>
    <aside className="sidebar" aria-label="Project navigation">
      <div className="brand"><span className="brand-mark"><GitBranch size={19} /></span><span>Codebase Planner</span><button className="icon-button sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Hide sidebar"><PanelLeftClose size={16} /></button></div>
      <button className="sidebar-search" onClick={() => { setShowPalette(true); setPaletteQuery(''); }}><Search size={15} /><span>Search & actions</span><kbd>⌘ K</kbd></button>
      <div className="section-label"><span>Projects</span><button className="icon-button" aria-label="Create project" onClick={() => openProjectForm()}><Plus size={14} /></button></div>
      <div className="project-list">{workspace.projects.map(p => <button className={`project-row ${p.id === project?.id ? 'active' : ''}`} key={p.id} onClick={() => update(w => ({ ...w, activeProjectId: p.id }))}><Folder size={16} /><span>{p.name}</span>{p.id === project?.id && <span className="active-dot" />}</button>)}</div>
      {project && <><div className="section-label"><span>Workspace</span></div><nav className="kind-nav" aria-label="Item types"><button className={kindFilter === 'all' ? 'active' : ''} onClick={() => setKindFilter('all')}><GitBranch size={16} /><span>All items</span><span className="count">{items.length}</span></button>{kinds.map(kind => <button key={kind} className={kindFilter === kind ? 'active' : ''} onClick={() => setKindFilter(kind)}><KindIcon kind={kind} /><span>{kind === 'todo' ? 'Todos' : kind === 'feature' ? 'Features' : 'Bugs'}</span><span className="count">{items.filter(i => i.kind === kind).length}</span></button>)}</nav><div className="section-label tree-label"><span>Project outline</span><button className="icon-button" aria-label="Add top-level item" onClick={() => addItem()}><Plus size={14} /></button></div><div className="project-tree">{items.length ? tree(null) : <p className="sidebar-hint">Your ideas will take shape here.</p>}</div></>}
      <div className="sidebar-bottom"><div className="backup-actions"><button onClick={() => openSettings()}><Settings2 size={14} />Settings</button><button disabled={busy || !workspace.projects.length} onClick={() => void runBackup('export')}><ArrowUpFromLine size={14} />Export backup</button><button disabled={busy} onClick={() => void runBackup('import')}><ArrowDownToLine size={14} />Import backup</button></div><div className="local-label"><span className="local-dot" />{native ? 'Local workspace' : 'Browser preview'}<span>v0.1</span></div></div>
    </aside>

    <main className="main">
      <header className="workspace-header"><div className="breadcrumb">{!sidebarOpen && <button className="icon-button" aria-label="Show sidebar" onClick={() => setSidebarOpen(true)}><PanelLeftOpen size={18} /></button>}<Folder size={16} /><span>{project?.name ?? 'Your workspace'}</span>{project && <><ChevronRight size={14} /><span className="muted">{view.mode === 'map' ? 'Mind map' : 'List'}</span></>}</div><div className="header-actions"><button className="icon-button" aria-label="Settings" title="Settings (⌘ ,)" onClick={() => openSettings()}><Settings2 size={17} /></button><span className={`save-state ${saveStatus}`} title={saveError}>{saveStatus === 'saving' ? <Loader2 size={13} className="spin" /> : saveStatus === 'saved' ? <Check size={13} /> : <Circle size={10} />} {saveStatus === 'saved' ? 'Saved locally' : saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Save failed' : 'Unsaved'}</span>{project && <button className="icon-button" aria-label="Project settings" onClick={() => openProjectForm(project)}><Settings2 size={17} /></button>}</div></header>
      {saveError && <div className="error-banner" role="alert"><span>Changes haven't saved. {saveError}</span><button onClick={() => void flush().catch(() => {})}>Retry save</button></div>}
      {missingFolder && <div className="folder-banner"><FolderOpen size={15} /><span>Repository folder is missing. Your planning data is still available.</span><button onClick={() => openProjectForm(project)}>Update folder</button></div>}
      {!project ? <div className="welcome"><div className="welcome-diagram" aria-hidden="true"><div className="welcome-root"><GitBranch size={25} /></div><div className="welcome-lines" /><div className="welcome-leaves"><span><Sparkles size={20} /></span><span><CheckCircle2 size={20} /></span><span><Bug size={20} /></span></div></div><h1>A little structure.<br />A clearer next step.</h1><p>Give your codebase a home for features, todos, and bugs.<br />Connect the big picture to the work in front of you.</p><button className="primary-button" onClick={() => openProjectForm()}><Plus size={17} />Create project</button><button className="text-button" onClick={() => update(() => demoWorkspace())}>Explore a demo project <ArrowUpRight size={14} /></button><div className="welcome-footnote"><span className="local-dot" />{native ? 'Stored on your Mac. Ready without an internet connection.' : 'Browser preview uses local storage. Desktop app uses SQLite.'}</div></div> : <>
        <div className="project-heading"><div><h1>{project.name}</h1><p>{items.length ? `${items.length} items · ${completion} completed` : 'Every idea starts with a first branch.'}</p></div><div className="planner-heading-actions"><button className="secondary-button" onClick={() => { setShowNewMenu(false); setShowPlanner(true); }}><Sparkles size={15} />Plan with AI</button><div className="new-item-wrap"><button className="primary-button" aria-expanded={showNewMenu} onClick={() => setShowNewMenu(v => !v)}><Plus size={16} />New item<ChevronDown size={13} /></button>{showNewMenu && <div className="new-item-menu">{kinds.map(kind => <button key={kind} onClick={() => addItem(kind)}><KindIcon kind={kind} />{kindLabels[kind]}</button>)}</div>}</div></div></div>
        {planner.hasBatch && <div className="planner-batch-banner" role="status"><span>{planner.undoAvailable ? 'Last AI batch can be undone during this session.' : 'Undo unavailable while saving or after generated items change.'}</span><button className="text-button" disabled={!planner.undoAvailable} onClick={() => void planner.undo()}>Undo AI batch</button></div>}
        {!showPlanner && planner.error && <div className="error-banner" role="alert"><span>{planner.error}</span><button onClick={() => setShowPlanner(true)}>Open planner</button></div>}
        <div className="workspace-toolbar"><div className="view-switch" aria-label="Workspace view"><button className={view.mode === 'map' ? 'active' : ''} onClick={() => patchView({ mode: 'map' })}><MapIcon size={15} />Mind map</button><button className={view.mode === 'list' ? 'active' : ''} onClick={() => patchView({ mode: 'list' })}><LayoutList size={15} />List</button></div><div className="filter-search"><Search size={14} /><input aria-label="Search current project" placeholder="Find an item…" value={query} onChange={e => setQuery(e.target.value)} />{query && <button className="icon-button" aria-label="Clear search" onClick={() => setQuery('')}><X size={13} /></button>}</div><select aria-label="Filter status" value={statusFilter} onChange={e => setStatusFilter(e.target.value as Status | 'all')}><option value="all">All statuses</option>{Object.entries(statusLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select><select aria-label="Filter priority" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value as Priority | 'all')}><option value="all">All priorities</option><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select><select aria-label="Filter tag" value={tagFilter} onChange={e => setTagFilter(e.target.value)}><option value="">All tags</option>{tags.map(tag => <option key={tag}>{tag}</option>)}</select>{view.mode === 'map' && <button className="arrange-button" onClick={() => { const arranged = new Map(arrangeItems(items).map(i => [i.id, i])); update(w => ({ ...w, items: w.items.map(i => arranged.get(i.id) ?? i) })); setNotice('Map arranged. Use Fit view to see all branches.'); }}><GitBranch size={14} />Arrange</button>}</div>
        <div className="work-surface">
          {items.length === 0 ? <div className="empty-work"><GitBranch size={32} /><h2>What are you building?</h2><p>Start with a feature, break it into todos,<br />and keep bugs close to their context.</p><div>{kinds.map(kind => <button className="secondary-button" key={kind} onClick={() => addItem(kind)}><KindIcon kind={kind} />Add {kind}</button>)}</div></div> : view.mode === 'map' ? <MindMap key={project.id} project={project} items={items} links={links} view={view} selectedId={selectedId} matchingIds={matchingIds} revealIds={revealedBatch?.projectId === project.id ? revealedBatch.ids : undefined} onSelect={id => { if (id === `root:${project.id}`) openProjectForm(project); else setSelectedId(id); }} onRename={(id, title) => patchItem(id, { title })} onAdd={parentId => addItem('todo', parentId)} onMove={(id, x, y) => patchItem(id, { x, y })} onLink={addLink} onCollapse={collapse} onViewport={viewport => patchView({ viewport })} /> : <div className="item-list"><div className="list-columns"><span>Item</span><span>Status</span><span>Priority</span></div>{matching.length ? matching.map(item => <button className={`list-row ${selectedId === item.id ? 'selected' : ''}`} key={item.id} onClick={() => setSelectedId(item.id)}><div className="list-title"><span className={`kind-icon ${item.kind}`}><KindIcon kind={item.kind} size={17} /></span><div><span className={item.status === 'done' ? 'completed' : ''}>{item.title}</span><small>{item.parentId ? items.find(i => i.id === item.parentId)?.title : kindLabels[item.kind]}{item.tags.length > 0 && ` · ${item.tags.join(', ')}`}</small></div></div><span className={`status-label ${item.status}`}><StatusIcon status={item.status} />{statusLabels[item.status]}</span><span className={`priority-label ${item.priority}`}>{item.priority}</span></button>) : <div className="no-results"><Search size={24} /><h2>No matching items</h2><p>Try another search or clear your filters.</p><button className="secondary-button" onClick={() => { setQuery(''); setKindFilter('all'); setStatusFilter('all'); setPriorityFilter('all'); setTagFilter(''); }}>Clear filters</button></div>}</div>}
        </div><footer className="workspace-footer"><span>{matching.length === items.length ? 'All items' : `${matching.length} matching items`}{view.mode === 'map' && ' · Drag to move · Connect to relate'}</span><span><kbd>⌘ N</kbd> New todo <kbd>⌘ K</kbd> Search</span></footer>
      </>}
    </main>

    {selected && <aside className="inspector" aria-label="Item details"><div className="inspector-top"><span className={`kind-icon ${selected.kind}`}><KindIcon kind={selected.kind} /></span><span>{kindLabels[selected.kind]}</span><button className="icon-button" aria-label="Close item details" onClick={() => setSelectedId(null)}><PanelRightClose size={17} /></button></div><div className="inspector-content"><TitleEditor key={selected.id} title={selected.title} onChange={title => patchItem(selected.id, { title })} />
      <div className="item-properties"><label><span>Type</span><select aria-label="Item type" value={selected.kind} onChange={e => patchItem(selected.id, { kind: e.target.value as ItemKind })}>{kinds.map(kind => <option value={kind} key={kind}>{kindLabels[kind]}</option>)}</select></label><label><span>Status</span><select aria-label="Item status" value={selected.status} onChange={e => patchItem(selected.id, { status: e.target.value as Status })}>{Object.entries(statusLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label><label><span>Priority</span><select aria-label="Item priority" value={selected.priority} onChange={e => patchItem(selected.id, { priority: e.target.value as Priority })}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label><label><span>Parent</span><select aria-label="Item parent" value={selected.parentId ?? ''} onChange={e => patchItem(selected.id, { parentId: e.target.value || null })}><option value="">{project?.name}</option>{items.filter(i => !invalidParents.has(i.id)).map(i => <option key={i.id} value={i.id}>{i.title}</option>)}</select></label><label><span>Tags</span><TagsEditor key={selected.id} tags={selected.tags} onChange={tags => patchItem(selected.id, { tags })} /></label></div>
      <div className="notes-heading"><h2>Notes</h2><div className="small-switch"><button className={!previewNotes ? 'active' : ''} onClick={() => setPreviewNotes(false)}>Edit</button><button className={previewNotes ? 'active' : ''} onClick={() => setPreviewNotes(true)}>Preview</button></div></div>{previewNotes ? <div className="markdown-preview"><ReactMarkdown skipHtml components={{ a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>, img: ({ alt }) => <span>[Image: {alt ?? ''}]</span> }}>{selected.notes || '*No notes yet.*'}</ReactMarkdown></div> : <textarea className="notes-editor" aria-label="Item notes" placeholder={'What should future you know?\n\nMarkdown supported.'} value={selected.notes} onChange={e => patchItem(selected.id, { notes: e.target.value })} />}
      <div className="related-heading"><h2><Link2 size={14} />Related items</h2></div><div className="related-items">{links.filter(l => l.sourceId === selected.id || l.targetId === selected.id).map(link => { const other = items.find(i => i.id === (link.sourceId === selected.id ? link.targetId : link.sourceId)); return other && <div className="related-row" key={link.id}><button onClick={() => setSelectedId(other.id)}><KindIcon kind={other.kind} /><span>{other.title}</span></button><button className="icon-button" aria-label={`Remove relation to ${other.title}`} onClick={() => update(w => ({ ...w, links: w.links.filter(l => l.id !== link.id) }))}><X size={13} /></button></div>; })}</div><div className="relate-controls"><select aria-label="Select related item" value={relatedTarget} onChange={e => setRelatedTarget(e.target.value)}><option value="">Link an item…</option>{items.filter(i => i.id !== selected.id && !links.some(l => (l.sourceId === selected.id && l.targetId === i.id) || (l.targetId === selected.id && l.sourceId === i.id))).map(i => <option key={i.id} value={i.id}>{i.title}</option>)}</select><button className="icon-button" aria-label="Add related link" disabled={!relatedTarget} onClick={() => addLink(selected.id, relatedTarget)}><Plus size={16} /></button></div>
      <button className="add-child-button" onClick={() => addItem('todo', selected.id)}><Plus size={15} />Add child todo</button><div className="item-metadata">Updated {new Date(selected.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div><button className="delete-button" onClick={() => setDeleting({ type: 'item', id: selected.id, title: selected.title })}><Trash2 size={14} />Delete item</button>
    </div></aside>}

    {showPlanner && project && <Dialog title={`Plan ${project.name}`} close={closePlanner}><PlannerComposer native={native} connection={planner.connection} phase={planner.phase} message={planner.message} error={planner.error} prompt={planner.prompt} model={planner.model} onPromptChange={planner.setPrompt} onModelChange={planner.setModel} onOpenSettings={() => openSettings('codex', true)} onGenerate={() => void planner.generate()} onCancel={() => void planner.cancel()} onRetrySave={saveError ? () => void planner.retrySave() : undefined} /></Dialog>}
    {showSettings && <Dialog title="Settings" close={closeSettings}><SettingsPanel appearance={appearance} onAppearance={changeAppearance} planner={planner} native={native} initialSection={settingsSection} backupBusy={busy} canExport={!!workspace.projects.length} onBackup={action => { setSettingsFromPlanner(false); setShowSettings(false); void runBackup(action); }} /></Dialog>}
    {showProjectForm && <Dialog title={editingProject ? 'Project settings' : 'Create project'} close={() => setShowProjectForm(false)}><form onSubmit={e => { e.preventDefault(); if (!projectName.trim()) return; const id = editingProject ?? crypto.randomUUID(); update(w => ({ ...w, projects: editingProject ? w.projects.map(p => p.id === id ? { ...p, name: projectName.trim(), folder: projectFolder } : p) : [...w.projects, { id, name: projectName.trim(), folder: projectFolder, createdAt: new Date().toISOString() }], activeProjectId: id, views: { ...w.views, [id]: w.views[id] ?? defaultView() } })); setShowProjectForm(false); }}><label className="form-field">Project name<input required maxLength={200} placeholder="e.g. My next great app" value={projectName} onChange={e => setProjectName(e.target.value)} /></label><label className="form-field">Repository folder<span className="folder-picker"><input aria-label="Repository folder" placeholder={native ? 'Choose a local repository' : 'Optional path for browser preview'} value={projectFolder} readOnly={native} onChange={e => setProjectFolder(e.target.value)} /><button type="button" className="secondary-button" aria-label="Choose repository folder" disabled={!native} onClick={async () => { try { const folder = await chooseFolder(); if (folder) { setProjectFolder(folder); if (!projectName) setProjectName(folder.split('/').filter(Boolean).at(-1) ?? ''); } } catch (error) { setNotice(errorText(error)); } }}><FolderOpen size={15} />Choose</button></span></label><p className="form-hint">Folder association is optional. Your repository files stay untouched.</p><div className="dialog-actions">{editingProject && <button type="button" className="delete-button" onClick={() => { setShowProjectForm(false); setDeleting({ type: 'project', id: editingProject, title: projectName }); }}><Trash2 size={14} />Delete project</button>}<button className="primary-button" disabled={!projectName.trim()}>{editingProject ? 'Save settings' : 'Create project'}</button></div></form></Dialog>}
    {deleting && <Dialog title={deleting.type === 'project' ? 'Delete project?' : 'Delete this branch?'} close={() => setDeleting(null)}><p className="delete-description">“{deleting.title}” and {deleting.type === 'project' ? workspace.items.filter(i => i.projectId === deleting.id).length : descendants(workspace.items, deleting.id).size} {deleting.type === 'project' ? 'items' : 'descendant items'} will be permanently deleted, including their related links. Export a backup first if you need a copy.</p><div className="dialog-actions"><button className="secondary-button" onClick={() => setDeleting(null)}>Cancel</button><button className="danger-button" onClick={deleteConfirmed}>Delete {deleting.type === 'project' ? 'project' : 'branch'}</button></div></Dialog>}
    {showPalette && <Dialog title="Search & actions" close={() => setShowPalette(false)}><div className="palette-input"><Search size={18} /><input aria-label="Search actions and items" placeholder="Search this project or choose an action…" value={paletteQuery} onChange={e => setPaletteQuery(e.target.value)} /></div><div className="palette-results">{!paletteQuery && <><button onClick={() => { setShowPalette(false); addItem(); }}><Plus size={16} /><span>New todo</span><kbd>⌘ N</kbd></button><button onClick={() => { setShowPalette(false); openProjectForm(); }}><Folder size={16} />Create project</button>{project && <button onClick={() => { setShowPalette(false); patchView({ mode: view.mode === 'map' ? 'list' : 'map' }); }}><LayoutList size={16} />Switch to {view.mode === 'map' ? 'list' : 'mind map'}</button>}</>}{items.filter(i => `${i.title} ${i.notes}`.toLowerCase().includes(paletteQuery.toLowerCase())).slice(0, 40).map(i => <button key={i.id} onClick={() => { setSelectedId(i.id); setShowPalette(false); }}><KindIcon kind={i.kind} /><span>{i.title}</span></button>)}{paletteQuery && !items.some(i => `${i.title} ${i.notes}`.toLowerCase().includes(paletteQuery.toLowerCase())) && <p>No matching items in this project.</p>}</div></Dialog>}
    {notice && <div className="toast" role="status"><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={15} /></button></div>}
  </div>;
}
