import { Alert, Pressable, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { SymbolView } from '@/lib/symbols';
import type { Project } from '@shared/domain';
import { colors, space } from '@/lib/theme';
import { useStore } from '@/lib/store';
import { actionSheet } from '@/components/Dialogs';
import { ProjectTile } from './ui';

export function confirmDeleteProject(project: Project, itemCount: number, onDeleted?: () => void) {
  Alert.alert('Delete project?',
    `“${project.name}” and ${itemCount} ${itemCount === 1 ? 'item' : 'items'} will be permanently deleted, including their related links. Export a backup first if you need a copy.`,
    [{ text: 'Cancel', style: 'cancel' },
     { text: 'Delete project', style: 'destructive', onPress: () => { useStore.getState().deleteProject(project.id); onDeleted?.(); } }]);
}

/** Tappable project row with a long-press context menu. */
export function ProjectRow({ project, total, open }: { project: Project; total: number; open: number }) {
  const router = useRouter();
  const summary = total === 0 ? 'No items' : `${total} ${total === 1 ? 'item' : 'items'} · ${open} open`;
  const go = () => { useStore.getState().setActiveProject(project.id); router.push({ pathname: '/project/[id]', params: { id: project.id } }); };
  const settings = () => router.push({ pathname: '/project-settings/[id]', params: { id: project.id } });
  const row = (
    <View style={{ minHeight: 60, paddingHorizontal: space.md, paddingVertical: space.base, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <ProjectTile name={project.name} image={project.image} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={{ color: colors.label, fontSize: 17, fontWeight: '600' }}>{project.name}</Text>
        <Text numberOfLines={1} style={{ color: colors.secondaryLabel, fontSize: 15, fontVariant: ['tabular-nums'] }}>{summary}</Text>
        {project.folder ? <Text numberOfLines={1} ellipsizeMode="head" style={{ color: colors.tertiaryLabel, fontSize: 13 }}>{project.folder}</Text> : null}
      </View>
      <SymbolView name="chevron.right" size={13} weight="semibold" tintColor={colors.tertiaryLabel} />
    </View>
  );
  if (process.env.EXPO_OS === 'android') {
    return (
      <Pressable accessibilityRole="button" android_ripple={{ color: colors.fill }} onPress={go}
        onLongPress={() => actionSheet(project.name, [['Project settings', settings], ['Delete project', () => confirmDeleteProject(project, total), true]])}>
        {row}
      </Pressable>
    );
  }
  return (
    <Link href={{ pathname: '/project/[id]', params: { id: project.id } }} onPress={() => useStore.getState().setActiveProject(project.id)}>
      <Link.Trigger>{row}</Link.Trigger>
      <Link.Menu>
        <Link.MenuAction title="Project settings" icon="slider.horizontal.3" onPress={settings} />
        <Link.MenuAction title="Delete project" icon="trash" destructive onPress={() => confirmDeleteProject(project, total)} />
      </Link.Menu>
    </Link>
  );
}
