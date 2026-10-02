import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultShortcuts, formatShortcut, matchesShortcut, readShortcuts, saveShortcuts, shortcutAria, shortcutFromEvent, shortcutProblem } from './shortcuts';

const event = (overrides: Partial<Parameters<typeof shortcutFromEvent>[0]> = {}) => ({
  key: 'k', code: 'KeyK', metaKey: false, ctrlKey: true, shiftKey: false, altKey: false, isComposing: false, repeat: false, ...overrides,
});
const storage = (value: unknown) => ({ getItem: () => JSON.stringify(value) });

afterEach(() => vi.unstubAllGlobals());

describe('shortcut matching', () => {
  it('matches either primary modifier and exact secondary modifiers', () => {
    expect(matchesShortcut(event(), 'Mod+K')).toBe(true);
    expect(matchesShortcut(event({ ctrlKey: false, metaKey: true }), 'Mod+K')).toBe(true);
    expect(matchesShortcut(event({ shiftKey: true }), 'Mod+K')).toBe(false);
    expect(matchesShortcut(event({ altKey: true }), 'Mod+Alt+K')).toBe(true);
    expect(matchesShortcut(event({ ctrlKey: false }), 'Mod+K')).toBe(false);
    expect(matchesShortcut(event({ metaKey: true }), 'Mod+K')).toBe(false);
    expect(matchesShortcut(event(), null)).toBe(false);
    expect(matchesShortcut(event({ ctrlKey: false }), 'invalid')).toBe(false);
  });
  it('normalizes shifted digits and alternate characters from physical codes', () => {
    expect(shortcutFromEvent(event({ key: '!', code: 'Digit1', shiftKey: true }))).toBe('Mod+Shift+1');
    expect(shortcutFromEvent(event({ key: 'π', code: 'KeyP', altKey: true }))).toBe('Mod+Alt+P');
    expect(shortcutFromEvent(event({ key: '+', code: 'Equal', shiftKey: true }))).toBe('Mod+Shift+=');
    expect(shortcutFromEvent(event({ key: ',', code: 'Comma' }))).toBe('Mod+,');
    expect(shortcutFromEvent(event({ key: '.', code: 'Period' }))).toBe('Mod+.');
    expect(shortcutFromEvent(event({ key: '-', code: 'Minus' }))).toBe('Mod+-');
    expect(shortcutFromEvent(event({ key: ' ', code: 'Space' }))).toBe('Mod+Space');
  });
  it('ignores repeat, IME, and modifier-only input', () => {
    expect(shortcutFromEvent(event({ repeat: true }))).toBeNull();
    expect(shortcutFromEvent(event({ isComposing: true }))).toBeNull();
    expect(shortcutFromEvent(event({ key: 'Shift', code: 'ShiftLeft' }))).toBeNull();
  });
});

describe('shortcut validation', () => {
  it('names conflicting actions and permits retaining current assignment', () => {
    expect(shortcutProblem('Mod+K', defaultShortcuts(), 'capture')).toContain('Search');
    expect(shortcutProblem('Mod+K', defaultShortcuts(), 'search')).toBeNull();
    expect(shortcutProblem('Mod+Shift+Alt+G', defaultShortcuts(), 'search')).toBeNull();
  });
  it('protects common commands while permitting shifted defaults', () => {
    for (const key of ['Q', 'W', 'R', 'T', 'L', 'H', 'M', 'Tab', 'Space', 'C', 'V', 'X', 'A', 'Z', 'Y', 'Shift+Q']) {
      expect(shortcutProblem(`Mod+${key}`, defaultShortcuts(), 'search')).toContain('Reserved');
    }
    expect(shortcutProblem('Mod+Shift+A', defaultShortcuts(), 'allItems')).toBeNull();
    expect(shortcutProblem('K', defaultShortcuts(), 'search')).toContain('Command or Control');
    expect(shortcutProblem('Mod+Shift+Shift+K', defaultShortcuts(), 'search')).not.toBeNull();
  });
});

describe('shortcut persistence', () => {
  it('returns fresh defaults and tolerates unavailable/corrupt storage', () => {
    const defaults = defaultShortcuts();
    defaults.search = null;
    expect(defaultShortcuts().search).toBe('Mod+K');
    expect(readShortcuts({ getItem: () => '{' })).toEqual(defaultShortcuts());
    expect(readShortcuts({ getItem: () => { throw new Error('blocked'); } })).toEqual(defaultShortcuts());
    for (const value of [null, [], 'bad', 7]) expect(readShortcuts(storage(value))).toEqual(defaultShortcuts());
  });
  it('preserves disabled actions and ignores invalid values and unknown IDs', () => {
    const bindings = readShortcuts(storage({ search: null, capture: 'Mod+Alt+Shift+G', settings: 'Mod+Q', sidebar: 2, unknown: 'Mod+O' }));
    expect(bindings.search).toBeNull();
    expect(bindings.capture).toBe('Mod+Alt+Shift+G');
    expect(bindings.settings).toBe('Mod+,');
    expect(bindings.sidebar).toBe('Mod+B');
    expect(bindings).not.toHaveProperty('unknown');
  });
  it('resolves duplicates and preserves complete reassignment swaps', () => {
    const defaults = defaultShortcuts();
    expect(readShortcuts(storage({ capture: 'Mod+K' }))).toEqual(defaults);
    const duplicates = readShortcuts(storage({ search: 'Mod+G', capture: 'Mod+G' }));
    const assigned = Object.values(duplicates).filter(binding => binding !== null);
    expect(new Set(assigned).size).toBe(assigned.length);
    expect(readShortcuts(storage({ search: 'Mod+N', capture: 'Mod+K' }))).toMatchObject({ search: 'Mod+N', capture: 'Mod+K' });
  });
  it('saves bindings with stable key and reports write failures', () => {
    const setItem = vi.fn();
    expect(saveShortcuts(defaultShortcuts(), { setItem })).toBe(true);
    expect(setItem).toHaveBeenCalledWith('codebase-planner-shortcuts', JSON.stringify(defaultShortcuts()));
    expect(saveShortcuts(defaultShortcuts(), { setItem: () => { throw new Error('full'); } })).toBe(false);
  });
});

it('formats platform labels and accessible shortcut metadata', () => {
  vi.stubGlobal('navigator', { platform: 'MacIntel' });
  expect(formatShortcut('Mod+Alt+Shift+K')).toBe('⌘⌥⇧K');
  expect(shortcutAria('Mod+Shift+1')).toBe('Meta+Shift+1');
  vi.stubGlobal('navigator', { platform: 'Win32' });
  expect(formatShortcut('Mod+Shift+K')).toBe('Ctrl+Shift+K');
  expect(shortcutAria('Mod+K')).toBe('Control+K');
  expect(formatShortcut(null)).toBe('Not assigned');
  expect(shortcutAria(null)).toBeUndefined();
});
