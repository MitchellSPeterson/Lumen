export const shortcutDefinitions = [
  { id: 'search', label: 'Search', group: 'General', defaultBinding: 'Mod+K' },
  { id: 'capture', label: 'Quick capture', group: 'General', defaultBinding: 'Mod+N' },
  { id: 'settings', label: 'Settings', group: 'General', defaultBinding: 'Mod+,' },
  { id: 'sidebar', label: 'Toggle sidebar', group: 'General', defaultBinding: 'Mod+B' },
  { id: 'newItem', label: 'New item', group: 'General', defaultBinding: 'Mod+Shift+N' },
  { id: 'newProject', label: 'New project', group: 'General', defaultBinding: null },
  { id: 'plan', label: 'Open planning', group: 'AI planning', defaultBinding: 'Mod+Shift+P' },
  { id: 'list', label: 'List view', group: 'Views', defaultBinding: 'Mod+1' },
  { id: 'map', label: 'Map view', group: 'Views', defaultBinding: 'Mod+2' },
  { id: 'board', label: 'Board view', group: 'Views', defaultBinding: 'Mod+3' },
  { id: 'filters', label: 'Toggle filters', group: 'Views', defaultBinding: 'Mod+Shift+F' },
  { id: 'selectItems', label: 'Select items', group: 'Views', defaultBinding: 'Mod+Shift+S' },
  { id: 'allItems', label: 'All items', group: 'Navigation', defaultBinding: 'Mod+Shift+A' },
  { id: 'inbox', label: 'Inbox', group: 'Navigation', defaultBinding: 'Mod+Shift+I' },
  { id: 'now', label: 'Now', group: 'Navigation', defaultBinding: 'Mod+Shift+1' },
  { id: 'next', label: 'Next', group: 'Navigation', defaultBinding: 'Mod+Shift+2' },
  { id: 'later', label: 'Later', group: 'Navigation', defaultBinding: 'Mod+Shift+3' },
  { id: 'expandDetails', label: 'Expand item details', group: 'Item details', defaultBinding: 'Mod+Shift+E' },
  { id: 'mapFit', label: 'Fit map', group: 'Map', defaultBinding: 'Mod+0' },
  { id: 'mapZoomIn', label: 'Zoom in', group: 'Map', defaultBinding: 'Mod+=' },
  { id: 'mapZoomOut', label: 'Zoom out', group: 'Map', defaultBinding: 'Mod+-' },
  { id: 'generatePlan', label: 'Generate plan', group: 'AI planning', defaultBinding: 'Mod+Enter' },
] as const;

