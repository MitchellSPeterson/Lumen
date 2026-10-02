import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowUp, ArrowDown, ArrowUpRight, Bug, CheckCircle2, ChevronDown, ChevronRight, Columns3, Folder, Inbox, Lightbulb, FolderOpen, GitBranch, LayoutList, Link2, Loader2, Map as MapIcon, Maximize2, Mic, Minimize2, PanelLeftClose, PanelLeftOpen, PanelRightClose, Plus, Search, Settings2, SlidersHorizontal, Sparkles, SquareCheck, Trash2, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { captureIdea, createItem, defaultView, descendants, groupItems, importCopies, itemSearchText, kindLabels, matchingWithAncestors, moveItem, planningLaneLabels, reorderItem, statusLabels, type ItemKind, type PlanningLane, type Priority, type Project, type ProjectView, type Status, type WorkItem } from './domain';
import { chooseFolder, exportWorkspace, importWorkspace, inspectFolder, native } from './persistence';
import { useWorkspace } from './useWorkspace';
import { demoWorkspace } from './demo';
import MindMap from './MindMap';
import { arrangeItems } from './mapLayout';
import { applyAppearance, readAppearance, saveAppearance, type Appearance } from './appearance';
import { PlannerComposer } from './PlannerComposer';
import { usePlanner } from './usePlanner';
import { SettingsPanel } from './SettingsPanel';
import { Board, KindIcon, Outline, StatusIcon } from './WorkflowViews';
import { ItemPlanning } from './ItemPlanning';
import './Workflow.css';
import type { PlannerAction } from './planner';

const kinds: ItemKind[] = ['idea', 'feature', 'todo', 'bug'];
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
    return () => { document.removeEventListener('keydown', key); if (previous?.isConnected) previous.focus(); else document.querySelector<HTMLElement>('.new-item-wrap button, .welcome .primary-button, .sidebar-toggle')?.focus(); };
  }, []);
  return <div className="dialog-shade" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}><div ref={ref} className="dialog" role="dialog" aria-modal="true" aria-label={title}><div className="dialog-heading"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={close}><X size={18} /></button></div>{children}</div></div>;
}

