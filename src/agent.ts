import { invoke } from '@tauri-apps/api/core';
import { native } from './persistence';
import { plannerOutputSchema } from './planner';

export interface AgentConnection {
  connected: boolean;
  models: { id: string; name: string }[];
  account: string | null;
}
export type PlannerPhase = 'idle' | 'connecting' | 'signing-in' | 'signing-out' | 'generating' | 'saving';

function desktopOnly() {
  if (!native) throw new Error('Open the desktop app to connect Codex.');
}
export async function connectCodex(executable: string, signIn = false): Promise<AgentConnection> {
  desktopOnly();
  return invoke(signIn ? 'codex_sign_in' : 'codex_connect', { executable: executable.trim() || null });
}
export async function generatePlan(runId: string, model: string, prompt: string, context: string): Promise<unknown> {
  desktopOnly();
  return invoke('codex_generate', { runId, model, prompt, context, outputSchema: plannerOutputSchema });
}
export async function cancelCodex(runId: string | null): Promise<void> {
  if (native) await invoke('codex_cancel', { runId });
}
export async function disconnectCodex(): Promise<void> {
  desktopOnly();
  await invoke('codex_disconnect');
}
