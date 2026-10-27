import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { SymbolView } from '@/lib/symbols';
import { accents } from '@shared/appearance';
import { normalizeWorkspace, validateWorkspace } from '@shared/domain';
import { useStore } from '@/lib/store';
import { colors, space, useAccent } from '@/lib/theme';
import type { AccentId } from '@/lib/storage';
import { Card, Footnote, Row, SectionHeader, Separator } from '@/components/home/ui';

const modes = ['system', 'light', 'dark'] as const;
const swatch: Record<AccentId, string> = { blue: '#8fcdf5', violet: '#c3b2f5', green: '#8fd6b1', rose: '#eba6c0', amber: '#e8c56c' };
const statusText = { saved: 'Saved', saving: 'Saving…', error: 'Not saved' } as const;
const device = process.env.EXPO_OS === 'android' ? 'Android phone' : 'iPhone';
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

export default function Settings() {
  const tint = useAccent();
  const prefs = useStore(s => s.prefs);
  const setPrefs = useStore(s => s.setPrefs);
  const projectCount = useStore(s => s.workspace.projects.length);
  const saveStatus = useStore(s => s.saveStatus);
  const saveError = useStore(s => s.saveError);
  const [busy, setBusy] = useState(false);

  async function exportBackup() {
    setBusy(true);
    try {
      await useStore.getState().flush();
      const text = JSON.stringify(useStore.getState().workspace, null, 2);
      if (text.length > 10 * 1024 * 1024) throw new Error('Backup exceeds the 10 MB limit. Use smaller project images or remove unused data before exporting.');
      const file = new File(Paths.cache, `lumen-backup-${new Date().toISOString().slice(0, 10)}.json`);
      file.create({ overwrite: true });
      file.write(text);
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Export backup' });
    } catch (e) { Alert.alert('Backup failed', e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function importBackup() {
    setBusy(true);
    try {
      const pick = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain'], copyToCacheDirectory: true });
      const asset = pick.canceled ? undefined : pick.assets[0];
      if (!asset) return;
      if ((asset.size ?? 0) > 10 * 1024 * 1024) throw new Error('Backup exceeds the 10 MB limit.');
      const incoming = normalizeWorkspace(JSON.parse(await new File(asset.uri).text()));
      validateWorkspace(incoming);
      const n = incoming.projects.length;
      Alert.alert('Import backup?', `Adds ${plural(n, 'project')} as independent copies. Your existing projects are not changed.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Import', onPress: () => {
          useStore.getState().importBackup(incoming);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert('Backup imported', `Imported ${plural(n, 'project')} as independent copies.`);
        } },
      ]);
    } catch (e) { Alert.alert('Import failed', e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.groupedBackground }} contentContainerStyle={{ padding: space.md, gap: space.lg }}>
      <View style={{ gap: space.base }}>
        <SectionHeader>Appearance</SectionHeader>
        <Card>
          <View style={{ padding: space.md, gap: space.base }}>
            <SegmentedControl values={['System', 'Light', 'Dark']} selectedIndex={modes.indexOf(prefs.mode)}
              onChange={e => { void Haptics.selectionAsync(); setPrefs({ mode: modes[e.nativeEvent.selectedSegmentIndex] }); }} />
          </View>
          <Separator />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: space.md }} accessibilityRole="radiogroup">
            {accents.map(a => (
              <Pressable key={a.id} accessibilityRole="radio" accessibilityLabel={a.label} accessibilityState={{ selected: prefs.accent === a.id }}
                onPress={() => { void Haptics.selectionAsync(); setPrefs({ accent: a.id }); }} hitSlop={4}
                style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: swatch[a.id] }}>
                {prefs.accent === a.id && <SymbolView name="checkmark" size={18} weight="bold" tintColor="#1c1c1e" />}
              </Pressable>
            ))}
          </View>
        </Card>
      </View>

      <View style={{ gap: space.base }}>
        <SectionHeader>Backups</SectionHeader>
        <Card>
          <Row title="Export backup" accent disabled={busy || projectCount === 0} onPress={() => void exportBackup()}>
            {busy ? <ActivityIndicator /> : <SymbolView name="square.and.arrow.up" size={17} tintColor={tint} />}
          </Row>
          <Separator />
          <Row title="Import backup" accent disabled={busy} onPress={() => void importBackup()}>
            <SymbolView name="square.and.arrow.down" size={17} tintColor={tint} />
          </Row>
        </Card>
        <Footnote>Backups are compatible with Lumen desktop. Export here and import there, or the other way around, to move your projects between devices. Imports are added as copies; nothing is overwritten.</Footnote>
      </View>

      <View style={{ gap: space.base }}>
        <SectionHeader>Plan with Codex</SectionHeader>
        <Footnote>AI planning runs in Lumen desktop, which uses the Codex CLI on your Mac. On {device}, plan by hand here, then export a backup to continue on desktop.</Footnote>
      </View>

      <View style={{ gap: space.base }}>
        <SectionHeader>About</SectionHeader>
        <Card>
          <Row title="Version" value={Constants.expoConfig?.version ?? '1.0.0'} />
          <Separator />
          <Row title="Storage" value={statusText[saveStatus]} />
        </Card>
        {saveStatus === 'error' && <Footnote tone="error">{saveError}</Footnote>}
        <Footnote>Your data is stored only on this {device}.</Footnote>
      </View>
    </ScrollView>
  );
}
