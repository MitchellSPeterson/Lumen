import { useEffect, useRef, useState } from 'react';
import { cancelCodex, connectCodex, disconnectCodex, generatePlan, type AgentConnection, type PlannerPhase } from './agent';
import { applyPlannerDraft, buildPlannerContext, canUndoPlannerBatch, undoPlannerBatch, type PlannerBatch } from './planner';
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
    if (!projectId || !prompt.trim() || prompt.length > 8000) return;
    const active = { id: crypto.randomUUID(), kind: 'generate' as 'generate' | 'save', cancelled: false };
    operation.current = active; setPhase('generating'); setError(''); setMessage('Planning…');
    let applied = false;
    try {
      await latest.current.flush();
      if (active.cancelled || operation.current !== active || latest.current.projectId !== projectId) return;
      const context = buildPlannerContext(latest.current.current(), projectId, latest.current.selectedId);
      const draft = await generatePlan(active.id, model, prompt.trim(), context);
      if (!mounted.current || active.cancelled || operation.current !== active) return;
      const current = latest.current.current();
      const currentProject = current.projects.find(project => project.id === current.activeProjectId) ?? current.projects[0];
      if (latest.current.projectId !== projectId || currentProject?.id !== projectId) throw new Error('Project changed. Generate again in the current project.');
      let created: PlannerBatch | null = null;
      latest.current.update(workspace => {
        const result = applyPlannerDraft(workspace, projectId, draft);
        created = result.batch;
        return result.workspace;
      });
      // update invokes the callback synchronously against the latest workspace.
      const additions = created as PlannerBatch | null;
      if (!additions || (!additions.items.length && !additions.links.length)) { setMessage('No new items or links were needed.'); return; }
      applied = true;
      pendingReveal.current = { projectId, ids: additions.items.map(item => item.id) };
      active.kind = 'save'; setBatch(additions); setPhase('saving'); setMessage('Saving planner…');
      await latest.current.flush();
      if (!mounted.current) return;
      const summary = `Created ${additions.items.length} items and ${additions.links.length} links. Saved locally.`;
      setMessage(summary);
      pendingReveal.current = null;
      if (latest.current.projectId === projectId) latest.current.onCreated(additions.items.map(item => item.id), summary);
    } catch (failure) {
      if (mounted.current && !active.cancelled && operation.current === active) {
        setError(applied ? `Planner created but not saved. Use Retry save; generation will not run again. ${errorText(failure)}` : errorText(failure));
        setMessage('');
      }
    } finally {
      if (operation.current === active && !active.cancelled) { operation.current = null; if (mounted.current) setPhase('idle'); }
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
      setMessage('Generated batch removed. Saved locally.');
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
  return { connection, phase, message, error, prompt, setPrompt, model, setModel, executable, setExecutable, connect, disconnect, generate, cancel, undo, retrySave, undoAvailable, hasBatch: !!batch };
}
