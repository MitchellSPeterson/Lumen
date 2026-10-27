import type { ReactNode } from 'react';
import { ScrollView, Text } from 'react-native';
import { colors, space } from './theme';

/** Placeholder screen body used until real screens replace it. */
export function Stub({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.groupedBackground }} contentContainerStyle={{ padding: space.md, gap: space.base }}>
      <Text style={{ color: colors.label, fontSize: 17, fontWeight: '600' }}>{title}</Text>
      {children}
    </ScrollView>
  );
}
export const Body = ({ children }: { children: ReactNode }) => <Text style={{ color: colors.secondaryLabel }}>{children}</Text>;
