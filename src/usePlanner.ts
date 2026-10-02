import { useEffect, useRef, useState } from 'react';
import { cancelCodex, connectCodex, disconnectCodex, generatePlan, type AgentConnection, type PlannerPhase } from './agent';
import { applyPlannerDraft, buildPlannerContext, canUndoPlannerBatch, undoPlannerBatch, parsePlannerDraft, type PlannerAction, type PlannerDraft, type PlannerScope, type PlannerBatch } from './planner';
import type { Workspace } from './domain';

interface Options {
  workspace: Workspace;
  projectId: string | null;
  selectedId: string | null;
  current: () => Workspace;
  update: (change: (workspace: Workspace) => Workspace) => void;
  flush: () => Promise<void>;
  saveError: string;
  onCreated: (ids: string[], message: string) => void;
}
const preferenceKey = 'codebase-planner-model';
const executablePreferenceKey = 'codebase-planner-executable';
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);
function rememberedModel() {
  try { return localStorage.getItem(preferenceKey) ?? ''; } catch { return ''; }
}
function rememberedExecutable() {
  try { return localStorage.getItem(executablePreferenceKey) ?? ''; } catch { return ''; }
}

export function usePlanner(options: Options) {
  const latest = useRef(options);
  latest.current = options;
  const [connection, setConnection] = useState<AgentConnection | null>(null);
  const [phase, setPhase] = useState<PlannerPhase>('idle');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [prompt, setPrompt] = useState('');
  const [model, setModelValue] = useState(rememberedModel);
  const [executable, setExecutableValue] = useState(rememberedExecutable);
  const [action, setActionValue] = useState<PlannerAction>('project');
  const [preview, setPreviewValue] = useState<PlannerDraft | null>(null);
  const previewRef = useRef<PlannerDraft | null>(null);
  const previewScope = useRef<{ projectId: string; scope: PlannerScope } | null>(null);
  function clearPreview() { previewRef.current = null; previewScope.current = null; setPreviewValue(null); }
  function setPreview(value: PlannerDraft) {
    if (operation.current || !previewRef.current) return;
    previewRef.current = value;
    setPreviewValue(value);
    setError('');
  }
  function setAction(value: PlannerAction) {
    if (operation.current) return;
    setActionValue(value);
    clearPreview();
    const prompts: Record<PlannerAction, string> = {
      clarify: 'Clarify this idea. Identify its problem, intended outcome, and open questions. Propose an update to the selected item’s planning notes only.',
      requirements: 'Draft concrete requirements and testable acceptance criteria for the selected item. Preserve existing decisions and checked criteria. Propose an update to its planning details.',
      tasks: 'Break the selected item into small implementation tasks with clear outcomes. Propose child tasks, preserving the existing item.',
      project: '',
    };
    if (value !== 'project') setPrompt(prompts[value]);
  }
  function discard() { clearPreview(); setError(''); setMessage('Preview discarded.'); void cancel(); }
  const [batch, setBatch] = useState<PlannerBatch | null>(null);
  const operation = useRef<{ id: string; kind: 'connect' | 'generate' | 'save'; cancelled: boolean } | null>(null);
  const mounted = useRef(true);
  const pendingReveal = useRef<{ projectId: string; ids: string[] } | null>(null);

  function setModel(value: string) {
    setModelValue(value);
    try { localStorage.setItem(preferenceKey, value); } catch { /* Selection still works for this session. */ }
  }
  function setExecutable(value: string) {
    setExecutableValue(value);
    try { localStorage.setItem(executablePreferenceKey, value); } catch { /* Selection still works for this session. */ }
  }
  async function cancel() {
    clearPreview();
    const active = operation.current;
    if (!active || active.kind === 'save' || active.cancelled) return;
    active.cancelled = true;
    setMessage('Cancelling…');
    try { await cancelCodex(active.kind === 'generate' ? active.id : null); }
    catch (failure) { if (mounted.current) setError(errorText(failure)); }
    finally {
      if (operation.current === active) {
        operation.current = null;
        if (mounted.current) { setPhase('idle'); setMessage('Cancelled. Your planner has not changed.'); }
      }
    }
  }
  useEffect(() => {
    void cancel();
    setBatch(null);
    setActionValue('project');
  }, [options.projectId]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const active = operation.current;
      if (active && active.kind !== 'save') {
        active.cancelled = true;
        void cancelCodex(active.kind === 'generate' ? active.id : null).catch(() => {});
      }
    };
  }, []);

  async function connect(signIn = false) {
    if (operation.current) return;
    const active = { id: crypto.randomUUID(), kind: 'connect' as const, cancelled: false };
    operation.current = active;
    setPhase(signIn ? 'signing-in' : 'connecting'); setError('');
    setMessage(signIn ? 'Complete sign-in in your browser…' : 'Connecting to Codex…');
    try {
      const result = await connectCodex(executable, signIn);
      if (!mounted.current || active.cancelled || operation.current !== active) return;
      setConnection(result);
      if (!model) {
        const luna = result.models.find(candidate => /luna/i.test(candidate.id));
        if (luna) setModel(luna.id);
      }
      setMessage(result.connected ? 'Codex connected. Model access is checked when you generate.' : 'Continue with ChatGPT to use your subscription.');
    } catch (failure) {
      if (mounted.current && !active.cancelled && operation.current === active) { setConnection(null); setError(errorText(failure)); setMessage(''); }
    } finally {
      if (operation.current === active && !active.cancelled) { operation.current = null; if (mounted.current) setPhase('idle'); }
    }
  }

  async function generate() {
    if (operation.current || latest.current.saveError || !connection?.connected || !connection.models.some(candidate => candidate.id === model)) return;
    const projectId = latest.current.projectId;
    const selectedId = action === 'project' ? null : latest.current.selectedId;
    if (!projectId || !prompt.trim() || prompt.length > 8000) return;
    if (action !== 'project' && !selectedId) { setError('Select an item for this planning action.'); return; }
    clearPreview();
    const active = { id: crypto.randomUUID(), kind: 'generate' as const, cancelled: false };
    operation.current = active; setPhase('generating'); setError(''); setMessage('Planning…');
    try {
      await latest.current.flush();
      if (active.cancelled || operation.current !== active || latest.current.projectId !== projectId) return;
      const current = latest.current.current();
      const scope: PlannerScope = { selectedId, baseline: selectedId ? structuredClone(current.items.find(item => item.id === selectedId) ?? null) : null };
      const context = buildPlannerContext(current, projectId, selectedId, action);
      const value = await generatePlan(active.id, model, prompt.trim(), context);
      if (!mounted.current || active.cancelled || operation.current !== active || latest.current.projectId !== projectId) return;
      if (selectedId && latest.current.selectedId !== selectedId) throw new Error('Selection changed. Generate again for the selected item.');
      const draft = parsePlannerDraft(value);
      // Validate the complete proposal without committing its temporary result.
      applyPlannerDraft(latest.current.current(), projectId, draft, scope);
      previewScope.current = { projectId, scope };
      previewRef.current = draft;
      setPreviewValue(draft);
      setMessage('Review and edit the proposal, then Apply.');
    } catch (failure) {
      if (mounted.current && !active.cancelled && operation.current === active) { setError(errorText(failure)); setMessage(''); }
    } finally {
      if (operation.current === active && !active.cancelled) { operation.current = null; if (mounted.current) setPhase('idle'); }
    }
  }

  async function apply() {
    const proposal = previewRef.current;
    const target = previewScope.current;
    if (!proposal || !target || operation.current || latest.current.saveError) return;
    if (target.scope.selectedId && latest.current.selectedId !== target.scope.selectedId) { setError('Selection changed. Discard this preview and generate again.'); return; }
    if (latest.current.projectId !== target.projectId) { clearPreview(); setError('Project changed. Generate again.'); return; }
    const active = { id: crypto.randomUUID(), kind: 'save' as const, cancelled: false };
    operation.current = active; setPhase('saving'); setError('');
    let applied = false;
    try {
      let additions: PlannerBatch | null = null;
      latest.current.update(workspace => {
        if (latest.current.projectId !== target.projectId) throw new Error('Project changed. Generate again.');
        const result = applyPlannerDraft(workspace, target.projectId, proposal, target.scope);
        additions = result.batch;
        return result.workspace;
      });
      const saved = additions as PlannerBatch | null;
      if (!saved) throw new Error('Plan was not applied.');
      applied = true;
      clearPreview();
      setBatch(saved);
      pendingReveal.current = { projectId: target.projectId, ids: saved.items.map(item => item.id) };
      await latest.current.flush();
      if (!mounted.current) return;
      const summary = `Applied ${saved.items.length} items, ${saved.links.length} links${saved.updates?.length ? ', and selected-item planning details' : ''}. Saved locally.`;
      setMessage(summary);
      pendingReveal.current = null;
      if (latest.current.projectId === target.projectId) latest.current.onCreated(saved.items.map(item => item.id), summary);
    } catch (failure) {
      if (mounted.current) { setError(applied ? `Plan applied but not saved. Use Retry save; the plan will not be applied again. ${errorText(failure)}` : errorText(failure)); setMessage(''); }
    } finally {
      if (operation.current === active) { operation.current = null; if (mounted.current) setPhase('idle'); }
    }
  }

  async function disconnect() {
    if (operation.current) return;
    const active = { id: crypto.randomUUID(), kind: 'save' as const, cancelled: false };
    operation.current = active; setPhase('signing-out'); setError(''); setMessage('Signing out…');
    try { await disconnectCodex(); if (mounted.current) setMessage('Signed out of ChatGPT.'); }
    catch (failure) { if (mounted.current) { setError(errorText(failure)); setMessage(''); } }
    finally {
      operation.current = null;
      if (mounted.current) { setConnection(null); setPhase('idle'); }
    }
  }

  async function undo() {
    if (!batch || operation.current) return;
    const active = { id: crypto.randomUUID(), kind: 'save' as const, cancelled: false };
    operation.current = active; setPhase('saving'); setError('');
    try {
      latest.current.update(workspace => undoPlannerBatch(workspace, batch));
      pendingReveal.current = null;
      setBatch(null);
      await latest.current.flush();
      setMessage('Applied plan undone. Saved locally.');
    } catch (failure) { if (mounted.current) setError(errorText(failure)); }
    finally { operation.current = null; if (mounted.current) setPhase('idle'); }
  }

  async function retrySave() {
    if (operation.current) return;
    const active = { id: crypto.randomUUID(), kind: 'save' as const, cancelled: false };
    operation.current = active; setPhase('saving'); setError('');
    try {
      await latest.current.flush();
      if (!mounted.current) return;
      setMessage('Changes saved locally.');
      const reveal = pendingReveal.current;
      pendingReveal.current = null;
      if (reveal && reveal.projectId === latest.current.projectId) latest.current.onCreated(reveal.ids, 'Planner saved locally.');
    }
    catch (failure) { if (mounted.current) setError(`Changes remain unsaved. ${errorText(failure)}`); }
    finally { operation.current = null; if (mounted.current) setPhase('idle'); }
  }

  const undoAvailable = !!batch && canUndoPlannerBatch(options.workspace, batch) && phase === 'idle';
  return { action, setAction, preview, setPreview, apply, discard, connection, phase, message, error, prompt, setPrompt, model, setModel, executable, setExecutable, connect, disconnect, generate, cancel, undo, retrySave, undoAvailable, hasBatch: !!batch };
}
