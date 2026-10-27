import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SymbolView } from '@/lib/symbols';
import { colors, radius, space, useAccent } from '@/lib/theme';

const chip = () => ({ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.fill } as const);

export function Tags({ tags, suggestions, onChange }: { tags: string[]; suggestions: string[]; onChange(tags: string[]): void }) {
  const accent = useAccent();
  const [text, setText] = useState('');
  const norm = (t: string) => t.trim().replace(/^#+/, '').slice(0, 40);
  const add = (raw: string) => {
    const t = norm(raw);
    if (t && !tags.some(x => x.toLowerCase() === t.toLowerCase())) onChange([...tags, t]);
    setText('');
  };
  const q = norm(text).toLowerCase();
  const suggested = suggestions.filter(s => !tags.includes(s) && (!q || s.toLowerCase().includes(q))).slice(0, 12);
  return (
    <View style={{ gap: space.base }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.base }}>
        {tags.map(t => (
          <Pressable key={t} accessibilityLabel={`Remove tag ${t}`} onPress={() => onChange(tags.filter(x => x !== t))} style={chip()}>
            <Text style={{ color: colors.label, fontSize: 15 }}>{t}</Text>
            <SymbolView name="xmark" size={10} weight="bold" tintColor={colors.secondaryLabel} />
          </Pressable>
        ))}
        <View style={chip()}>
          <SymbolView name="plus" size={12} weight="semibold" tintColor={accent} />
          <TextInput value={text} onChangeText={t => t.endsWith(',') ? add(t.slice(0, -1)) : setText(t)} onSubmitEditing={() => add(text)} onEndEditing={e => add(e.nativeEvent.text)}
            placeholder="Tag" placeholderTextColor={colors.secondaryLabel} accessibilityLabel="Add tag" autoCapitalize="none" autoCorrect={false} returnKeyType="done" submitBehavior="submit"
            style={{ color: colors.label, fontSize: 15, minWidth: 48, paddingVertical: 6 }} />
        </View>
      </View>
      {suggested.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.base }}>
          {suggested.map(s => (
            <Pressable key={s} onPress={() => add(s)} style={[chip(), { backgroundColor: undefined, borderWidth: 1, borderColor: colors.separator }]}>
              <Text style={{ color: colors.secondaryLabel, fontSize: 15 }}>{s}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
