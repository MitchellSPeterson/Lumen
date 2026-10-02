import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  effects: [] as Array<() => void | (() => void)>,
  saveWorkspace: vi.fn(),
  invoke: vi.fn(),
  closeHandler: undefined as ((event: { preventDefault: () => void }) => Promise<void>) | undefined,
  quitHandler: undefined as (() => Promise<void>) | undefined,
}));

vi.mock('react', () => ({
  useState: (initial: unknown) => [initial, vi.fn()],
  useRef: (initial: unknown) => ({ current: initial }),
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => void | (() => void)) => { mocks.effects.push(effect); },
}));
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }));
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    onCloseRequested: async (handler: typeof mocks.closeHandler) => { mocks.closeHandler = handler; return vi.fn(); },
  }),
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: async (_event: string, handler: typeof mocks.quitHandler) => { mocks.quitHandler = handler; return vi.fn(); },
}));
vi.mock('./persistence', () => ({
  native: true,
  loadWorkspace: vi.fn(async () => ({})),
  saveWorkspace: mocks.saveWorkspace,
}));

import { useWorkspace } from './useWorkspace';

async function setup() {
  mocks.effects = [];
  mocks.closeHandler = undefined;
  mocks.quitHandler = undefined;
  mocks.saveWorkspace.mockReset().mockResolvedValue(undefined);
  mocks.invoke.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  const workspace = useWorkspace();
  mocks.effects.at(-1)?.();
  for (let attempt = 0; attempt < 10 && (!mocks.closeHandler || !mocks.quitHandler); attempt++) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  if (!mocks.closeHandler || !mocks.quitHandler) throw new Error('Native event handlers did not register');
  return workspace;
}

const closeEvent = () => ({ preventDefault: vi.fn() });

describe('useWorkspace native quit handling', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it('intercepts a clean native window close and finishes quit', async () => {
    await setup();
    const event = closeEvent();
    await mocks.closeHandler?.(event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(mocks.invoke).toHaveBeenCalledWith('finish_quit');
  });

  it('waits for dirty workspace save before finishing native window close', async () => {
    const workspace = await setup();
    workspace.update(value => ({ ...value, activeProjectId: 'changed' }));
    let finishSave!: () => void;
    mocks.saveWorkspace.mockReturnValueOnce(new Promise<void>(resolve => { finishSave = resolve; }));
    const event = closeEvent();
    const closing = mocks.closeHandler?.(event);
    await Promise.resolve();
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(mocks.invoke).not.toHaveBeenCalled();
    finishSave();
    await closing;
    expect(mocks.invoke).toHaveBeenCalledWith('finish_quit');
  });

  it('keeps the app open after a failed close save and retries on the next close', async () => {
    const workspace = await setup();
    workspace.update(value => ({ ...value, activeProjectId: 'changed' }));
    mocks.saveWorkspace.mockRejectedValueOnce(new Error('disk full'));
    const firstEvent = closeEvent();
    await mocks.closeHandler?.(firstEvent);
    expect(firstEvent.preventDefault).toHaveBeenCalledOnce();
    expect(mocks.invoke).not.toHaveBeenCalled();

    const retryEvent = closeEvent();
    await mocks.closeHandler?.(retryEvent);
    expect(retryEvent.preventDefault).toHaveBeenCalledOnce();
    expect(mocks.saveWorkspace).toHaveBeenCalledTimes(2);
    expect(mocks.invoke).toHaveBeenCalledWith('finish_quit');
  });

  it('saves before finishing a menu-triggered quit', async () => {
    const workspace = await setup();
    workspace.update(value => ({ ...value, activeProjectId: 'changed' }));
    let finishSave!: () => void;
    mocks.saveWorkspace.mockReturnValueOnce(new Promise<void>(resolve => { finishSave = resolve; }));
    const quitting = mocks.quitHandler?.();
    await Promise.resolve();
    expect(mocks.invoke).not.toHaveBeenCalled();
    finishSave();
    await quitting;
    expect(mocks.invoke).toHaveBeenCalledWith('finish_quit');
  });
});
