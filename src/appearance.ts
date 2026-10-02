export const accents = [
  { id: 'blue', label: 'Light blue' },
  { id: 'violet', label: 'Violet' },
  { id: 'green', label: 'Green' },
  { id: 'rose', label: 'Rose' },
  { id: 'amber', label: 'Amber' },
] as const;
export type Appearance = { mode: 'light' | 'dark'; accent: typeof accents[number]['id'] };
const storageKey = 'codebase-planner-appearance';

export function readAppearance(storage?: Pick<Storage, 'getItem'>): Appearance {
  const defaults: Appearance = { mode: 'light', accent: 'blue' };
  try {
    const stored: unknown = JSON.parse((storage ?? localStorage).getItem(storageKey) ?? 'null');
    if (!stored || typeof stored !== 'object') return defaults;
    const mode = 'mode' in stored && stored.mode === 'dark' ? 'dark' : 'light';
    const accent = 'accent' in stored ? accents.find(color => color.id === stored.accent)?.id ?? 'blue' : 'blue';
    return { mode, accent };
  } catch { return defaults; }
}

export function applyAppearance(appearance: Appearance) {
  document.documentElement.dataset.theme = appearance.mode;
  document.documentElement.dataset.accent = appearance.accent;
}

export function saveAppearance(appearance: Appearance, storage?: Pick<Storage, 'setItem'>) {
  try { (storage ?? localStorage).setItem(storageKey, JSON.stringify(appearance)); } catch { /* Appearance still works when storage is unavailable. */ }
}
