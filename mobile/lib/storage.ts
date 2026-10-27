import { File, Paths } from 'expo-file-system';
import { accents } from '@shared/appearance';
import { emptyWorkspace, normalizeWorkspace, validateWorkspace, type Workspace } from '@shared/domain';

export type AccentId = (typeof accents)[number]['id'];
export interface Prefs { mode: 'system' | 'light' | 'dark'; accent: AccentId }
export const defaultPrefs: Prefs = { mode: 'system', accent: 'blue' };

const file = (name: string) => new File(Paths.document, name);
const put = (f: File, text: string) => { f.create({ overwrite: true }); f.write(text); };

/** Missing -> empty workspace. Corrupt -> keeps a .corrupt copy and throws (never overwrites silently). */
export async function loadWorkspace(): Promise<Workspace> {
  const f = file('workspace.json');
  if (!f.exists) return emptyWorkspace();
  const text = await f.text();
  try {
    return normalizeWorkspace(JSON.parse(text));
  } catch (error) {
    const copy = file('workspace.corrupt.json');
    try { put(copy, text); } catch { /* best effort */ }
    throw new Error(`Couldn't read workspace.json (${error instanceof Error ? error.message : error}). A copy was kept as workspace.corrupt.json.`);
  }
}

/** Atomic: write tmp, then move over the target. */
export async function saveWorkspace(workspace: Workspace): Promise<void> {
  validateWorkspace(workspace);
  const tmp = file('workspace.json.tmp');
  put(tmp, JSON.stringify(workspace));
  await tmp.move(file('workspace.json'), { overwrite: true });
}

export async function loadPrefs(): Promise<Prefs> {
  try {
    const f = file('prefs.json');
    if (!f.exists) return defaultPrefs;
    const v = JSON.parse(await f.text());
    return {
      mode: v?.mode === 'light' || v?.mode === 'dark' ? v.mode : 'system',
      accent: accents.find(a => a.id === v?.accent)?.id ?? 'blue',
    };
  } catch { return defaultPrefs; }
}

export function savePrefs(prefs: Prefs): void {
  try { put(file('prefs.json'), JSON.stringify(prefs)); } catch { /* prefs are non-critical */ }
}
