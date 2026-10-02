import type { KeyboardEvent } from 'react';
import type { ItemDetails, WorkItem } from './domain';
import type { DraftItem, PlannerAction, PlannerDraft, Reference } from './planner';
import './PlannerComposer.css';

type Phase = 'idle' | 'connecting' | 'signing-in' | 'signing-out' | 'generating' | 'saving';

type PlannerComposerProps = {
  selectedTitle?: string;
  existingItems: Pick<WorkItem, 'id' | 'title'>[];
  action: PlannerAction;
  preview: PlannerDraft | null;
  onActionChange(value: PlannerAction): void;
  onPreviewChange(value: PlannerDraft): void;
  onApply(): void;
  onDiscard(): void;
  connection: { connected: boolean; models: { id: string; name: string }[]; account: string | null } | null;
  phase: Phase;
  message: string;
  error: string;
  prompt: string;
  model: string;
  native: boolean;
  onPromptChange(value: string): void;
  onModelChange(value: string): void;
  onOpenSettings(): void;
  onGenerate(): void;
  onCancel(): void;
  onRetrySave?: () => void;
};

export function PlannerComposer({
  selectedTitle, existingItems, action, preview, onActionChange, onPreviewChange, onApply, onDiscard,
  connection,
  phase,
  message,
  error,
  prompt,
  model,
  native,
  onPromptChange,
  onModelChange,
  onOpenSettings,
  onGenerate,
  onCancel,
  onRetrySave,
}: PlannerComposerProps) {
  const busy = phase !== 'idle';
  const canCancel = phase === 'connecting' || phase === 'signing-in' || phase === 'generating';
  const modelAvailable = connection?.models.some(option => option.id === model) ?? false;
  const generateDisabled = !native || !connection?.connected || !modelAvailable || !prompt.trim() || prompt.length > 8000 || busy || !!onRetrySave || (action !== 'project' && !selectedTitle);

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
        <button type="button" className="secondary-button" onClick={onOpenSettings} disabled={busy}>Connection settings</button>
      </div>

      {!native && <p className="planner-composer__notice" role="status">Open the desktop app to connect Codex.</p>}

      <label className="planner-composer__label" htmlFor="planner-action">Planning action</label>
      <select id="planner-action" className="planner-composer__select" value={action} disabled={busy} onChange={event => onActionChange(event.currentTarget.value as PlannerAction)}>
        <option value="project">Plan project</option>
        <option value="clarify" disabled={!selectedTitle}>Clarify selected idea</option>
        <option value="requirements" disabled={!selectedTitle}>Draft selected requirements</option>
        <option value="tasks" disabled={!selectedTitle}>Break selected item into tasks</option>
      </select>
      {selectedTitle && action !== 'project' && <p className="planner-composer__hint">Selected item: {selectedTitle}</p>}
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
      <p className="planner-composer__hint">Your prompt and project planning context are sent to Codex. Selected-item actions narrow context to that item and its related work; Plan project uses the full project.</p>

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



      {preview && <PlanPreview draft={preview} existingItems={existingItems} disabled={busy} onChange={onPreviewChange} />}
      <div className="planner-composer__status" aria-live="polite" aria-atomic="true">
        {message && <span>{message}</span>}
      </div>
      {error && <p className="planner-composer__error" role="alert" aria-live="assertive">{error}</p>}

      <div className="planner-composer__actions">
        {onRetrySave && <button type="button" className="secondary-button" disabled={busy} onClick={onRetrySave}>Retry save</button>}
        {preview && <><button type="button" className="secondary-button" disabled={busy} onClick={onDiscard}>Discard preview</button><button type="button" className="primary-button" disabled={busy || !!onRetrySave} onClick={onApply}>Apply plan</button></>}
        {canCancel && <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>}
        <button type="button" className="primary-button planner-composer__generate" onClick={onGenerate} disabled={generateDisabled}>
          {phase === 'generating' ? 'Generating…' : phase === 'saving' ? 'Saving…' : preview ? 'Regenerate' : 'Generate preview'}
        </button>
      </div>
    </section>
  );
}

