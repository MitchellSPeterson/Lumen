import { useState } from 'react';
import { ActionSheetIOS, Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from '@/lib/symbols';
import { colors, radius, space, useAccent } from '@/lib/theme';

export type Choice = [label: string, run: () => void, destructive?: boolean, selected?: boolean];
type Dialog = { title: string; message?: string; choices?: Choice[]; confirm?: string; onSubmit?: (text: string) => void };

// ActionSheetIOS / Alert.prompt are iOS-only; on Android a <DialogHost/> in the root layout renders these.
let open: (d: Dialog) => void = () => {};

export function actionSheet(title: string, choices: Choice[]) {
  if (process.env.EXPO_OS !== 'android') {
    const destructive = choices.findIndex(c => c[2]);
    return ActionSheetIOS.showActionSheetWithOptions(
      { title, options: [...choices.map(c => c[0]), 'Cancel'], cancelButtonIndex: choices.length, destructiveButtonIndex: destructive >= 0 ? destructive : undefined },
      i => choices[i]?.[1](),
    );
  }
  open({ title, choices });
}

export function promptText(title: string, message: string, confirm: string, onSubmit: (text: string) => void) {
  if (process.env.EXPO_OS !== 'android') {
    return Alert.prompt(title, message, [{ text: 'Cancel', style: 'cancel' }, { text: confirm, onPress: (t?: string) => onSubmit(t ?? '') }], 'plain-text', '');
  }
  open({ title, message, confirm, onSubmit });
}

export function DialogHost() {
  const [d, setD] = useState<Dialog | null>(null);
  const [text, setText] = useState('');
  const insets = useSafeAreaInsets();
  const accent = useAccent();
  open = next => { setText(''); setD(next); };
  const close = () => setD(null);

  return (
    <Modal visible={!!d} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
      <Pressable accessibilityLabel="Dismiss" onPress={close} style={{ flex: 1, backgroundColor: '#0006', justifyContent: d?.choices ? 'flex-end' : 'flex-start', paddingTop: d?.choices ? 0 : insets.top + 96, paddingHorizontal: d?.choices ? 0 : space.lg }}>
        {d?.choices ? (
          <Pressable style={{ backgroundColor: colors.secondaryGroupedBackground, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: space.base, paddingBottom: insets.bottom + space.base }}>
            <View style={{ alignSelf: 'center', width: 32, height: 4, borderRadius: 2, backgroundColor: colors.separator, marginBottom: space.base }} />
            <Text numberOfLines={1} style={{ color: colors.secondaryLabel, fontSize: 14, fontWeight: '500', paddingHorizontal: space.lg, paddingVertical: space.base }}>{d.title}</Text>
            <ScrollView bounces={false} style={{ maxHeight: 440 }}>
            {d.choices.map(([label, run, destructive, selected]) => (
              <Pressable key={label} accessibilityRole="button" android_ripple={{ color: colors.fill }} onPress={() => { close(); run(); }}
                style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: space.lg, gap: space.md }}>
                <Text style={{ flex: 1, fontSize: 16, color: destructive ? colors.destructive : colors.label }}>{label}</Text>
                {selected && <SymbolView name="checkmark" size={20} tintColor={accent} />}
              </Pressable>
            ))}
            </ScrollView>
          </Pressable>
        ) : d && (
          <Pressable style={{ backgroundColor: colors.secondaryGroupedBackground, borderRadius: 28, padding: space.lg, gap: space.md }}>
            <Text style={{ color: colors.label, fontSize: 22 }}>{d.title}</Text>
            {d.message && <Text style={{ color: colors.secondaryLabel, fontSize: 14 }}>{d.message}</Text>}
            <TextInput autoFocus value={text} onChangeText={setText} accessibilityLabel={d.title} selectionColor={accent}
              style={{ color: colors.label, fontSize: 16, minHeight: 48, borderWidth: 1, borderColor: colors.separator, borderRadius: radius.control, paddingHorizontal: space.md }} />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: space.md }}>
              <Pressable onPress={close} style={{ padding: space.base }}><Text style={{ color: accent, fontSize: 15, fontWeight: '500' }}>Cancel</Text></Pressable>
              <Pressable onPress={() => { close(); d.onSubmit?.(text); }} style={{ padding: space.base }}><Text style={{ color: accent, fontSize: 15, fontWeight: '500' }}>{d.confirm}</Text></Pressable>
            </View>
          </Pressable>
        )}
      </Pressable>
    </Modal>
  );
}
