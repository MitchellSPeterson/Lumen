import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SymbolView } from '@/lib/symbols';
import { useStore } from '@/lib/store';
import { colors, space } from '@/lib/theme';
import { ProjectRow } from '@/components/home/ProjectRow';
import { HeaderButton } from '@/components/HeaderButton';
import { Card, Pill, Separator } from '@/components/home/ui';

const ios = process.env.EXPO_OS !== 'android';

export default function Projects() {
  const router = useRouter();
  const projects = useStore(s => s.workspace.projects);
  const items = useStore(s => s.workspace.items);
  const saveStatus = useStore(s => s.saveStatus);
  const saveError = useStore(s => s.saveError);
  const counts = useMemo(() => {
    const m = new Map<string, { total: number; open: number }>();
    for (const i of items) {
      const c = m.get(i.projectId) ?? { total: 0, open: 0 };
      c.total++; if (i.status !== 'done') c.open++;
      m.set(i.projectId, c);
    }
    return m;
  }, [items]);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.groupedBackground }}
      contentContainerStyle={{ padding: space.md, gap: space.md, flexGrow: 1 }}>
      {process.env.EXPO_OS === 'android' && <Stack.Screen options={{ headerRight: () => (
        <>
          <HeaderButton icon="gearshape" label="Settings" onPress={() => router.push('/settings')} />
          <HeaderButton icon="plus" label="New project" onPress={() => router.push('/new-project')} />
        </>
      ) }} />}
      {ios && <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button icon="gearshape" accessibilityLabel="Settings" onPress={() => router.push('/settings')} />
      </Stack.Toolbar>}
      {ios && <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button icon="plus" accessibilityLabel="New project" onPress={() => router.push('/new-project')} />
      </Stack.Toolbar>}

      {saveStatus === 'error' && (
        <View accessibilityRole="alert" style={{ flexDirection: 'row', gap: space.base, alignItems: 'center' }}>
          <SymbolView name="exclamationmark.triangle.fill" size={16} tintColor={colors.warning} />
          <Text style={{ color: colors.label, fontSize: 13, flex: 1 }}>Changes couldn't be saved: {saveError}</Text>
          <Pill primary={false} label="Retry" onPress={() => void useStore.getState().flush().catch(() => {})} />
        </View>
      )}

      {projects.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, paddingHorizontal: space.lg, paddingBottom: 80 }}>
          <SymbolView name="folder.badge.plus" size={48} tintColor={colors.tertiaryLabel} />
          <View style={{ gap: space.tight, alignItems: 'center' }}>
            <Text style={{ color: colors.label, fontSize: 22, fontWeight: '600' }}>No projects yet</Text>
            <Text style={{ color: colors.secondaryLabel, fontSize: 15, textAlign: 'center' }}>Create a project to start planning, or import a backup from Lumen desktop in Settings.</Text>
          </View>
          <Pill icon="plus" label="New project" onPress={() => router.push('/new-project')} />
        </View>
      ) : (
        <Card>
          {projects.map((p, n) => (
            <View key={p.id}>
              {n > 0 && <Separator />}
              <ProjectRow project={p} total={counts.get(p.id)?.total ?? 0} open={counts.get(p.id)?.open ?? 0} />
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}
