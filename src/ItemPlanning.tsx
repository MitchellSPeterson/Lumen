import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { AcceptanceCriterion, BugDetails, FeatureDetails, WorkItem } from './domain';

function CriterionText({ criterion, onChange }: { criterion: AcceptanceCriterion; onChange(text: string): void }) {
  const [text, setText] = useState(criterion.text);
  useEffect(() => setText(criterion.text), [criterion.text]);
  return <input aria-label="Acceptance criterion" value={text} maxLength={2000} onChange={event => setText(event.target.value)} onBlur={() => { if (text.trim()) onChange(text.trim()); else setText(criterion.text); }} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) event.currentTarget.blur(); }} />;
}

export function ItemPlanning({ item, onChange }: { item: WorkItem; onChange(details: WorkItem['details']): void }) {
  const [criterionText, setCriterionText] = useState('');
  if (item.kind === 'feature') {
    const feature: FeatureDetails = item.details.feature ?? { problem: '', expectedBehavior: '', acceptanceCriteria: [], openQuestions: '' };
    const patch = (change: Partial<FeatureDetails>) => onChange({ ...item.details, feature: { ...feature, ...change } });
    const completed = feature.acceptanceCriteria.filter(criterion => criterion.checked).length;
    return <details className="detail-section planning-section">
      <summary>Feature plan<span>{feature.acceptanceCriteria.length ? `${completed}/${feature.acceptanceCriteria.length} verified` : 'Optional'}</span></summary>
      <label className="planning-field">Problem to solve<textarea value={feature.problem} rows={3} maxLength={8000} placeholder="Who needs this, and why?" onChange={event => patch({ problem: event.target.value })} /></label>
      <label className="planning-field">Expected behavior<textarea value={feature.expectedBehavior} rows={3} maxLength={8000} placeholder="What should the feature do?" onChange={event => patch({ expectedBehavior: event.target.value })} /></label>
      <h3>Acceptance criteria</h3><p className="planning-hint">Behaviors to verify, separate from implementation tasks.</p>
      <div className="acceptance-list">{feature.acceptanceCriteria.map(criterion => <div className="acceptance-row" key={criterion.id}>
        <input type="checkbox" aria-label={`Verify ${criterion.text}`} checked={criterion.checked} onChange={event => patch({ acceptanceCriteria: feature.acceptanceCriteria.map(existing => existing.id === criterion.id ? { ...existing, checked: event.target.checked } : existing) })} />
        <CriterionText criterion={criterion} onChange={text => patch({ acceptanceCriteria: feature.acceptanceCriteria.map(existing => existing.id === criterion.id ? { ...existing, text } : existing) })} />
        <button className="icon-button" aria-label={`Remove criterion ${criterion.text}`} onClick={() => patch({ acceptanceCriteria: feature.acceptanceCriteria.filter(existing => existing.id !== criterion.id) })}><X size={13} /></button>
      </div>)}</div>
      <form className="add-criterion" onSubmit={event => { event.preventDefault(); if (!criterionText.trim()) return; patch({ acceptanceCriteria: [...feature.acceptanceCriteria, { id: crypto.randomUUID(), text: criterionText.trim(), checked: false }] }); setCriterionText(''); }}>
        <input aria-label="New acceptance criterion" placeholder="Add a behavior to verify…" value={criterionText} maxLength={2000} onChange={event => setCriterionText(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)) event.preventDefault(); }} />
        <button className="icon-button" aria-label="Add acceptance criterion" disabled={!criterionText.trim()}><Plus size={15} /></button>
      </form>
      <label className="planning-field">Open questions<textarea value={feature.openQuestions} rows={3} maxLength={8000} placeholder="What still needs a decision?" onChange={event => patch({ openQuestions: event.target.value })} /></label>
    </details>;
  }
  if (item.kind === 'bug') {
    const bug: BugDetails = item.details.bug ?? { stepsToReproduce: '', expectedBehavior: '', actualBehavior: '' };
    const patch = (change: Partial<BugDetails>) => onChange({ ...item.details, bug: { ...bug, ...change } });
    return <details className="detail-section planning-section">
      <summary>Bug report<span>Optional</span></summary>
      <label className="planning-field">Steps to reproduce<textarea value={bug.stepsToReproduce} rows={4} maxLength={8000} placeholder="1. Open…\n2. Click…" onChange={event => patch({ stepsToReproduce: event.target.value })} /></label>
      <label className="planning-field">Expected behavior<textarea value={bug.expectedBehavior} rows={3} maxLength={8000} onChange={event => patch({ expectedBehavior: event.target.value })} /></label>
      <label className="planning-field">Actual behavior<textarea value={bug.actualBehavior} rows={3} maxLength={8000} onChange={event => patch({ actualBehavior: event.target.value })} /></label>
    </details>;
  }
  return null;
}
