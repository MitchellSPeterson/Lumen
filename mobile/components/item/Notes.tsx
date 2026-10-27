import { useMemo, useState } from 'react';
import { Text, View, useColorScheme } from 'react-native';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { useMarkdown } from 'react-native-marked';
import { colors, continuous, radius, space, useAccent } from '@/lib/theme';
import { Field } from './Field';

export function Notes({ notes, onCommit }: { notes: string; onCommit(t: string): void }) {
  const [editing, setEditing] = useState(!notes.trim());
  const [live, setLive] = useState(notes);
  const accent = useAccent();
  const scheme = useColorScheme();
  const theme = useMemo(() => ({ colors: { text: colors.label, link: accent, code: colors.fill, border: colors.separator } }), [accent]);
  const styles = useMemo(() => ({ text: { color: colors.label }, li: { color: colors.label }, codeText: { color: colors.label } }), []);
  const nodes = useMarkdown(live, { colorScheme: scheme, theme, styles });
  return (
    <View style={{ gap: space.base }}>
      <SegmentedControl values={['Edit', 'Preview']} selectedIndex={editing ? 0 : 1} onChange={e => setEditing(e.nativeEvent.selectedSegmentIndex === 0)} />
      <View style={{ backgroundColor: colors.secondaryGroupedBackground, borderRadius: radius.card, ...continuous, padding: space.md, minHeight: 160 }}>
        {editing
          ? <Field value={notes} onCommit={t => { setLive(t); onCommit(t); }} multiline scrollEnabled={false} placeholder="Write notes in Markdown" placeholderTextColor={colors.tertiaryLabel}
              style={{ color: colors.label, fontSize: 17, minHeight: 130, textAlignVertical: 'top' }} />
          : live.trim() ? <View>{nodes}</View> : <Text style={{ color: colors.tertiaryLabel, fontSize: 17 }}>Nothing to preview</Text>}
      </View>
    </View>
  );
}
