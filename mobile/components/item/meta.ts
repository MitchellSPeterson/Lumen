import type { SFSymbol } from 'sf-symbols-typescript';
import type { ItemKind, Priority, Status } from '@shared/domain';

export const kindSymbol: Record<ItemKind, SFSymbol> = { idea: 'lightbulb', todo: 'checkmark.square', feature: 'star', bug: 'ladybug' };
export const statusSymbol: Record<Status, SFSymbol> = { todo: 'circle', in_progress: 'circle.lefthalf.filled', done: 'checkmark.circle.fill' };
export const prioritySymbol: Record<Priority, SFSymbol> = { low: 'arrow.down', normal: 'minus', high: 'arrow.up' };
export const priorityLabels: Record<Priority, string> = { low: 'Low', normal: 'Normal', high: 'High' };
export const laneSymbol = { now: 'bolt', next: 'arrow.right.circle', later: 'clock', none: 'circle.dashed' } as const;
