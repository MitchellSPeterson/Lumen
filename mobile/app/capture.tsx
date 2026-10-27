import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from '@/lib/symbols';
import * as Haptics from 'expo-haptics';
import { kindLabels, type ItemKind } from '@shared/domain';
import { useStore } from '@/lib/store';
import { colors, continuous, radius, space, useAccent } from '@/lib/theme';
import { useCaptured } from '@/components/project/model';

const kinds: ItemKind[] = ['idea', 'todo', 'feature', 'bug'];

export default function Capture() {
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const accent = useAccent();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<ItemKind>('idea');
  const ready = !!projectId && title.trim().length > 0;

  function submit() {
    if (!ready) return;
    const { captureItem, setView } = useStore.getState();
    captureItem(projectId, title, kind);
    setView(projectId, { mode: 'outline' });
    useCaptured.setState(s => ({ seq: s.seq + 1, kind }));
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  }

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: space.md, gap: space.md }}>
      <TextInput
        autoFocus multiline submitBehavior="submit" returnKeyType="done" maxLength={300}
        value={title} onChangeText={setTitle} onSubmitEditing={submit}
        placeholder="What’s on your mind?" placeholderTextColor={colors.tertiaryLabel} accessibilityLabel="Title"
        style={{ minHeight: 44, fontSize: 20, color: colors.label, paddingVertical: space.base }}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.base }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ gap: space.base }}>
          {kinds.map(k => (
            <Pressable key={k} onPress={() => setKind(k)} accessibilityRole="button" accessibilityState={{ selected: kind === k }}
              style={{ minHeight: 36, justifyContent: 'center', paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: kind === k ? accent : colors.fill, ...continuous }}>
              <Text style={{ fontSize: 15, fontWeight: '500', color: kind === k ? '#fff' : colors.label }}>{kindLabels[k]}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable onPress={submit} disabled={!ready} accessibilityRole="button" accessibilityLabel="Save"
          style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: ready ? accent : colors.fill }}>
          <SymbolView name="arrow.up" size={20} weight="bold" tintColor={ready ? '#fff' : colors.tertiaryLabel} />
        </Pressable>
      </View>
      <Text style={{ fontSize: 13, color: colors.secondaryLabel }}>{kind === 'idea' ? 'Saved to Inbox.' : 'Saved to All items.'}</Text>
    </ScrollView>
  );
}
