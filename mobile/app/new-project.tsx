import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useStore } from '@/lib/store';
import { colors, space } from '@/lib/theme';
import { HeaderButton } from '@/components/HeaderButton';
import { ProjectForm, type ProjectDraft } from '@/components/home/ProjectForm';

const ios = process.env.EXPO_OS !== 'android';

export default function NewProject() {
  const router = useRouter();
  const [draft, setDraft] = useState<ProjectDraft>({ name: '', folder: '' });
  const ready = !!draft.name.trim();

  function create() {
    if (!ready) return;
    const id = useStore.getState().createProject(draft.name, draft.folder.trim(), draft.image);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.dismiss();
    router.push({ pathname: '/project/[id]', params: { id } });
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" style={{ backgroundColor: colors.groupedBackground }} contentContainerStyle={{ padding: space.md }}>
      {process.env.EXPO_OS === 'android' && <Stack.Screen options={{ headerLeft: () => <HeaderButton icon="xmark" label="Cancel" onPress={() => router.dismiss()} />, headerRight: () => <HeaderButton label="Create" disabled={!ready} onPress={create} /> }} />}
      {ios && <Stack.Toolbar placement="left"><Stack.Toolbar.Button onPress={() => router.dismiss()}>Cancel</Stack.Toolbar.Button></Stack.Toolbar>}
      {ios && <Stack.Toolbar placement="right"><Stack.Toolbar.Button variant="done" disabled={!ready} onPress={create}>Create</Stack.Toolbar.Button></Stack.Toolbar>}
      <ProjectForm draft={draft} onChange={setDraft} autoFocus />
    </ScrollView>
  );
}