export type ShortcutAction = typeof shortcutDefinitions[number]['id'];
export type ShortcutBindings = Record<ShortcutAction, string | null>;
type ShortcutEvent = Pick<KeyboardEvent, 'key' | 'code' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'isComposing' | 'repeat'>;
const storageKey = 'codebase-planner-shortcuts';
const namedKeys = ['Enter', 'Tab', 'Space', 'Escape', 'Backspace', 'Delete', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'];
const punctuationCodes: Record<string, string> = { Equal: '=', Minus: '-', Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Backslash: '\\', Backquote: '`', Space: 'Space' };
const reserved = new Set(['Q', 'W', 'R', 'T', 'L', 'H', 'M', 'Tab', 'Space', 'C', 'V', 'X', 'A', 'Z', 'Y'].map(key => `Mod+${key}`).concat('Mod+Shift+Q'));

function normalizedBinding(binding: string): string | null {
  const parts = binding.split('+');
  if (parts.shift() !== 'Mod') return null;
  const key = parts.pop();
  if (!key || !(/^[A-Z0-9=,./;'\[\]\\`-]$/.test(key) || namedKeys.includes(key) || /^F([1-9]|1\d|2[0-4])$/.test(key))) return null;
  if (parts.some(part => part !== 'Alt' && part !== 'Shift') || new Set(parts).size !== parts.length) return null;
  return ['Mod', ...(parts.includes('Alt') ? ['Alt'] : []), ...(parts.includes('Shift') ? ['Shift'] : []), key].join('+');
}

export function defaultShortcuts(): ShortcutBindings {
  return Object.fromEntries(shortcutDefinitions.map(({ id, defaultBinding }) => [id, defaultBinding])) as ShortcutBindings;
}

export function readShortcuts(storage?: Pick<Storage, 'getItem'>): ShortcutBindings {
  const defaults = defaultShortcuts();
  try {
    const stored: unknown = JSON.parse((storage ?? localStorage).getItem(storageKey) ?? 'null');
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return defaults;
    const bindings = { ...defaults };
    for (const { id } of shortcutDefinitions) {
      if (!Object.prototype.hasOwnProperty.call(stored, id)) continue;
      const value: unknown = (stored as Record<string, unknown>)[id];
      if (value === null) bindings[id] = null;
      else if (typeof value === 'string') {
        const normalized = normalizedBinding(value);
        if (normalized && !reserved.has(normalized)) bindings[id] = normalized;
      }
    }
    // Keep default owners first, then resolve duplicate overrides without disabling unrelated actions.
    const used = new Set<string>();
    const ordered = [...shortcutDefinitions].sort((a, b) => Number(bindings[b.id] === defaults[b.id]) - Number(bindings[a.id] === defaults[a.id]));
    for (const { id } of ordered) {
      const binding = bindings[id];
      if (!binding) continue;
      if (used.has(binding)) bindings[id] = defaults[id] && !used.has(defaults[id]!) ? defaults[id] : null;
      if (bindings[id]) used.add(bindings[id]!);
    }
    return bindings;
  } catch { return defaults; }
}

export function saveShortcuts(bindings: ShortcutBindings, storage?: Pick<Storage, 'setItem'>): boolean {
  try {
    (storage ?? localStorage).setItem(storageKey, JSON.stringify(bindings));
    return true;
  } catch { return false; }
}

export function shortcutFromEvent(event: ShortcutEvent): string | null {
  if (event.repeat || event.isComposing || (!event.metaKey && !event.ctrlKey) || (event.metaKey && event.ctrlKey)) return null;
  let key = punctuationCodes[event.code];
  if (/^Key[A-Z]$/.test(event.code)) key = event.code.slice(3);
  else if (/^Digit[0-9]$/.test(event.code)) key = event.code.slice(5);
  if (!key) key = event.key === ' ' ? 'Space' : event.key.length === 1 ? event.key.toUpperCase() : event.key;
  return normalizedBinding(['Mod', ...(event.altKey ? ['Alt'] : []), ...(event.shiftKey ? ['Shift'] : []), key].join('+'));
}

export function matchesShortcut(event: ShortcutEvent, binding: string | null): boolean {
  const normalized = binding && normalizedBinding(binding);
  return !!normalized && shortcutFromEvent(event) === normalized;
}

function isMac(): boolean { return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform); }

export function formatShortcut(binding: string | null): string {
  if (!binding) return 'Not assigned';
  if (isMac()) return binding.replace('Mod+', '⌘').replace('Alt+', '⌥').replace('Shift+', '⇧').replace('Enter', '↵');
  return binding.replace('Mod', 'Ctrl');
}

export function shortcutAria(binding: string | null): string | undefined {
  return binding ? binding.replace('Mod', isMac() ? 'Meta' : 'Control') : undefined;
}

export function shortcutProblem(binding: string, bindings: ShortcutBindings, action: ShortcutAction): string | null {
  const normalized = normalizedBinding(binding);
  if (!normalized) return 'Use Command or Control with a key, optionally adding Shift or Alt.';
  if (reserved.has(normalized)) return 'Reserved for a system or editing command.';
  const conflict = shortcutDefinitions.find(({ id }) => id !== action && bindings[id] !== null && normalizedBinding(bindings[id]!) === normalized);
  return conflict ? `Already assigned to ${conflict.label}.` : null;
}
