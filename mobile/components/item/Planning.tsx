import { useRef } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { SymbolView } from '@/lib/symbols';
import * as Haptics from 'expo-haptics';
import type { BugDetails, FeatureDetails, WorkItem } from '@shared/domain';
import { colors, continuous, radius, space, useAccent } from '@/lib/theme';
import { Field } from './Field';

const input = () => ({ color: colors.label, fontSize: 17, backgroundColor: colors.secondaryGroupedBackground, borderRadius: radius.control, ...continuous, paddingHorizontal: space.md, paddingVertical: space.base + 4, minHeight: 44 } as const);

export function Section({ title, detail, children }: { title: string; detail?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.base }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ color: colors.secondaryLabel, fontSize: 13, fontWeight: '600', textTransform: 'uppercase' }}>{title}</Text>
        {detail ? <Text style={{ color: colors.tertiaryLabel, fontSize: 13 }}>{detail}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const Labeled = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <View style={{ gap: space.tight }}>
    <Text style={{ color: colors.secondaryLabel, fontSize: 13 }}>{label}</Text>
    {children}
  </View>
);

const area = (rows: number) => ({ ...input(), minHeight: rows * 22 + 24, textAlignVertical: 'top' as const });

export function Planning({ item, onChange }: { item: WorkItem; onChange(details: WorkItem['details']): void }) {
  const accent = useAccent();
  const newCriterion = useRef<TextInput>(null);
  if (item.kind === 'feature') {
    const f: FeatureDetails = item.details.feature ?? { problem: '', expectedBehavior: '', acceptanceCriteria: [], openQuestions: '' };
    const patch = (c: Partial<FeatureDetails>) => onChange({ ...item.details, feature: { ...f, ...c } });
    const setCriteria = (fn: (a: FeatureDetails['acceptanceCriteria']) => FeatureDetails['acceptanceCriteria']) => patch({ acceptanceCriteria: fn(f.acceptanceCriteria) });
    const done = f.acceptanceCriteria.filter(c => c.checked).length;
    const add = (text: string) => { newCriterion.current?.clear(); if (text.trim()) setCriteria(a => [...a, { id: crypto.randomUUID(), text: text.trim(), checked: false }]); };
    return (
      <Section title="Feature plan" detail={f.acceptanceCriteria.length ? `${done}/${f.acceptanceCriteria.length} verified` : 'Optional'}>
        <Labeled label="Problem to solve">
          <Field value={f.problem} onCommit={problem => patch({ problem })} multiline maxLength={8000} placeholder="Who needs this, and why?" placeholderTextColor={colors.tertiaryLabel} style={area(3)} />
        </Labeled>
        <Labeled label="Expected behavior">
          <Field value={f.expectedBehavior} onCommit={expectedBehavior => patch({ expectedBehavior })} multiline maxLength={8000} placeholder="What should the feature do?" placeholderTextColor={colors.tertiaryLabel} style={area(3)} />
        </Labeled>
        <Labeled label="Acceptance criteria">
          <View style={{ backgroundColor: colors.secondaryGroupedBackground, borderRadius: radius.card, ...continuous, overflow: 'hidden' }}>
            {f.acceptanceCriteria.map(c => (
              <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.base, paddingLeft: space.base, paddingRight: space.md, minHeight: 44 }}>
                <Pressable hitSlop={8} accessibilityRole="checkbox" accessibilityState={{ checked: c.checked }} accessibilityLabel={`Verify ${c.text}`}
                  style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => { void Haptics.selectionAsync(); setCriteria(a => a.map(x => x.id === c.id ? { ...x, checked: !x.checked } : x)); }}>
                  <SymbolView name={c.checked ? 'checkmark.circle.fill' : 'circle'} size={24} tintColor={c.checked ? accent : colors.tertiaryLabel} />
                </Pressable>
                <Field value={c.text} maxLength={2000} multiline submitBehavior="blurAndSubmit" accessibilityLabel="Acceptance criterion"
                  onCommit={text => { if (text.trim()) setCriteria(a => a.map(x => x.id === c.id ? { ...x, text: text.trim() } : x)); }}
                  style={{ flex: 1, color: c.checked ? colors.secondaryLabel : colors.label, fontSize: 17, paddingVertical: 10 }} />
                <Pressable hitSlop={8} accessibilityLabel={`Remove criterion ${c.text}`} style={{ width: 32, height: 44, alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => Alert.alert('Remove criterion?', c.text, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => setCriteria(a => a.filter(x => x.id !== c.id)) }])}>
                  <SymbolView name="minus.circle" size={20} tintColor={colors.tertiaryLabel} />
                </Pressable>
              </View>
            ))}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.base, paddingLeft: space.base, paddingRight: space.md, minHeight: 44 }}>
              <View style={{ width: 44, alignItems: 'center' }}><SymbolView name="plus.circle.fill" size={24} tintColor={accent} /></View>
              <TextInput ref={newCriterion} accessibilityLabel="New acceptance criterion" placeholder="Add a behavior to verify" placeholderTextColor={colors.tertiaryLabel}
                maxLength={2000} returnKeyType="done" submitBehavior="submit" onSubmitEditing={e => add(e.nativeEvent.text)}
                style={{ flex: 1, color: colors.label, fontSize: 17, minHeight: 44 }} />
            </View>
          </View>
        </Labeled>
        <Labeled label="Open questions">
          <Field value={f.openQuestions} onCommit={openQuestions => patch({ openQuestions })} multiline maxLength={8000} placeholder="What still needs a decision?" placeholderTextColor={colors.tertiaryLabel} style={area(3)} />
        </Labeled>
      </Section>
    );
  }
  if (item.kind === 'bug') {
    const b: BugDetails = item.details.bug ?? { stepsToReproduce: '', expectedBehavior: '', actualBehavior: '' };
    const patch = (c: Partial<BugDetails>) => onChange({ ...item.details, bug: { ...b, ...c } });
    return (
      <Section title="Bug report" detail="Optional">
        <Labeled label="Steps to reproduce">
          <Field value={b.stepsToReproduce} onCommit={stepsToReproduce => patch({ stepsToReproduce })} multiline maxLength={8000} placeholder={'1. Open…\n2. Tap…'} placeholderTextColor={colors.tertiaryLabel} style={area(4)} />
        </Labeled>
        <Labeled label="Expected behavior">
          <Field value={b.expectedBehavior} onCommit={expectedBehavior => patch({ expectedBehavior })} multiline maxLength={8000} style={area(3)} />
        </Labeled>
        <Labeled label="Actual behavior">
          <Field value={b.actualBehavior} onCommit={actualBehavior => patch({ actualBehavior })} multiline maxLength={8000} style={area(3)} />
        </Labeled>
      </Section>
    );
  }
  return null;
}
