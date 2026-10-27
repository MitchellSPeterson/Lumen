import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useItemCount, useProject, useStore } from '@/lib/store';
import { colors, space } from '@/lib/theme';
import { HeaderButton } from '@/components/HeaderButton';
import { ProjectForm, type ProjectDraft } from '@/components/home/ProjectForm';
import { confirmDeleteProject } from '@/components/home/ProjectRow';
import { Card, Row } from '@/components/home/ui';

const ios = process.env.EXPO_OS !== 'android';

export default function ProjectSettings() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const project = useProject(id);
  const itemCount = useItemCount(id);
  const [draft, setDraft] = useState<ProjectDraft>({ name: project?.name ?? '', folder: project?.folder ?? '', image: project?.image });
  const leaving = useRef(false);
  const dirty = !!project && (draft.name !== project.name || draft.folder !== project.folder || draft.image !== project.image);
  const ready = !!draft.name.trim();

  useEffect(() => navigation.addListener('beforeRemove', e => {
    if (!dirty || leaving.current) return;
    e.preventDefault();
    Alert.alert('Discard changes?', 'Your edits to this project have not been saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard changes', style: 'destructive', onPress: () => { leaving.current = true; navigation.dispatch(e.data.action); } },
    ]);
  }), [navigation, dirty]);

  if (!project) return null;

  function done() {
    if (!ready) return;
    useStore.getState().updateProject(id, { name: draft.name.trim(), folder: draft.folder.trim(), image: draft.image });
    leaving.current = true;
    router.dismiss();
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" style={{ backgroundColor: colors.groupedBackground }} contentContainerStyle={{ padding: space.md, gap: space.lg }}>
      <Stack.Screen options={{ gestureEnabled: !dirty }} />
      {process.env.EXPO_OS === 'android' && <Stack.Screen options={{ headerLeft: () => <HeaderButton icon="xmark" label="Cancel" onPress={() => router.dismiss()} />, headerRight: () => <HeaderButton label="Done" disabled={!ready || !dirty} onPress={done} /> }} />}
      {ios && <Stack.Toolbar placement="left"><Stack.Toolbar.Button onPress={() => router.dismiss()}>Cancel</Stack.Toolbar.Button></Stack.Toolbar>}
      {ios && <Stack.Toolbar placement="right"><Stack.Toolbar.Button variant="done" disabled={!ready || !dirty} onPress={done}>Done</Stack.Toolbar.Button></Stack.Toolbar>}
      <ProjectForm draft={draft} onChange={setDraft} />
      <Card>
        <Row title="Delete project" destructive onPress={() => confirmDeleteProject(project, itemCount, () => { leaving.current = true; router.dismissTo('/'); })} />
      </Card>
    </ScrollView>
  );
}
