import type { SFSymbol } from 'expo-symbols';
import { SymbolView } from '@/lib/symbols';
import type { ItemKind, Status } from '@shared/domain';
import { colors, useAccent } from '@/lib/theme';

export const kindSymbol: Record<ItemKind, SFSymbol> = { idea: 'lightbulb', todo: 'checklist', feature: 'sparkles', bug: 'ladybug' };
export const statusSymbol: Record<Status, SFSymbol> = { todo: 'circle', in_progress: 'circle.lefthalf.filled', done: 'checkmark.circle.fill' };

export const KindGlyph = ({ kind, size = 15 }: { kind: ItemKind; size?: number }) =>
  <SymbolView name={kindSymbol[kind]} size={size} tintColor={colors.secondaryLabel} />;

export function StatusGlyph({ status, size = 22 }: { status: Status; size?: number }) {
  const accent = useAccent();
  return <SymbolView name={statusSymbol[status]} size={size} tintColor={status === 'todo' ? colors.tertiaryLabel : accent} />;
}