function TagsEditor({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [text, setText] = useState(tags.join(', '));
  useEffect(() => setText(tags.join(', ')), [tags.join(',')]);
  return <input aria-label="Tags" value={text} placeholder="e.g. interface, v1" onChange={e => setText(e.target.value)} onBlur={() => onChange([...new Set(text.split(',').map(t => t.trim()).filter(Boolean))])} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />;
}

function TitleEditor({ title, autoFocus, onChange }: { title: string; autoFocus: boolean; onChange: (title: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (autoFocus) { ref.current?.focus(); ref.current?.select(); } }, []);
  const [text, setText] = useState(title);
  useEffect(() => setText(title), [title]);
  return <><textarea ref={ref} className="item-title-input" aria-label="Item title" aria-invalid={!text.trim()} aria-describedby={!text.trim() ? 'title-required' : undefined} value={text} rows={2} onChange={e => { const value = e.target.value.replace(/\n/g, ' '); setText(value); if (value.trim()) onChange(value); }} onBlur={() => { if (!text.trim()) setText(title); }} />{!text.trim() && <p id="title-required" className="field-error">Title required. Previous title stays saved.</p>}</>;
}

export default function App() {
  const { workspace, update, loaded, loadError, saveError, flush, load, current } = useWorkspace();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inspectorExpanded, setInspectorExpanded] = useState(false);
  const [lastSelected, setLastSelected] = useState<WorkItem | null>(null);
  const [kindFilter, setKindFilter] = useState<ItemKind | 'all'>('all');
  const [inboxOnly, setInboxOnly] = useState(false);
  const [planningFilter, setPlanningFilter] = useState<PlanningLane | 'all'>('all');
  const [captureText, setCaptureText] = useState('');
  const [showCapture, setShowCapture] = useState(false);
  const captureRef = useRef<HTMLTextAreaElement>(null);
  const captureDialogRef = useRef<HTMLDivElement>(null);
  const captureTriggerRef = useRef<HTMLElement | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [focusTitleId, setFocusTitleId] = useState<string | null>(null);
  const [capturedId, setCapturedId] = useState<string | null>(null);
  const newMenuRef = useRef<HTMLDivElement>(null);
  const filtersRef = useRef<HTMLDetailsElement>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');
  const [tagFilter, setTagFilter] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(() => !window.matchMedia('(max-width: 760px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const adapt = () => setSidebarOpen(!media.matches);
    if (media.matches) setSidebarOpen(false);
    media.addEventListener('change', adapt);
    return () => media.removeEventListener('change', adapt);
  }, []);
  const [showSettings, setShowSettings] = useState(false);
  const settingsHeadingRef = useRef<HTMLHeadingElement>(null);
  const settingsTriggerRef = useRef<HTMLElement | null>(null);
  const restoreSettingsFocus = useRef(false);
  useEffect(() => {
    if (showSettings) settingsHeadingRef.current?.focus();
    else if (restoreSettingsFocus.current) {
      (settingsTriggerRef.current?.isConnected ? settingsTriggerRef.current : document.querySelector<HTMLElement>('.sidebar-settings'))?.focus();
      restoreSettingsFocus.current = false;
    }
  }, [showSettings]);
  const [settingsSection, setSettingsSection] = useState<'appearance' | 'codex' | 'general'>('appearance');
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
  const paletteRef = useRef<HTMLDivElement>(null);
  const paletteInputRef = useRef<HTMLInputElement>(null);
  const paletteTriggerRef = useRef<HTMLElement | null>(null);
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
  const inspectorOpen = !!selected && !showSettings;
  const inspectorItem = selected ?? lastSelected;
  const expanded = inspectorOpen && inspectorExpanded;
  useEffect(() => { if (selected) setLastSelected(selected); }, [selected]);
  useEffect(() => { if (!inspectorOpen) setInspectorExpanded(false); }, [inspectorOpen, project?.id]);
  function closeInspector() {
    if (!inspectorOpen) return;
    setSelectedId(null);
    document.querySelector<HTMLElement>('.sidebar-toggle')?.focus();
  }
  const invalidParents = useMemo(() => selected ? new Set([selected.id, ...descendants(items, selected.id)]) : new Set<string>(), [items, selected?.id]);
  const tags = [...new Set(items.flatMap(i => i.tags))].sort();
  const matching = items.filter(i => (!inboxOnly || (i.kind === 'idea' && i.parentId === null)) && (planningFilter === 'all' || i.planningLane === planningFilter) && (kindFilter === 'all' || i.kind === kindFilter) && (statusFilter === 'all' || i.status === statusFilter) && (priorityFilter === 'all' || i.priority === priorityFilter) && (!tagFilter || i.tags.includes(tagFilter)));
  const matchingIds = useMemo(() => new Set(matching.map(i => i.id)), [matching.map(i => i.id).join(',')]);
  const inboxEmpty = !items.some(item => item.kind === 'idea' && item.parentId === null);
  const filterCount = Number(statusFilter !== 'all') + Number(priorityFilter !== 'all') + Number(!!tagFilter) + Number(planningFilter !== 'all');
  const sectionTitle = inboxOnly ? 'Inbox' : kindFilter !== 'all' ? ({ feature: 'Features', todo: 'Tasks', bug: 'Bugs', idea: 'Ideas' })[kindFilter] : planningFilter !== 'all' ? (planningFilter ? planningLaneLabels[planningFilter] : 'Unplanned') : 'All items';
  const sectionHint = inboxOnly ? 'Capture a thought. Turn it into a feature or task when you’re ready.' : planningFilter === 'now' ? 'The work you’re focusing on today.' : planningFilter === 'next' ? 'What you want to tackle next.' : planningFilter === 'later' ? 'Good ideas for another time.' : 'Collect ideas, shape features, and decide what comes next.';
  const completion = items.filter(i => i.kind !== 'idea' && i.status === 'done').length;
  const filtered = inboxOnly || kindFilter !== 'all' || statusFilter !== 'all' || priorityFilter !== 'all' || planningFilter !== 'all' || !!tagFilter;
  const checkedItems = items.filter(item => checkedIds.has(item.id));
  const canGroup = checkedItems.length >= 2 && checkedItems.length === checkedIds.size && checkedItems.every(item => item.parentId === checkedItems[0]?.parentId);
  const planner = usePlanner({ workspace, projectId: project?.id ?? null, selectedId, current, update, flush, saveError, onCreated: (ids, message) => {
    if (project && ids.length) setRevealedBatch({ projectId: project.id, ids });
    setSelectedId(ids[0] ?? selectedId); setShowPlanner(false); setNotice(message);
    clearFilters();
  } });
  function openSettings(section: 'appearance' | 'codex' | 'general' = 'appearance') {
    settingsTriggerRef.current = document.activeElement as HTMLElement;
    setShowNewMenu(false);
    setSettingsSection(section); setShowPlanner(false); setShowSettings(true);
  }
  function closeSettings(restoreFocus = true) {
    if (showSettings && (planner.phase === 'connecting' || planner.phase === 'signing-in')) void planner.cancel();
    restoreSettingsFocus.current = showSettings && restoreFocus;
    setShowSettings(false);
  }
  useEffect(() => {
    if (native && loaded && (showSettings || showPlanner) && !connectionRestored.current) {
      connectionRestored.current = true;
      void planner.connect();
    }
  }, [loaded, showSettings, showPlanner]);

  function closePlanner() { if (planner.phase === 'saving') return; void planner.cancel(); planner.discard(); setShowPlanner(false); }

  function clearFilters() { if (window.matchMedia('(max-width: 760px)').matches) setSidebarOpen(false); setSelecting(false); setCheckedIds(new Set()); setInboxOnly(false); setPlanningFilter('all'); setKindFilter('all'); setStatusFilter('all'); setPriorityFilter('all'); setTagFilter(''); }
  function openPlanner(action: PlannerAction = 'project') { planner.setAction(action); setShowNewMenu(false); setShowPlanner(true); }
  function openCapture() {
    if (showCapture) { captureRef.current?.focus(); return; }
    if (!project) { openProjectForm(); return; }
    captureTriggerRef.current = document.activeElement as HTMLElement;
    setShowNewMenu(false); setShowCapture(true);
  }
  function openPalette() {
    paletteTriggerRef.current = document.activeElement as HTMLElement;
    setShowCapture(false); setShowNewMenu(false); setPaletteQuery(''); setShowPalette(true);
  }
  function closePalette() {
    setShowPalette(false);
    const trigger = paletteTriggerRef.current;
    requestAnimationFrame(() => {
      if (paletteRef.current) return;
      [trigger, document.querySelector<HTMLElement>('.sidebar-toggle')].find(node => node?.isConnected && node !== document.body && node !== document.documentElement && !node.closest('[inert], [aria-hidden="true"]') && node.getClientRects().length > 0 && getComputedStyle(node).visibility === 'visible')?.focus();
    });
  }
  useEffect(() => {
    if (!showPalette) return;
    const frame = requestAnimationFrame(() => paletteInputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [showPalette]);
  function closeCapture(restoreFocus = true) {
    setShowCapture(false);
    if (restoreFocus) {
      const trigger = captureTriggerRef.current;
      requestAnimationFrame(() => {
        if (captureDialogRef.current) return;
        [trigger, ...document.querySelectorAll<HTMLElement>('.new-item-button, .sidebar-toggle')].find(node => node?.isConnected && !node.closest('[inert], [aria-hidden="true"]') && node.getClientRects().length > 0 && getComputedStyle(node).visibility === 'visible')?.focus();
      });
    }
  }
  useEffect(() => {
    if (!showCapture) return;
    const frame = requestAnimationFrame(() => captureRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [showCapture]);
  useEffect(() => {
    if (showSettings || showPlanner || showPalette || showProjectForm || showGroupForm || deleting) setShowCapture(false);
  }, [showSettings, showPlanner, showPalette, showProjectForm, showGroupForm, deleting]);
  function capture() {
    if (!project || !captureText.trim()) return;
    try {
      let itemId = '';
      update(w => { const result = captureIdea(w, project.id, captureText); itemId = result.itemId; return result.workspace; });
      setCaptureText(''); clearFilters(); setInboxOnly(true); patchView({ mode: 'outline' }); setSelectedId(null); setCapturedId(itemId); setNotice('Idea saved to Inbox.');
      setRevealedBatch({ projectId: project.id, ids: [itemId] });
      closeCapture();
    } catch (error) { setNotice(errorText(error)); }
  }
  function move(id: string, parentId: string | null, beforeId?: string | null) {
    try { update(w => moveItem(w, id, parentId, beforeId)); if (parentId) patchView({ collapsed: view.collapsed.filter(id => id !== parentId) }); }
    catch (error) { setNotice(errorText(error)); }
  }
  function reorder(id: string, direction: -1 | 1) {
    try { update(w => reorderItem(w, id, direction)); } catch (error) { setNotice(errorText(error)); }
  }

  useEffect(() => { setShowPlanner(false); setSelectedId(null); clearFilters(); setCheckedIds(new Set()); setCaptureText(''); setShowCapture(false); setShowGroupForm(false); }, [project?.id]);
  useEffect(() => { setSelecting(false); setCheckedIds(new Set()); }, [project?.id, view.mode]);
  useEffect(() => {
    const keyboard = () => { document.documentElement.dataset.input = 'keyboard'; };
    const dismiss = (event: PointerEvent) => {
      document.documentElement.dataset.input = 'pointer';
      if (!newMenuRef.current?.contains(event.target as Node)) setShowNewMenu(false);
      if (!captureDialogRef.current?.contains(event.target as Node)) setShowCapture(false);
      if (!paletteRef.current?.contains(event.target as Node)) setShowPalette(false);
      if (!filtersRef.current?.contains(event.target as Node) && filtersRef.current) filtersRef.current.open = false;
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', keyboard, true);
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', keyboard, true); };
  }, []);
  useEffect(() => { setPreviewNotes(false); setRelatedTarget(''); setFocusTitleId(null); if (selectedId && window.matchMedia('(max-width: 760px)').matches) setSidebarOpen(false); }, [selectedId]);
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
    setSelectedId(item.id); setFocusTitleId(item.id); setShowNewMenu(false); clearFilters();
  }
  function addLink(sourceId: string, targetId: string) {
    if (!project || sourceId === targetId || !items.some(i => i.id === sourceId) || !items.some(i => i.id === targetId)) return;
    if (links.some(l => (l.sourceId === sourceId && l.targetId === targetId) || (l.sourceId === targetId && l.targetId === sourceId))) { setNotice('These items are already related.'); return; }
    update(w => ({ ...w, links: [...w.links, { id: crypto.randomUUID(), projectId: project.id, sourceId, targetId }] })); setRelatedTarget('');
  }
  function collapse(id: string) { patchView({ collapsed: view.collapsed.includes(id) ? view.collapsed.filter(i => i !== id) : [...view.collapsed, id] }); }
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (showSettings || showPlanner || showGroupForm || event.isComposing || event.keyCode === 229) return;
      if (event.metaKey || event.ctrlKey) {
        const mode = event.key === '1' ? 'outline' : event.key === '2' ? 'map' : event.key === '3' ? 'board' : null;
        if (mode && project && !event.altKey && !event.shiftKey && !showPalette && !showCapture && !showProjectForm && !deleting && !expanded && !(event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"]')) && !(mode === 'board' && inboxOnly)) { event.preventDefault(); patchView({ mode }); return; }
        if (event.key === ',' && !showPalette && !showProjectForm && !deleting) { event.preventDefault(); openSettings(); }
        if (event.key.toLowerCase() === 'k' && !showProjectForm && !deleting) { event.preventDefault(); if (showPalette) closePalette(); else openPalette(); }
        if (event.key.toLowerCase() === 'n' && !showProjectForm && !showPalette && !showGroupForm && !deleting) { event.preventDefault(); openCapture(); }
      }
      if (event.key === 'Escape') { if (showPalette) { event.preventDefault(); closePalette(); return; } if (showCapture) { event.preventDefault(); closeCapture(); return; } if (filtersRef.current?.open) { filtersRef.current.open = false; filtersRef.current.querySelector('summary')?.focus(); return; } if (showNewMenu) { setShowNewMenu(false); newMenuRef.current?.querySelector('button')?.focus(); return; } setShowNewMenu(false); if (!showPalette && !showProjectForm && !deleting) closeInspector(); }
    };
    document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key);
  });
  async function runBackup(action: 'export' | 'import') {
    if (action === 'import') { await planner.cancel(); planner.discard(); setShowPlanner(false); }
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
        <button className="tree-item" onClick={() => { closeSettings(false); setSelectedId(item.id); }}><span className={`kind-icon ${item.kind}`}><KindIcon kind={item.kind} size={14} /></span><span className={item.status === 'done' ? 'completed' : ''}>{item.title}</span></button>
      </div>{children && !collapsed && tree(item.id, depth + 1)}</div>;
    });
  }

  if (!loaded) return <div className="startup"><GitBranch size={32} /><h1>Codebase Planner</h1>{loadError ? <><p role="alert">Couldn't open your workspace. {loadError}</p><button className="primary-button" onClick={() => void load()}>Retry loading</button><p>Your existing data has not been replaced.</p></> : <p><Loader2 className="spin" size={16} /> Opening your workspace…</p>}</div>;

  return <div className={`app ${sidebarOpen ? 'sidebar-expanded' : 'sidebar-collapsed'} ${inspectorOpen ? 'has-inspector' : ''} ${expanded ? 'inspector-expanded' : ''}`}>
    <aside id="project-navigation" className="sidebar" aria-label="Project navigation">
      <div className="brand"><button className="icon-button sidebar-toggle" onClick={() => setSidebarOpen(value => !value)} aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'} aria-expanded={sidebarOpen} aria-controls="sidebar-content" title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}>{sidebarOpen ? <PanelLeftClose size={19} /> : <PanelLeftOpen size={19} />}</button><span className="sidebar-label brand-name" aria-hidden={!sidebarOpen}><GitBranch size={17} />Codebase Planner</span></div>
      <div id="sidebar-content" className="sidebar-content">
      <div className="section-label projects-label"><span className="sidebar-label" aria-hidden={!sidebarOpen}>Projects</span><button className="icon-button" aria-label="Create project" onClick={() => openProjectForm()}><Plus size={14} /></button></div>
      <div className="project-list">{workspace.projects.map(p => <button className={`project-row ${p.id === project?.id && !showSettings ? 'active' : ''}`} key={p.id} aria-label={p.name} title={p.name} onClick={() => { closeSettings(false); update(w => ({ ...w, activeProjectId: p.id })); if (window.matchMedia('(max-width: 760px)').matches) setSidebarOpen(false); }}><Folder size={16} /><span className="sidebar-label" aria-hidden={!sidebarOpen}>{p.name}</span>{p.id === project?.id && <span className="active-dot sidebar-label" aria-hidden={!sidebarOpen} />}</button>)}</div>
      {project && <>
        <div className="section-label"><span className="sidebar-label" aria-hidden={!sidebarOpen}>Workspace</span></div>
        <nav className="kind-nav" aria-label="Project views">
          <button className={!showSettings && !inboxOnly && kindFilter === 'all' && planningFilter === 'all' ? 'active' : ''} aria-current={!showSettings && !inboxOnly && kindFilter === 'all' && planningFilter === 'all' ? 'page' : undefined} aria-label="All items" title="All items" onClick={() => { closeSettings(false); clearFilters(); }}><GitBranch size={16} /><span className="sidebar-label" aria-hidden={!sidebarOpen}>All items</span><span className="count sidebar-label" aria-hidden={!sidebarOpen}>{items.length}</span></button>
          <button className={!showSettings && inboxOnly ? 'active' : ''} aria-current={!showSettings && inboxOnly ? 'page' : undefined} aria-label="Inbox" title="Inbox" onClick={() => { closeSettings(false); clearFilters(); setInboxOnly(true); patchView({ mode: 'outline' }); }}><Inbox size={16} /><span className="sidebar-label" aria-hidden={!sidebarOpen}>Inbox</span><span className="count sidebar-label" aria-hidden={!sidebarOpen}>{items.filter(i => i.kind === 'idea' && i.parentId === null).length}</span></button>
        </nav>
        <div className="section-label"><span className="sidebar-label" aria-hidden={!sidebarOpen}>Your plan</span></div>
        <nav className="kind-nav plan-nav" aria-label="Planning horizon">{(['now', 'next', 'later'] as const).map(lane => <button key={lane} className={!showSettings && !inboxOnly && kindFilter === 'all' && planningFilter === lane ? 'active' : ''} aria-current={!showSettings && !inboxOnly && kindFilter === 'all' && planningFilter === lane ? 'page' : undefined} aria-label={planningLaneLabels[lane]} title={planningLaneLabels[lane]} onClick={() => { closeSettings(false); clearFilters(); setPlanningFilter(lane); }}><span className={`lane-dot ${lane}`} aria-hidden="true" /><span className="sidebar-label" aria-hidden={!sidebarOpen}>{planningLaneLabels[lane]}</span><span className="count sidebar-label" aria-hidden={!sidebarOpen}>{items.filter(i => i.planningLane === lane).length}</span></button>)}</nav>
        <details className="sidebar-types sidebar-expanded-only" inert={!sidebarOpen}><summary>Browse by type</summary><nav className="kind-nav" aria-label="Item types">{kinds.filter(kind => kind !== 'idea').map(kind => <button key={kind} className={!showSettings && !inboxOnly && kindFilter === kind ? 'active' : ''} aria-current={!showSettings && !inboxOnly && kindFilter === kind ? 'page' : undefined} onClick={() => { closeSettings(false); clearFilters(); setKindFilter(kind); }}><KindIcon kind={kind} /><span>{kind === 'todo' ? 'Tasks' : kind === 'feature' ? 'Features' : 'Bugs'}</span><span className="count">{items.filter(i => i.kind === kind).length}</span></button>)}</nav></details>
        <div className="section-label tree-label sidebar-expanded-only" inert={!sidebarOpen}><span>Project outline</span><button className="icon-button" aria-label="Add top-level task" onClick={() => { closeSettings(false); addItem(); }}><Plus size={14} /></button></div><div className="project-tree sidebar-expanded-only" inert={!sidebarOpen}>{items.length ? tree(null) : <p className="sidebar-hint">Your ideas will take shape here.</p>}</div>
      </>}
      </div>
      <div className="sidebar-bottom"><button className={`sidebar-settings ${showSettings ? 'active' : ''}`} aria-label="Settings" title="Settings (⌘ ,)" aria-current={showSettings ? 'page' : undefined} onClick={() => { openSettings(); if (window.matchMedia('(max-width: 760px)').matches) setSidebarOpen(false); }}><Settings2 size={16} /><span className="sidebar-label" aria-hidden={!sidebarOpen}>Settings</span></button><div className="local-label sidebar-expanded-only" inert={!sidebarOpen}><span className="local-dot" />{native ? 'Local workspace' : 'Browser preview'}<span>v0.1</span></div></div>
    </aside>

    {sidebarOpen && <button className="sidebar-scrim" aria-label="Collapse project navigation" onClick={() => setSidebarOpen(false)} />}
    <div className="workspace-body">
    <main className="main" inert={expanded} aria-hidden={expanded || undefined}>
      {saveError && <div className="error-banner" role="alert"><span>Changes haven't saved. {saveError}</span><button onClick={() => void flush().catch(() => {})}>Retry save</button></div>}
      {showSettings ? <div className="settings-page"><div className="settings-page-heading"><h1 tabIndex={-1} ref={settingsHeadingRef}>Settings</h1><p>Make this workspace your own.</p></div><SettingsPanel key={settingsSection} appearance={appearance} onAppearance={changeAppearance} planner={planner} native={native} initialSection={settingsSection} backupBusy={busy} canExport={!!workspace.projects.length} onBackup={action => { void runBackup(action); }} /></div> : <>
      {missingFolder && <div className="folder-banner"><FolderOpen size={15} /><span>Repository folder is missing. Your planning data is still available.</span><button onClick={() => openProjectForm(project)}>Update folder</button></div>}
      {!project ? <div className="welcome"><div className="welcome-diagram" aria-hidden="true"><div className="welcome-root"><GitBranch size={25} /></div><div className="welcome-lines" /><div className="welcome-leaves"><span><Sparkles size={20} /></span><span><CheckCircle2 size={20} /></span><span><Bug size={20} /></span></div></div><h1>A little structure.<br />A clearer next step.</h1><p>A home for your ideas, features, tasks, and bugs.<br />Connect the big picture to the work in front of you.</p><button className="primary-button" onClick={() => openProjectForm()}><Plus size={17} />Create project</button><button className="text-button" onClick={() => update(() => demoWorkspace())}>Explore a demo project <ArrowUpRight size={14} /></button><div className="welcome-footnote"><span className="local-dot" />{native ? 'Stored on your Mac. Ready without an internet connection.' : 'Browser preview uses local storage. Desktop app uses SQLite.'}</div></div> : <>
        <div className="workspace-topbar">
        <div className="project-heading"><div><div className="heading-eyebrow">{project.name}</div><h1>{sectionTitle}</h1><p>{sectionHint}</p></div></div>
        <div className="workspace-toolbar">
          {view.mode === 'outline' && <button className={`select-items-button ${selecting ? 'active' : ''}`} aria-pressed={selecting} aria-label={selecting ? "Done selecting" : "Select items"} title={selecting ? "Done selecting" : "Select items"} onClick={() => { setSelecting(value => !value); setCheckedIds(new Set()); }}><SquareCheck size={16} aria-hidden="true" /></button>}
          {view.mode === 'map' && <button className="arrange-button" aria-label="Arrange" title="Arrange items" onClick={() => { const arranged = new Map(arrangeItems(items).map(i => [i.id, i])); update(w => ({ ...w, items: w.items.map(i => arranged.get(i.id) ?? i) })); setNotice('Map arranged. Use Fit view to see all branches.'); }}><GitBranch size={16} aria-hidden="true" /></button>}
          <details className="toolbar-more" ref={filtersRef}><summary aria-label="Filters" title={filterCount ? `Filters (${filterCount} active)` : "Filters"} className={filterCount ? "active" : undefined}><SlidersHorizontal size={16} aria-hidden="true" /></summary><div>
            <label>Status<select aria-label="Filter status" value={statusFilter} onChange={e => setStatusFilter(e.target.value as Status | 'all')}><option value="all">All statuses</option>{Object.entries(statusLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
            <label>Planning horizon<select aria-label="Filter planning horizon" value={planningFilter ?? 'unplanned'} onChange={event => { const value = event.target.value; setPlanningFilter(value === 'unplanned' ? null : value === 'now' || value === 'next' || value === 'later' ? value : 'all'); }}><option value="all">Any time</option><option value="unplanned">Unplanned</option>{Object.entries(planningLaneLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label>Priority<select aria-label="Filter priority" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value as Priority | 'all')}><option value="all">All priorities</option><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select></label>
            <label>Tag<select aria-label="Filter tag" value={tagFilter} onChange={e => setTagFilter(e.target.value)}><option value="">All tags</option>{tags.map(tag => <option key={tag}>{tag}</option>)}</select></label>
          </div></details>
          <div className="view-switch" aria-label="Workspace view"><button aria-label="List" aria-keyshortcuts="Meta+1 Control+1" title="List view (⌘1)" aria-pressed={view.mode === 'outline'} className={view.mode === 'outline' ? 'active' : ''} onClick={() => patchView({ mode: 'outline' })}><LayoutList size={16} aria-hidden="true" /></button><button aria-label="Map" aria-keyshortcuts="Meta+2 Control+2" title="Map view (⌘2)" aria-pressed={view.mode === 'map'} className={view.mode === 'map' ? 'active' : ''} onClick={() => patchView({ mode: 'map' })}><MapIcon size={16} aria-hidden="true" /></button><button aria-label="Board" aria-keyshortcuts="Meta+3 Control+3" disabled={inboxOnly} title={inboxOnly ? 'Turn ideas into features or tasks to track them on the board' : 'Board view (⌘3)'} aria-pressed={view.mode === 'board'} className={view.mode === 'board' ? 'active' : ''} onClick={() => patchView({ mode: 'board' })}><Columns3 size={16} aria-hidden="true" /></button></div>
        </div>
        </div>
        {planner.hasBatch && <div className="planner-batch-banner" role="status"><span>{planner.undoAvailable ? 'Last AI batch can be undone during this session.' : 'Undo unavailable while saving or after generated items change.'}</span><button className="text-button" disabled={!planner.undoAvailable} onClick={() => void planner.undo()}>Undo AI batch</button></div>}
        {!showPlanner && planner.error && <div className="error-banner" role="alert"><span>{planner.error}</span><button onClick={() => setShowPlanner(true)}>Open planner</button></div>}
        {(filterCount > 0 || planningFilter === null) && <div className="filter-summary" role="status"><span>{matching.length} {matching.length === 1 ? 'item' : 'items'}{statusFilter !== 'all' && ` · ${statusLabels[statusFilter]}`}{priorityFilter !== 'all' && ` · ${priorityFilter} priority`}{tagFilter && ` · #${tagFilter}`}{planningFilter === null && ' · Unplanned'}</span><button onClick={clearFilters}>Clear filters</button></div>}
        {checkedIds.size > 0 && <div className="group-bar"><span>{checkedItems.length} selected{!canGroup && ' · Choose at least two items inside the same parent'}</span><button className="secondary-button" disabled={!canGroup} onClick={() => { setGroupTitle(''); setShowGroupForm(true); }}>Group into feature</button><button className="text-button" onClick={() => setCheckedIds(new Set())}>Clear selection</button></div>}
        <div className="work-surface">
          {items.length === 0 ? <div className="empty-work"><Lightbulb size={32} /><h2>What are you building?</h2><p>Capture a thought with ⌘ N. Give it structure when you're ready.</p><button className="secondary-button" onClick={openCapture}>Capture your first idea</button></div> : !matching.length ? <div className="no-results"><Search size={24} /><h2>{inboxOnly && inboxEmpty ? 'Inbox is clear' : 'No matching items'}</h2><p>{inboxOnly && inboxEmpty ? 'Capture a new thought with ⌘ N, or review the work in your plan.' : 'Clear your filters to see more items.'}</p><button className="secondary-button" onClick={clearFilters}>Show all items</button></div> : view.mode === 'board' && !matching.some(item => item.kind !== 'idea') ? <div className="no-results"><Lightbulb size={26} /><h2>Your ideas are ready to shape</h2><p>The board tracks features, tasks, and bugs.<br />Open an idea to turn it into work you can track.</p><button className="secondary-button" onClick={() => { clearFilters(); setInboxOnly(true); patchView({ mode: 'outline' }); }}>Open Inbox</button></div> : view.mode === 'map' ? <MindMap key={project.id} project={project} items={items} links={links} view={filtered ? { ...view, collapsed: [] } : view} selectedId={selectedId} matchingIds={filtered ? matchingWithAncestors(items, matchingIds) : matchingIds} revealIds={revealedBatch?.projectId === project.id ? revealedBatch.ids : undefined} onSelect={id => { if (id === `root:${project.id}`) openProjectForm(project); else setSelectedId(id); }} onRename={(id, title) => patchItem(id, { title })} onAdd={parentId => addItem('todo', parentId)} onMove={(id, x, y) => patchItem(id, { x, y })} onLink={addLink} onCollapse={collapse} onViewport={viewport => patchView({ viewport })} /> : view.mode === 'board' && !inboxOnly ? <Board items={items} matchingIds={matchingIds} selectedId={selectedId} onSelect={setSelectedId} onStatus={(id, status) => patchItem(id, { status })} /> : <Outline items={items} matchingIds={matchingIds} filtered={filtered} selecting={selecting} view={view} selectedId={selectedId} checkedIds={checkedIds} onSelect={setSelectedId} onStatus={(id, status) => patchItem(id, { status })} onPlan={(id, planningLane) => patchItem(id, { planningLane })} onCheck={(id, checked) => setCheckedIds(current => { const next = new Set(current); if (checked) next.add(id); else next.delete(id); return next; })} onCollapse={collapse} onMove={move} />}
          <div className="new-item-wrap" ref={newMenuRef}><button className="primary-button new-item-button" aria-label="New item" title="New item" aria-controls="new-item-menu" aria-expanded={showNewMenu} onClick={() => setShowNewMenu(v => !v)}><Plus size={23} aria-hidden="true" /></button>{showNewMenu && <div className="new-item-menu" id="new-item-menu"><button onClick={() => openPlanner()}><Sparkles size={15} /><span><strong>Plan with AI</strong><small>Turn an idea into a plan</small></span></button>{kinds.map(kind => <button key={kind} onClick={() => addItem(kind)}><KindIcon kind={kind} /><span><strong>{kindLabels[kind]}</strong><small>{({ idea: 'A thought to explore', feature: 'An outcome with tasks', todo: 'A specific piece of work', bug: 'Something to fix' })[kind]}</small></span></button>)}</div>}</div>
        </div><footer className="workspace-footer"><span>{`${matching.length} ${matching.length === 1 ? 'item' : 'items'} · ${completion} completed in project`}{view.mode === 'map' && ' · Drag to move · Connect to relate'}</span><span><kbd>⌘ N</kbd> Capture idea <kbd>⌘ K</kbd> Search</span></footer>
      </>}
      </>}
    </main>

    <div className="inspector-slot">
    <aside id="item-details" className="inspector" aria-label="Item details" inert={!inspectorOpen} aria-hidden={!inspectorOpen}>
      {inspectorItem && <>
      <div className="inspector-top"><span className={`kind-icon ${inspectorItem.kind}`}><KindIcon kind={inspectorItem.kind} /></span><span>{kindLabels[inspectorItem.kind]}</span><div className="inspector-actions"><button className="icon-button" aria-label={expanded ? 'Restore item details sidebar' : 'Expand item details'} title={expanded ? 'Restore sidebar' : 'Expand item details'} aria-expanded={expanded} aria-controls="item-details" onClick={() => setInspectorExpanded(value => !value)}>{expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button><button className="icon-button" aria-label="Close item details" onClick={closeInspector}><PanelRightClose size={17} /></button></div></div>
      {expanded && saveError && <div className="error-banner" role="alert"><span>Changes haven't saved. {saveError}</span><button onClick={() => void flush().catch(() => {})}>Retry save</button></div>}
      <div className="inspector-content">
        <TitleEditor key={`title:${inspectorItem.id}`} autoFocus={focusTitleId === inspectorItem.id} title={inspectorItem.title} onChange={title => patchItem(inspectorItem.id, { title })} />
        {inspectorItem.kind === 'idea' && <section className="shape-idea" aria-label="Organize this idea"><h2>Ready to shape this idea?</h2><p>Make it a feature for a bigger outcome, or a task for one clear action.</p><div>{(['feature', 'todo'] as const).map(kind => <button key={kind} className="secondary-button" onClick={() => { patchItem(inspectorItem.id, { kind }); clearFilters(); setNotice(`Idea turned into a ${kind === 'todo' ? 'task' : 'feature'}.`); }}><KindIcon kind={kind} />Make a {kind === 'todo' ? 'task' : 'feature'}</button>)}</div></section>}
        <div className="planning-picker"><h2>When do you want to work on this?</h2><div role="group" aria-label="Item planning horizon">{([null, 'now', 'next', 'later'] as const).map(lane => <button key={lane ?? 'unplanned'} aria-pressed={inspectorItem.planningLane === lane} onClick={() => patchItem(inspectorItem.id, { planningLane: lane })}>{lane ? planningLaneLabels[lane] : 'Unplanned'}</button>)}</div></div>
        <div className="item-properties">
          <label><span>Type</span><select aria-label="Item type" value={inspectorItem.kind} onChange={event => { const value = kinds.find(kind => kind === event.target.value); if (value) patchItem(inspectorItem.id, { kind: value }); }}>{kinds.map(kind => <option value={kind} key={kind}>{kindLabels[kind]}</option>)}</select></label>
          {inspectorItem.kind !== 'idea' && <label><span>Status</span><select aria-label="Item status" value={inspectorItem.status} onChange={event => { const value = event.target.value; if (value === 'todo' || value === 'in_progress' || value === 'done') patchItem(inspectorItem.id, { status: value }); }}>{Object.entries(statusLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>}
        </div>
        <details className="detail-section"><summary>Organize & move</summary><div className="item-properties">
          <label><span>Inside</span><select aria-label="Item parent" value={inspectorItem.parentId ?? ''} onChange={event => move(inspectorItem.id, event.target.value || null)}><option value="">Project level</option>{items.filter(item => !invalidParents.has(item.id)).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
          <div className="item-reorder"><button className="secondary-button" disabled={items.filter(item => item.parentId === inspectorItem.parentId)[0]?.id === inspectorItem.id} onClick={() => reorder(inspectorItem.id, -1)}><ArrowUp size={13} />Move up</button><button className="secondary-button" disabled={items.filter(item => item.parentId === inspectorItem.parentId).at(-1)?.id === inspectorItem.id} onClick={() => reorder(inspectorItem.id, 1)}><ArrowDown size={13} />Move down</button></div>
        </div></details>
        {(inspectorItem.kind !== 'idea' || items.some(item => item.parentId === inspectorItem.id)) && <section className="child-section" aria-label="Child items"><h2>{inspectorItem.kind === 'feature' ? 'Tasks and bugs' : 'Child items'}<span>{items.filter(item => item.parentId === inspectorItem.id).length}</span></h2>
          <div className="child-items">{items.filter(item => item.parentId === inspectorItem.id).map(item => <button key={item.id} onClick={() => setSelectedId(item.id)}><span className={`kind-icon ${item.kind}`}><KindIcon kind={item.kind} /></span><span className={item.status === 'done' ? 'completed' : ''}>{item.title}</span><StatusIcon status={item.status} /></button>)}</div>
          <div className="child-actions"><button className="secondary-button" onClick={() => addItem('todo', inspectorItem.id)}><Plus size={13} />Add task</button><button className="secondary-button" onClick={() => addItem('bug', inspectorItem.id)}><Bug size={13} />Add bug</button></div>
        </section>}
        <div className="notes-heading"><h2>Notes</h2><div className="small-switch"><button className={!previewNotes ? 'active' : ''} aria-pressed={!previewNotes} onClick={() => setPreviewNotes(false)}>Edit</button><button className={previewNotes ? 'active' : ''} aria-pressed={previewNotes} onClick={() => setPreviewNotes(true)}>Preview</button></div></div>
        {previewNotes ? <div className="markdown-preview"><ReactMarkdown skipHtml components={{ a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>, img: ({ alt }) => <span>[Image: {alt ?? ''}]</span> }}>{inspectorItem.notes || '*No notes yet.*'}</ReactMarkdown></div> : <textarea className="notes-editor" aria-label="Item notes" placeholder={'What should future you know?\n\nMarkdown supported.'} value={inspectorItem.notes} onChange={event => patchItem(inspectorItem.id, { notes: event.target.value })} />}
        <ItemPlanning key={`planning:${inspectorItem.id}`} item={inspectorItem} onChange={details => patchItem(inspectorItem.id, { details })} />
        <details className="detail-section"><summary>Additional details</summary><div className="item-properties">
          <label><span>Priority</span><select aria-label="Item priority" value={inspectorItem.priority} onChange={event => { const value = event.target.value; if (value === 'low' || value === 'normal' || value === 'high') patchItem(inspectorItem.id, { priority: value }); }}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label>
          <label><span>Tags</span><TagsEditor key={inspectorItem.id} tags={inspectorItem.tags} onChange={tags => patchItem(inspectorItem.id, { tags })} /></label>
        </div></details>
        <details className="detail-section"><summary><Link2 size={14} />Related items<span>{links.filter(link => link.sourceId === inspectorItem.id || link.targetId === inspectorItem.id).length}</span></summary>
          <div className="related-items">{links.filter(link => link.sourceId === inspectorItem.id || link.targetId === inspectorItem.id).map(link => { const other = items.find(item => item.id === (link.sourceId === inspectorItem.id ? link.targetId : link.sourceId)); return other && <div className="related-row" key={link.id}><button onClick={() => setSelectedId(other.id)}><KindIcon kind={other.kind} /><span>{other.title}</span></button><button className="icon-button" aria-label={`Remove relation to ${other.title}`} onClick={() => update(w => ({ ...w, links: w.links.filter(existing => existing.id !== link.id) }))}><X size={13} /></button></div>; })}</div>
          <div className="relate-controls"><select aria-label="Select related item" value={relatedTarget} onChange={event => setRelatedTarget(event.target.value)}><option value="">Link an item…</option>{items.filter(item => item.id !== inspectorItem.id && !links.some(link => (link.sourceId === inspectorItem.id && link.targetId === item.id) || (link.targetId === inspectorItem.id && link.sourceId === item.id))).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select><button className="icon-button" aria-label="Add related link" disabled={!relatedTarget} onClick={() => addLink(inspectorItem.id, relatedTarget)}><Plus size={16} /></button></div>
        </details>
        <div className="contextual-ai"><h2><Sparkles size={14} />Plan this item</h2><button onClick={() => openPlanner('clarify')}>Clarify idea</button><button onClick={() => openPlanner('requirements')}>Find missing requirements</button><button onClick={() => openPlanner('tasks')}>Break into tasks</button></div>
        <div className="item-metadata">Updated {new Date(inspectorItem.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div><button className="delete-button" onClick={() => setDeleting({ type: 'item', id: inspectorItem.id, title: inspectorItem.title })}><Trash2 size={14} />Delete item</button>
      </div>
      </>}
    </aside>
    </div>
    {showCapture && project && <div className="capture-composer" ref={captureDialogRef} role="dialog" aria-label="Capture idea" aria-describedby="capture-hint">
      <form onSubmit={event => { event.preventDefault(); capture(); }}>
        <button type="button" className="capture-action" aria-label="More actions" title="More actions" onClick={openPalette}><Plus size={23} /></button>
        <textarea id="capture-idea" ref={captureRef} aria-label="Add idea" placeholder="Capture an idea" rows={Math.min(3, captureText.split('\n').length)} value={captureText} maxLength={300} onChange={event => setCaptureText(event.target.value)} onKeyDown={event => { if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return; if (event.key === 'Enter' && (!event.shiftKey || event.metaKey || event.ctrlKey)) { event.preventDefault(); capture(); } }} />
        <button type="button" className="capture-action" aria-label="Dictation settings" title="Dictation settings" onClick={() => openSettings('general')}><Mic size={20} /></button>
        <button type="submit" className="capture-send" aria-label="Save idea" title="Save idea" disabled={!captureText.trim()}><ArrowUp size={21} /></button>
        <span id="capture-hint" className="capture-hint">Saved to Inbox. Enter to save. Shift Enter for a new line. Escape to close.</span>
      </form>
    </div>}
    {showPalette && <div className="capture-composer search-composer" ref={paletteRef} role="dialog" aria-label="Search & actions" aria-describedby="search-hint"><div className="palette-input"><Search size={21} aria-hidden="true" /><input ref={paletteInputRef} aria-label="Search actions and items" aria-controls={paletteQuery.trim() ? "search-results" : undefined} placeholder="Search this project…" value={paletteQuery} onChange={e => setPaletteQuery(e.target.value)} onKeyDown={event => { if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return; if (event.key === 'Enter') { event.preventDefault(); paletteRef.current?.querySelector<HTMLButtonElement>('.palette-results button')?.click(); } }} /></div>{paletteQuery.trim() && <div id="search-results" className="palette-results" aria-label="Search results">{items.filter(i => itemSearchText(i).toLowerCase().includes(paletteQuery.toLowerCase())).slice(0, 40).map(i => <button key={i.id} onClick={() => { setSelectedId(i.id); closePalette(); }}><KindIcon kind={i.kind} /><span>{i.title}</span></button>)}{paletteQuery && !items.some(i => itemSearchText(i).toLowerCase().includes(paletteQuery.toLowerCase())) && <p>No matching items in this project.</p>}</div>}<span id="search-hint" className="capture-hint">Enter to open the first result. Escape to close.</span></div>}
    </div>

    {showPlanner && project && <Dialog title={`Plan ${project.name}`} close={closePlanner}><PlannerComposer native={native} connection={planner.connection} phase={planner.phase} message={planner.message} error={planner.error} prompt={planner.prompt} model={planner.model} existingItems={items} preview={planner.preview} action={planner.action} selectedTitle={selected?.title} onActionChange={planner.setAction} onApply={() => void planner.apply()} onDiscard={planner.discard} onPreviewChange={planner.setPreview} onPromptChange={planner.setPrompt} onGenerate={() => void planner.generate()} onCancel={() => void planner.cancel()} onRetrySave={saveError ? () => void planner.retrySave() : undefined} /></Dialog>}
    {showGroupForm && <Dialog title="Group into feature" close={() => setShowGroupForm(false)}><form onSubmit={event => { event.preventDefault(); if (!groupTitle.trim() || !canGroup) return; try { let featureId = ''; update(w => { const result = groupItems(w, [...checkedIds], groupTitle); featureId = result.featureId; return result.workspace; }); setSelectedId(featureId); setFocusTitleId(featureId); setCheckedIds(new Set()); setSelecting(false); clearFilters(); setShowGroupForm(false); } catch (error) { setNotice(errorText(error)); } }}><label className="form-field">Feature title<input required maxLength={300} value={groupTitle} onChange={event => setGroupTitle(event.target.value)} /></label><div className="dialog-actions"><button type="button" className="secondary-button" onClick={() => setShowGroupForm(false)}>Cancel</button><button className="primary-button" disabled={!groupTitle.trim() || !canGroup}>Create feature</button></div></form></Dialog>}
    {showProjectForm && <Dialog title={editingProject ? 'Project settings' : 'Create project'} close={() => setShowProjectForm(false)}><form onSubmit={e => { e.preventDefault(); if (!projectName.trim()) return; const id = editingProject ?? crypto.randomUUID(); update(w => ({ ...w, projects: editingProject ? w.projects.map(p => p.id === id ? { ...p, name: projectName.trim(), folder: projectFolder } : p) : [...w.projects, { id, name: projectName.trim(), folder: projectFolder, createdAt: new Date().toISOString() }], activeProjectId: id, views: { ...w.views, [id]: w.views[id] ?? defaultView() } })); setShowProjectForm(false); }}><label className="form-field">Project name<input required maxLength={200} placeholder="e.g. My next great app" value={projectName} onChange={e => setProjectName(e.target.value)} /></label><label className="form-field">Repository folder<span className="folder-picker"><input aria-label="Repository folder" placeholder={native ? 'Choose a local repository' : 'Optional path for browser preview'} value={projectFolder} readOnly={native} onChange={e => setProjectFolder(e.target.value)} /><button type="button" className="secondary-button" aria-label="Choose repository folder" disabled={!native} onClick={async () => { try { const folder = await chooseFolder(); if (folder) { setProjectFolder(folder); if (!projectName) setProjectName(folder.split('/').filter(Boolean).at(-1) ?? ''); } } catch (error) { setNotice(errorText(error)); } }}><FolderOpen size={15} />Choose</button></span></label><p className="form-hint">Folder association is optional. Your repository files stay untouched.</p><div className="dialog-actions">{editingProject && <button type="button" className="delete-button" onClick={() => { setShowProjectForm(false); setDeleting({ type: 'project', id: editingProject, title: projectName }); }}><Trash2 size={14} />Delete project</button>}<button type="button" className="secondary-button" onClick={() => setShowProjectForm(false)}>Cancel</button><button className="primary-button" disabled={!projectName.trim()}>{editingProject ? 'Save settings' : 'Create project'}</button></div></form></Dialog>}
    {deleting && <Dialog title={deleting.type === 'project' ? 'Delete project?' : 'Delete this branch?'} close={() => setDeleting(null)}><p className="delete-description">“{deleting.title}” and {deleting.type === 'project' ? workspace.items.filter(i => i.projectId === deleting.id).length : descendants(workspace.items, deleting.id).size} {deleting.type === 'project' ? 'items' : 'descendant items'} will be permanently deleted, including their related links. Export a backup first if you need a copy.</p><div className="dialog-actions"><button className="secondary-button" onClick={() => setDeleting(null)}>Cancel</button><button className="danger-button" onClick={deleteConfirmed}>Delete {deleting.type === 'project' ? 'project' : 'branch'}</button></div></Dialog>}

    {notice && <div className="toast" role="status"><span>{notice}</span>{notice === 'Idea saved to Inbox.' && capturedId && <button className="toast-action" onClick={() => { setSelectedId(capturedId); setNotice(''); }}>Organize idea<ArrowUpRight size={14} /></button>}<button aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={15} /></button></div>}
  </div>;
}
