import { useState } from 'react';
import { Check, Moon, Sun } from 'lucide-react';
import { accents, type Appearance } from './appearance';
import type { usePlanner } from './usePlanner';
import './SettingsPanel.css';

type Section = 'appearance' | 'codex' | 'general';
type Props = {
  appearance: Appearance;
  onAppearance(patch: Partial<Appearance>): void;
  planner: ReturnType<typeof usePlanner>;
  native: boolean;
  initialSection: Section;
  backupBusy: boolean;
  canExport: boolean;
  onBackup(action: 'export' | 'import'): void;
};

export function SettingsPanel({ appearance, onAppearance, planner, native, initialSection, backupBusy, canExport, onBackup }: Props) {
  const [section, setSection] = useState(initialSection);
  const busy = planner.phase !== 'idle';
  const modelAvailable = planner.connection?.models.some(option => option.id === planner.model);
  return <section className="settings-panel" aria-label="App settings">
    <nav className="settings-nav" aria-label="Settings sections">
      {([['appearance', 'Appearance'], ['codex', 'ChatGPT & Codex'], ['general', 'General']] as const).map(([id, label]) => <button key={id} type="button" aria-pressed={section === id} onClick={() => setSection(id)}>{label}</button>)}
    </nav>
    <div className="settings-content">
      {section === 'appearance' && <>
        <fieldset className="appearance-field"><legend>Mode</legend><div className="appearance-modes">{(['light', 'dark'] as const).map(mode => <button key={mode} className={appearance.mode === mode ? 'active' : ''} aria-pressed={appearance.mode === mode} onClick={() => onAppearance({ mode })}>{mode === 'light' ? <Sun size={17} /> : <Moon size={17} />}{mode === 'light' ? 'Light' : 'Dark'}</button>)}</div></fieldset>
        <fieldset className="appearance-field"><legend>Accent color</legend><div className="accent-options">{accents.map(color => <button key={color.id} data-accent={color.id} className="accent-option" aria-pressed={appearance.accent === color.id} onClick={() => onAppearance({ accent: color.id })}><span className="accent-swatch" aria-hidden="true">{appearance.accent === color.id && <Check size={16} />}</span><span>{color.label}</span></button>)}</div></fieldset>
        <p className="form-hint">Changes apply immediately and stay on this device.</p>
      </>}
      {section === 'codex' && <>
        <h2>ChatGPT connection</h2>
        <div className="settings-account"><span className={`planner-composer__dot${planner.connection?.connected ? ' is-connected' : ''}`} aria-hidden="true" /><div><strong>{planner.connection?.connected ? 'Connected to Codex' : 'Codex isn’t connected'}</strong>{planner.connection?.connected && <span>{planner.connection.account}</span>}</div></div>
        <div className="settings-buttons">
          {planner.connection?.connected ? <button className="secondary-button" disabled={busy} onClick={() => void planner.disconnect()}>{planner.phase === 'signing-out' ? 'Signing out…' : 'Sign out'}</button> : <button className="primary-button" disabled={!native || busy} onClick={() => void planner.connect(true)}>{planner.phase === 'signing-in' ? 'Signing in…' : 'Continue with ChatGPT'}</button>}
          {(planner.phase === 'connecting' || planner.phase === 'signing-in') && <button className="secondary-button" onClick={() => void planner.cancel()}>Cancel</button>}
        </div>
        <p className="form-hint">Your sign-in stays saved on this Mac. Credentials are kept separately from planner data and backups. Sign out removes the local session and requests remote revocation.</p>
        {!native && <p className="planner-composer__notice">Open the desktop app to connect Codex.</p>}
        <label className="form-field">Default model<select value={planner.model} disabled={!planner.connection?.connected || busy} onChange={event => planner.setModel(event.currentTarget.value)}><option value="">Choose a model</option>{planner.connection?.models.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}{planner.model && !modelAvailable && <option value={planner.model} disabled>{planner.model} · unavailable</option>}</select></label>
        <p className="form-hint">Luna is preferred when available. Your selection is remembered; the app never changes models automatically.</p>
        <h2>Planning with AI</h2>
        <p className="form-hint">Plan project sends your prompt and full project planning context to Codex. Item actions send your prompt, selected item, and its related work. Review the proposal before applying changes.</p>
        <p className="form-hint">In the prompt, Enter adds a new line; ⌘/Ctrl + Enter generates a plan. Prompts support up to 8,000 characters.</p>
        <details className="settings-advanced"><summary>Advanced connection settings</summary><label className="form-field">Codex executable path<input value={planner.executable} maxLength={4096} disabled={busy} autoComplete="off" spellCheck={false} placeholder="Automatic discovery" onChange={event => planner.setExecutable(event.currentTarget.value)} /></label>
        <p className="form-hint">Leave empty for automatic discovery. Restart the app after changing this path.</p></details>
      </>}
      {section === 'general' && <>
        <h2>Local workspace</h2>
        <p className="form-hint">Projects, items, links, and map positions save automatically on this device. Backups include planning data; appearance, model preferences, and credentials stay separate.</p>
        <div className="settings-buttons"><button className="secondary-button" disabled={backupBusy || busy || !canExport} onClick={() => onBackup('export')}>Export backup</button><button className="secondary-button" disabled={backupBusy || busy} onClick={() => onBackup('import')}>Import backup</button></div>
        <h2>System dictation</h2>
        <p className="form-hint">On macOS, enable Dictation in System Settings → Keyboard → Dictation. Focus a prompt and use your configured shortcut or Edit → Start Dictation. macOS handles speech recognition.</p>
        <h2>About</h2><p className="form-hint">Codebase Planner · Version 0.1.0{!native && ' · Browser preview'}</p>
      </>}
      {section === 'codex' && <><div className="planner-composer__status" role="status" aria-live="polite">{planner.message}</div>{planner.error && <p className="planner-composer__error" role="alert">{planner.error}</p>}</>}
    </div>
  </section>;
}
