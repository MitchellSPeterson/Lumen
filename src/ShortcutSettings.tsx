import { useState, type KeyboardEvent } from 'react';
import { defaultShortcuts, formatShortcut, shortcutDefinitions, shortcutFromEvent, shortcutProblem, type ShortcutAction, type ShortcutBindings } from './shortcuts';

type Props = { bindings: ShortcutBindings; onChange(bindings: ShortcutBindings): void };

export function ShortcutSettings({ bindings, onChange }: Props) {
  const [recording, setRecording] = useState<ShortcutAction | null>(null);
  const [error, setError] = useState<{ action: ShortcutAction; message: string } | null>(null);
  const groups = [...new Set(shortcutDefinitions.map(definition => definition.group))];

  const assign = (action: ShortcutAction, binding: string | null) => {
    const problem = binding ? shortcutProblem(binding, bindings, action) : null;
    if (problem) { setError({ action, message: problem }); return; }
    onChange({ ...bindings, [action]: binding });
    setError(null);
    setRecording(null);
  };
  const record = (event: KeyboardEvent<HTMLButtonElement>, action: ShortcutAction) => {
    if (recording !== action) return;
    event.stopPropagation();
    if (event.key === 'Tab') { setRecording(null); return; }
    event.preventDefault();
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229 || event.repeat) return;
    if (event.key === 'Escape') { setRecording(null); setError(null); return; }
    if (['Meta', 'Control', 'Shift', 'Alt', 'AltGraph'].includes(event.key)) return;
    const binding = shortcutFromEvent(event.nativeEvent);
    if (!binding) { setError({ action, message: 'Hold Command or Ctrl with another key.' }); return; }
    assign(action, binding);
  };

  return <div className="shortcut-settings">
    <div className="shortcut-settings-heading"><h2>Keyboard shortcuts</h2><button type="button" className="text-button" onClick={() => { onChange(defaultShortcuts()); setRecording(null); setError(null); }}>Reset all</button></div>
    <p className="form-hint">Changes apply immediately and stay on this device. Select a shortcut, then press Command or Ctrl with a key. Escape cancels recording.</p>
    <p className="form-hint">Enter, Escape, and standard text editing keep their usual behavior. Native system shortcuts are reserved.</p>
    {groups.map(group => <section className="shortcut-group" key={group} aria-label={group}>
      <h3>{group}</h3>
      {group === 'Map' && <p className="form-hint">Map controls work while Map view is active.</p>}
      {group === 'AI planning' && <p className="form-hint">Generate plan works while the planning prompt is focused.</p>}
      {shortcutDefinitions.filter(definition => definition.group === group).map(definition => <div className="shortcut-row" key={definition.id}>
        <span className="shortcut-label" id={`shortcut-label-${definition.id}`}>{definition.label}</span>
        <div className="shortcut-controls">
          <button type="button" className={`shortcut-binding${recording === definition.id ? ' is-recording' : ''}`} aria-label={`${recording === definition.id ? 'Recording shortcut' : 'Change shortcut'} for ${definition.label}: ${formatShortcut(bindings[definition.id])}`} aria-pressed={recording === definition.id} aria-describedby={error?.action === definition.id ? `shortcut-error-${definition.id}` : undefined} onClick={() => { setRecording(definition.id); setError(null); }} onKeyDown={event => record(event, definition.id)} onBlur={() => setRecording(current => current === definition.id ? null : current)}>{recording === definition.id ? 'Press shortcut…' : formatShortcut(bindings[definition.id])}</button>
          <button type="button" className="text-button" disabled={!bindings[definition.id]} aria-label={`Disable shortcut for ${definition.label}`} onClick={() => assign(definition.id, null)}>Disable</button>
          <button type="button" className="text-button" disabled={bindings[definition.id] === definition.defaultBinding} aria-label={`Restore default shortcut for ${definition.label}`} onClick={() => assign(definition.id, definition.defaultBinding)}>Restore</button>
        </div>
        {error?.action === definition.id && <p className="shortcut-error" id={`shortcut-error-${definition.id}`} role="status" aria-live="polite">{error.message}</p>}
      </div>)}
    </section>)}
  </div>;
}
