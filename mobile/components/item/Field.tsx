import { useEffect, useRef } from 'react';
import { TextInput, type TextInputProps } from 'react-native';

/** Uncontrolled TextInput; commits debounced while typing and on blur/unmount. */
export function Field({ value, onCommit, ...props }: Omit<TextInputProps, 'value' | 'defaultValue'> & { value: string; onCommit(text: string): void }) {
  const pending = useRef<string | null>(null), timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const commit = useRef(onCommit);
  commit.current = onCommit;
  const flush = () => { clearTimeout(timer.current); if (pending.current !== null) { const t = pending.current; pending.current = null; commit.current(t); } };
  useEffect(() => flush, []);
  return <TextInput {...props} defaultValue={value}
    onChangeText={t => { pending.current = t; clearTimeout(timer.current); timer.current = setTimeout(flush, 400); }}
    onEndEditing={flush} />;
}
