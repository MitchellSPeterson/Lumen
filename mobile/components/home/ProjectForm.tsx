import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { validProjectImage } from '@shared/domain';
import { colors, space, useAccent } from '@/lib/theme';
import { Card, Footnote, Pill, ProjectTile, Separator } from './ui';

export interface ProjectDraft { name: string; folder: string; image?: string }

/** Name, repository folder and image fields shared by New project and Project settings. */
export function ProjectForm({ draft, onChange, autoFocus }: { draft: ProjectDraft; onChange: (d: ProjectDraft) => void; autoFocus?: boolean }) {
  const tint = useAccent();
  const [error, setError] = useState('');

  async function pick() {
    setError('');
    try {
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6, base64: true });
      const a = r.canceled ? undefined : r.assets[0];
      if (!a) return;
      const url = a.base64 ? `data:${a.mimeType === 'image/png' ? 'image/png' : 'image/jpeg'};base64,${a.base64}` : '';
      if (!validProjectImage(url)) { setError((a.base64?.length ?? 0) > 2_000_000 ? 'Choose an image smaller than 2 MB.' : 'Could not read this image. Choose another file.'); return; }
      onChange({ ...draft, image: url });
    } catch (e) { setError(`Could not open your photos: ${e instanceof Error ? e.message : e}`); }
  }

  const input = { color: colors.label, fontSize: 17, minHeight: 44, paddingHorizontal: space.md, paddingVertical: space.base } as const;
  return (
    <View style={{ gap: space.md }}>
      <View style={{ alignItems: 'center', gap: space.base }}>
        <ProjectTile name={draft.name} image={draft.image} size={72} />
        <View style={{ flexDirection: 'row', gap: space.base }}>
          <Pill primary={false} label={draft.image ? 'Change image' : 'Add image'} onPress={() => void pick()} />
          {draft.image ? <Pill primary={false} label="Remove" onPress={() => onChange({ ...draft, image: undefined })} /> : null}
        </View>
        {error ? <Text accessibilityRole="alert" style={{ color: colors.destructive, fontSize: 13 }}>{error}</Text> : null}
      </View>
      <Card>
        <TextInput value={draft.name} onChangeText={name => onChange({ ...draft, name })} placeholder="Name" placeholderTextColor={colors.tertiaryLabel}
          autoFocus={autoFocus} returnKeyType="next" selectionColor={tint} accessibilityLabel="Project name" style={input} />
        <Separator />
        <TextInput value={draft.folder} onChangeText={folder => onChange({ ...draft, folder })} placeholder="Repository folder" placeholderTextColor={colors.tertiaryLabel}
          autoCapitalize="none" autoCorrect={false} selectionColor={tint} accessibilityLabel="Repository folder" style={input} />
      </Card>
      <Footnote>The repository folder is optional. {process.env.EXPO_OS === 'android' ? 'Android' : 'iPhone'} can't browse folders, so enter the path to match this project with its Lumen desktop project.</Footnote>
    </View>
  );
}
