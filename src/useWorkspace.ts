import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { emptyWorkspace, type Workspace } from './domain';
import { loadWorkspace, native, saveWorkspace } from './persistence';

export function useWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace>(emptyWorkspace);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved');
  const latest = useRef(workspace), revision = useRef(0), savedRevision = useRef(0);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const load = useCallback(async () => {
    setLoadError('');
    try { const data = await loadWorkspace(); latest.current = data; setWorkspace(data); setLoaded(true); }
    catch (error) { setLoadError(String(error instanceof Error ? error.message : error)); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const update = useCallback((change: (value: Workspace) => Workspace) => {
    const next = change(latest.current);
    latest.current = next; revision.current++; setWorkspace(next); setSaveStatus('unsaved');
  }, []);
  const flush = useCallback((): Promise<void> => {
    const run = async () => {
      try {
        while (savedRevision.current < revision.current) {
          const targetRevision = revision.current, snapshot = latest.current;
          setSaveStatus('saving'); await saveWorkspace(snapshot); savedRevision.current = targetRevision;
        }
        setSaveError(''); setSaveStatus('saved');
      } catch (error) {
        setSaveStatus('error'); setSaveError(String(error instanceof Error ? error.message : error)); throw error;
      }
    };
    const next = queue.current.catch(() => {}).then(run);
    queue.current = next; return next;
  }, []);
  useEffect(() => {
    if (!loaded || revision.current === savedRevision.current) return;
    const timer = setTimeout(() => { void flush().catch(() => {}); }, 450);
    return () => clearTimeout(timer);
  }, [workspace, loaded, flush]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (revision.current > savedRevision.current) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', beforeUnload);
    let disposed = false;
    let unlisten: (() => void) | undefined;
    let unlistenQuit: (() => void) | undefined;
    if (native) {
      void import('@tauri-apps/api/window').then(async ({ getCurrentWindow }) => {
        const window = getCurrentWindow(); let allowClose = false;
        const off = await window.onCloseRequested(async event => {
          if (allowClose || revision.current === savedRevision.current) return;
          event.preventDefault();
          try { await flush(); allowClose = true; await window.close(); } catch { /* Error remains visible in the open window. */ }
        });
        if (disposed) off(); else unlisten = off;
      });
      void import('@tauri-apps/api/event').then(async ({ listen }) => {
        const off = await listen('planner-quit-requested', async () => {
          try { await flush(); await invoke('finish_quit'); } catch { /* Failed saves keep the app open. */ }
        });
        if (disposed) off(); else unlistenQuit = off;
      });
    }
    return () => { disposed = true; unlisten?.(); unlistenQuit?.(); window.removeEventListener('beforeunload', beforeUnload); };
  }, [flush]);
  return { workspace, update, loaded, loadError, saveError, saveStatus, flush, load };
}
