import { invoke, isTauri } from '@tauri-apps/api/core';
import { emptyWorkspace, validateWorkspace, type Workspace } from './domain';

export const native = isTauri();
const storageKey = 'codebase-planner-preview-v1';
export async function loadWorkspace(): Promise<Workspace> {
  const value = native ? await invoke<Workspace>('load_workspace') : JSON.parse(localStorage.getItem(storageKey) ?? JSON.stringify(emptyWorkspace()));
  validateWorkspace(value);
  return value;
}
export async function saveWorkspace(workspace: Workspace): Promise<void> {
  validateWorkspace(workspace);
  if (native) await invoke('save_workspace', { workspace });
  else localStorage.setItem(storageKey, JSON.stringify(workspace));
}
export const chooseFolder = (): Promise<string | null> => native ? invoke('choose_project_folder') : Promise.resolve(null);
export const inspectFolder = (folder: string): Promise<boolean> => native ? invoke('inspect_folder', { folder }) : Promise.resolve(true);
export async function exportWorkspace(workspace: Workspace): Promise<string | null> {
  if (native) return invoke('export_workspace');
  const url = URL.createObjectURL(new Blob([JSON.stringify(workspace, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = 'codebase-planner-backup.json'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return anchor.download;
}
export async function importWorkspace(): Promise<Workspace | null> {
  if (native) return invoke('import_workspace');
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json,application/json';
    input.oncancel = () => resolve(null);
    input.onchange = async () => {
      try {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        if (file.size > 10 * 1024 * 1024) throw new Error('Backup exceeds the 10 MB limit.');
        const value: unknown = JSON.parse(await file.text()); validateWorkspace(value); resolve(value);
      } catch (error) { reject(error); }
    };
    input.click();
  });
}
