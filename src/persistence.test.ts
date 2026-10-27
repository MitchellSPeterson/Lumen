import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyWorkspace } from './domain';

const mocks = vi.hoisted(() => ({ native: false, invoke: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => mocks.native, invoke: mocks.invoke }));

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.resetModules(); mocks.invoke.mockReset(); mocks.native = false; });

function sample() {
  return { ...emptyWorkspace(), projects: [{ id: 'p', name: 'Project', folder: '', createdAt: '', image: 'data:image/png;base64,YQ==' }] };
}

describe('project image persistence', () => {
  it('rejects oversized browser backups before creating a download', async () => {
    const createElement = vi.fn(), createObjectURL = vi.spyOn(URL, 'createObjectURL');
    vi.stubGlobal('document', { createElement });
    const { exportWorkspace } = await import('./persistence');
    const workspace = sample();
    workspace.projects = Array.from({ length: 4 }, (_, index) => ({ ...workspace.projects[0], id: `p${index}`, image: `data:image/png;base64,${'A'.repeat(2_799_976)}` }));
    await expect(exportWorkspace(workspace)).rejects.toThrow('Backup exceeds the 10 MB limit. Use smaller project images or remove unused data before exporting.');
    expect(createElement).not.toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('roundtrips browser storage and persists removal without replacing data on invalid save', async () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
    const { loadWorkspace, saveWorkspace } = await import('./persistence');
    const workspace = sample();
    await saveWorkspace(workspace);
    expect((await loadWorkspace()).projects[0].image).toBe(workspace.projects[0].image);
    await expect(saveWorkspace({ ...workspace, projects: [{ ...workspace.projects[0], image: 'data:image/svg+xml;base64,YQ==' }] })).rejects.toThrow('invalid project image');
    expect((await loadWorkspace()).projects[0].image).toBe(workspace.projects[0].image);
    const { image: _, ...project } = workspace.projects[0];
    await saveWorkspace({ ...workspace, projects: [project] });
    expect((await loadWorkspace()).projects[0].image).toBeUndefined();
  });

  it('passes images to native storage and validates native load results', async () => {
    mocks.native = true;
    const { loadWorkspace, saveWorkspace } = await import('./persistence');
    const workspace = sample();
    await saveWorkspace(workspace);
    expect(mocks.invoke).toHaveBeenCalledWith('save_workspace', { workspace });
    mocks.invoke.mockResolvedValueOnce(workspace);
    expect((await loadWorkspace()).projects[0].image).toBe(workspace.projects[0].image);
    mocks.invoke.mockResolvedValueOnce({ ...workspace, projects: [{ ...workspace.projects[0], image: 'https://example.com/image.png' }] });
    await expect(loadWorkspace()).rejects.toThrow('invalid project image');
    mocks.invoke.mockClear();
    await expect(saveWorkspace({ ...workspace, projects: [{ ...workspace.projects[0], image: '' }] })).rejects.toThrow('invalid project image');
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
});
