import { describe, expect, it } from 'vitest';
import { readAppearance, saveAppearance } from './appearance';

const storage = (value: string | null) => ({ getItem: () => value });

describe('appearance preferences', () => {
  it('defaults to light mode and light blue for new users', () => {
    expect(readAppearance(storage(null))).toEqual({ mode: 'light', accent: 'blue' });
  });
  it('restores valid preferences separately from workspace data', () => {
    expect(readAppearance(storage('{"mode":"dark","accent":"violet"}'))).toEqual({ mode: 'dark', accent: 'violet' });
  });
  it('validates each preference without discarding the valid one', () => {
    expect(readAppearance(storage('{"mode":"unexpected","accent":"green"}'))).toEqual({ mode: 'light', accent: 'green' });
    expect(readAppearance(storage('{"mode":"dark","accent":"unexpected"}'))).toEqual({ mode: 'dark', accent: 'blue' });
  });
  it('recovers from malformed storage values', () => {
    for (const value of ['{', '[]', '42', '"dark"', '{"mode":null,"accent":{}}']) {
      expect(readAppearance(storage(value))).toEqual({ mode: 'light', accent: 'blue' });
    }
  });
  it('tolerates unavailable storage for reading and writing', () => {
    expect(readAppearance({ getItem: () => { throw new Error('Storage blocked'); } })).toEqual({ mode: 'light', accent: 'blue' });
    expect(() => saveAppearance({ mode: 'dark', accent: 'rose' }, { setItem: () => { throw new Error('Storage blocked'); } })).not.toThrow();
  });
});
