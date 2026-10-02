import type { KeyboardEvent } from 'react';
import './PlannerComposer.css';

type Phase = 'idle' | 'connecting' | 'signing-in' | 'signing-out' | 'generating' | 'saving';

type PlannerComposerProps = {
  connection: { connected: boolean; models: { id: string; name: string }[]; account: string | null } | null;
  phase: Phase;
  message: string;
  error: string;
  prompt: string;
  model: string;
  executable: string;
  native: boolean;
  onPromptChange(value: string): void;
  onModelChange(value: string): void;
  onExecutableChange(value: string): void;
  onConnect(): void;
  onDisconnect(): void;
  onSignIn(): void;
  onGenerate(): void;
  onCancel(): void;
  onRetrySave?: () => void;
};

export function PlannerComposer({
  connection,
  phase,
  message,
  error,
  prompt,
  model,
  executable,
  native,
  onPromptChange,
  onModelChange,
  onExecutableChange,
  onConnect,
  onDisconnect,
  onSignIn,
  onGenerate,
  onCancel,
  onRetrySave,
}: PlannerComposerProps) {
  const busy = phase !== 'idle';
  const canCancel = phase === 'connecting' || phase === 'signing-in' || phase === 'generating';
  const modelAvailable = connection?.models.some(option => option.id === model) ?? false;
  const generateDisabled = !native || !connection?.connected || !modelAvailable || !prompt.trim() || prompt.length > 8000 || busy || !!onRetrySave;

  const handlePromptKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const composing = event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229;
    if (composing) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      event.stopPropagation();
      if (!generateDisabled) onGenerate();
    }
  };

  return (
    <section className="planner-composer" aria-label="Plan with Codex">
      <div className="planner-composer__connection">
        <div className="planner-composer__connection-copy">
          <span className={`planner-composer__dot${connection?.connected ? ' is-connected' : ''}`} aria-hidden="true" />
          <span className="planner-composer__connection-state">
            {connection?.connected ? 'Connected to Codex' : 'Codex isn’t connected'}
          </span>
          {connection?.connected && connection.account && (
            <span className="planner-composer__account">{connection.account}</span>
          )}
        </div>
        {connection?.connected ? (
          <div className="planner-composer__connection-actions">
          <button type="button" className="secondary-button planner-composer__connect" onClick={onConnect} disabled={!native || busy}>
            {phase === 'connecting' ? 'Connecting…' : 'Reconnect'}
          </button>
          <button type="button" className="planner-composer__sign-in" onClick={onDisconnect} disabled={!native || busy}>Sign out</button>
          </div>
        ) : (
          <div className="planner-composer__connection-actions">
            <button type="button" className="secondary-button" onClick={onConnect} disabled={!native || busy}>
              {phase === 'connecting' ? 'Connecting…' : 'Connect Codex'}
            </button>
            <button type="button" className="planner-composer__sign-in" onClick={onSignIn} disabled={!native || busy}>
              {phase === 'signing-in' ? 'Opening sign-in…' : 'Continue with ChatGPT'}
            </button>
          </div>
        )}
      </div>

      {!native && <p className="planner-composer__notice" role="status">Open the desktop app to connect Codex.</p>}

      <label className="planner-composer__label" htmlFor="planner-composer-prompt">What would you like to plan?</label>
      <textarea
        id="planner-composer-prompt"
        className="planner-composer__prompt"
        value={prompt}
        maxLength={8000}
        rows={7}
        placeholder="Describe a feature, project, or idea…"
        onChange={event => onPromptChange(event.currentTarget.value)}
        onKeyDown={handlePromptKeyDown}
        aria-describedby="planner-composer-prompt-hint"
      />
      <div className="planner-composer__prompt-meta">
        <span id="planner-composer-prompt-hint">Enter for a new line · ⌘/Ctrl + Enter to generate</span>
        <span>{prompt.length.toLocaleString()} / 8,000</span>
      </div>
      <p className="planner-composer__dictation-hint">On macOS, use your configured Dictation shortcut in System Settings → Keyboard → Dictation.</p>
      <p className="planner-composer__hint">Your prompt and project planning context are sent to Codex. Select an item before opening this composer to narrow the context.</p>

      <div className="planner-composer__options">
        <label className="planner-composer__label" htmlFor="planner-composer-model">Model</label>
        <select
          id="planner-composer-model"
          className="planner-composer__select"
          value={model}
          onChange={event => onModelChange(event.currentTarget.value)}
          disabled={!connection?.connected || !connection.models.length || busy}
        >
          <option value="">Choose a model</option>
          {connection?.models.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
          {model && !modelAvailable && <option value={model} disabled>{model} · unavailable</option>}
        </select>
      </div>
      {connection?.connected && !modelAvailable && <p className="planner-composer__hint">Choose an available model. Model changes are always yours to select.</p>}

      <details className="planner-composer__location">
        <summary>Codex location</summary>
        <label className="planner-composer__label" htmlFor="planner-composer-executable">Codex executable path</label>
        <input
          id="planner-composer-executable"
          className="planner-composer__input"
          value={executable}
          onChange={event => onExecutableChange(event.currentTarget.value)}
          placeholder="Leave blank to use the default location"
          autoComplete="off"
          spellCheck={false}
          disabled={busy}
        />
        <p className="planner-composer__hint">Set a path if Codex can’t be found when the app opens from Finder.</p>
      </details>

      <div className="planner-composer__status" aria-live="polite" aria-atomic="true">
        {message && <span>{message}</span>}
      </div>
      {error && <p className="planner-composer__error" role="alert" aria-live="assertive">{error}</p>}

      <div className="planner-composer__actions">
        {onRetrySave && <button type="button" className="secondary-button" disabled={busy} onClick={onRetrySave}>Retry save</button>}
        {canCancel && <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>}
        <button type="button" className="primary-button planner-composer__generate" onClick={onGenerate} disabled={generateDisabled}>
          {phase === 'generating' ? 'Generating…' : phase === 'saving' ? 'Saving…' : 'Generate plan'}
        </button>
      </div>
    </section>
  );
}