function PlanPreview({ draft, existingItems, disabled, onChange }: { draft: PlannerDraft; existingItems: Pick<WorkItem, 'id' | 'title'>[]; disabled: boolean; onChange(value: PlannerDraft): void }) {
  const editItem = (index: number, patch: Partial<DraftItem>) => onChange({ ...draft, items: draft.items.map((item, position) => position === index ? { ...item, ...patch } : item) });
  const removeItem = (index: number) => {
    const removed = draft.items[index];
    onChange({ ...draft,
      items: draft.items.filter((_, position) => position !== index).map(item => item.parent?.type === 'new' && item.parent.id === removed.key ? { ...item, parent: removed.parent } : item),
      links: draft.links.filter(link => !(link.source.type === 'new' && link.source.id === removed.key) && !(link.target.type === 'new' && link.target.id === removed.key)),
    });
  };
  return <fieldset className="planner-preview" disabled={disabled}>
    <legend>Review proposal</legend>
    <p className="planner-composer__hint">{draft.items.length} new items · {draft.links.length} related links{draft.update ? ' · selected item update' : ''}. Apply saves these changes.</p>
    {draft.update && <div className="planner-preview__item">
      <div className="planner-preview__heading"><strong>Selected item planning update</strong><button type="button" className="text-button" onClick={() => onChange({ ...draft, update: null })}>Remove update</button></div>
      {draft.update.notes != null && <label>Proposed notes<textarea maxLength={8000} value={draft.update.notes} onChange={event => onChange({ ...draft, update: { ...draft.update!, notes: event.currentTarget.value } })} /></label>}
      {draft.update.details && <DetailsEditor value={draft.update.details} onChange={details => onChange({ ...draft, update: { ...draft.update!, details } })} />}
    </div>}
    {draft.items.map((item, index) => <div className="planner-preview__item" key={item.key}>
      <div className="planner-preview__heading"><strong>New item {index + 1}</strong><button type="button" className="text-button" onClick={() => removeItem(index)}>Remove item</button></div>
      <label>Title<input maxLength={300} value={item.title} onChange={event => editItem(index, { title: event.currentTarget.value })} /></label>
      <div className="planner-preview__row">
        <label>Kind<select value={item.kind} onChange={event => editItem(index, { kind: event.currentTarget.value as DraftItem['kind'] })}>{['idea', 'feature', 'todo', 'bug'].map(kind => <option key={kind} value={kind}>{kind[0].toUpperCase() + kind.slice(1)}</option>)}</select></label>
        <label>Priority<select value={item.priority} onChange={event => editItem(index, { priority: event.currentTarget.value as DraftItem['priority'] })}>{['low', 'normal', 'high'].map(priority => <option key={priority} value={priority}>{priority[0].toUpperCase() + priority.slice(1)}</option>)}</select></label>
        <label>Plan<select value={item.planningLane ?? ''} onChange={event => editItem(index, { planningLane: (event.currentTarget.value || null) as DraftItem['planningLane'] })}><option value="">Unplanned</option>{['now', 'next', 'later'].map(lane => <option key={lane} value={lane}>{lane[0].toUpperCase() + lane.slice(1)}</option>)}</select></label>
      </div>
      <label>Tags, separated by commas<input value={item.tags.join(',')} onChange={event => editItem(index, { tags: event.currentTarget.value.split(',') })} /></label>
      <label>Notes<textarea maxLength={8000} value={item.notes} onChange={event => editItem(index, { notes: event.currentTarget.value })} /></label>
      <ReferenceEditor label="Parent" value={item.parent} items={draft.items.filter(candidate => candidate.key !== item.key)} existingItems={existingItems} allowRoot onChange={parent => editItem(index, { parent })} />
      <DetailsEditor value={item.details ?? {}} onChange={details => editItem(index, { details })} />
    </div>)}
    {draft.links.map((link, index) => <div className="planner-preview__item" key={index}>
      <div className="planner-preview__heading"><strong>Related link {index + 1}</strong><button type="button" className="text-button" onClick={() => onChange({ ...draft, links: draft.links.filter((_, position) => position !== index) })}>Remove link</button></div>
      {(['source', 'target'] as const).map(side => <ReferenceEditor key={side} label={side === 'source' ? 'From' : 'To'} value={link[side]} items={draft.items} existingItems={existingItems} onChange={reference => { if (reference) onChange({ ...draft, links: draft.links.map((entry, position) => position === index ? { ...entry, [side]: reference } : entry) }); }} />)}
    </div>)}
    {!draft.items.length && !draft.links.length && !draft.update && <p>No proposed changes remain.</p>}
  </fieldset>;
}
function ReferenceEditor({ label, value, items, existingItems, allowRoot = false, onChange }: {
  label: string; value: Reference | null; items: DraftItem[]; existingItems: Pick<WorkItem, 'id' | 'title'>[];
  allowRoot?: boolean; onChange(value: Reference | null): void;
}) {
  const choices: { value: string; label: string; reference: Reference | null }[] = [
    ...(allowRoot ? [{ value: 'root', label: 'Project root', reference: null }] : []),
    ...items.map(item => ({ value: `new:${item.key}`, label: `${item.title} · New`, reference: { type: 'new' as const, id: item.key } })),
    ...existingItems.map(item => ({ value: `existing:${item.id}`, label: `${item.title} · Existing`, reference: { type: 'existing' as const, id: item.id } })),
  ];
  const selected = choices.find(choice => choice.reference === null ? value === null : value?.type === choice.reference.type && value.id === choice.reference.id);
  return <label>{label}<select value={selected?.value ?? 'missing'} onChange={event => {
    const choice = choices.find(option => option.value === event.currentTarget.value);
    if (choice) onChange(choice.reference);
  }}>
    {!selected && <option value="missing" disabled>Missing item (regenerate)</option>}
    {choices.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
  </select></label>;
}
function DetailsEditor({ value, onChange }: { value: ItemDetails; onChange(value: ItemDetails): void }) {
  return <details className="planner-preview__details" open={!!(value.feature || value.bug)}><summary>Structured planning details</summary>
    {value.feature ? <>
      {(['problem', 'expectedBehavior', 'openQuestions'] as const).map(field => <label key={`feature:${field}`}>{({ problem: 'Problem', expectedBehavior: 'Expected behavior', openQuestions: 'Open questions' })[field]}<textarea maxLength={8000} value={value.feature![field]} onChange={event => onChange({ ...value, feature: { ...value.feature!, [field]: event.currentTarget.value } })} /></label>)}
      <span>Acceptance criteria</span>
      {value.feature.acceptanceCriteria.map((criterion, index) => <div className="planner-preview__criterion" key={criterion.id}>
        <input type="checkbox" aria-label={`Criterion ${index + 1} completed`} checked={criterion.checked} onChange={event => onChange({ ...value, feature: { ...value.feature!, acceptanceCriteria: value.feature!.acceptanceCriteria.map((entry, position) => position === index ? { ...entry, checked: event.currentTarget.checked } : entry) } })} />
        <input aria-label={`Acceptance criterion ${index + 1}`} maxLength={8000} value={criterion.text} onChange={event => onChange({ ...value, feature: { ...value.feature!, acceptanceCriteria: value.feature!.acceptanceCriteria.map((entry, position) => position === index ? { ...entry, text: event.currentTarget.value } : entry) } })} />
        <button type="button" className="text-button" aria-label={`Remove criterion ${index + 1}`} onClick={() => onChange({ ...value, feature: { ...value.feature!, acceptanceCriteria: value.feature!.acceptanceCriteria.filter((_, position) => position !== index) } })}>Remove</button>
      </div>)}
      <button type="button" className="text-button" disabled={value.feature.acceptanceCriteria.length >= 100} onClick={() => onChange({ ...value, feature: { ...value.feature!, acceptanceCriteria: [...value.feature!.acceptanceCriteria, { id: crypto.randomUUID(), text: '', checked: false }] } })}>Add criterion</button>
    </> : <button type="button" className="text-button" onClick={() => onChange({ ...value, feature: { problem: '', expectedBehavior: '', openQuestions: '', acceptanceCriteria: [] } })}>Add feature details</button>}
    {value.bug ? (['stepsToReproduce', 'expectedBehavior', 'actualBehavior'] as const).map(field => <label key={`bug:${field}`}>{({ stepsToReproduce: 'Steps to reproduce', expectedBehavior: 'Expected behavior', actualBehavior: 'Actual behavior' })[field]}<textarea maxLength={8000} value={value.bug![field]} onChange={event => onChange({ ...value, bug: { ...value.bug!, [field]: event.currentTarget.value } })} /></label>) : <button type="button" className="text-button" onClick={() => onChange({ ...value, bug: { stepsToReproduce: '', expectedBehavior: '', actualBehavior: '' } })}>Add bug details</button>}
  </details>;
}
