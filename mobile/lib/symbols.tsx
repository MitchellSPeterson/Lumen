import { SymbolView as Native, type SFSymbol, type SymbolViewProps } from 'expo-symbols';

// SF Symbol -> Material Symbol, so call sites keep one name. iOS ignores the table.
const material: Partial<Record<SFSymbol, NonNullable<Exclude<SymbolViewProps['name'], string>['android']>>> = {
  'lightbulb': 'lightbulb', 'checklist': 'checklist', 'sparkles': 'auto_awesome', 'ladybug': 'bug_report',
  'checkmark.square': 'check_box', 'star': 'star',
  'circle': 'radio_button_unchecked', 'circle.lefthalf.filled': 'contrast', 'checkmark.circle.fill': 'check_circle',
  'checkmark.circle': 'check_circle', 'checkmark': 'check', 'xmark': 'close', 'xmark.circle': 'cancel',
  'chevron.right': 'chevron_right', 'chevron.down': 'expand_more', 'plus': 'add', 'plus.circle.fill': 'add_circle', 'minus.circle': 'do_not_disturb_on',
  'flag.fill': 'flag', 'arrow.up': 'arrow_upward', 'arrow.down': 'arrow_downward', 'minus': 'remove',
  'bolt': 'bolt', 'arrow.right.circle': 'arrow_circle_right', 'clock': 'schedule', 'circle.dashed': 'radio_button_unchecked',
  'folder': 'folder', 'folder.fill': 'folder', 'folder.badge.plus': 'create_new_folder', 'questionmark.folder': 'folder_off',
  'exclamationmark.triangle.fill': 'warning', 'gearshape': 'settings', 'ellipsis.circle': 'more_vert', 'trash': 'delete',
  'magnifyingglass': 'search', 'square.and.arrow.up': 'ios_share', 'square.and.arrow.down': 'download',
  'arrow.up.left.and.arrow.down.right': 'fit_screen', 'wand.and.stars': 'auto_fix_high', 'square.stack.3d.up': 'layers',
  'slider.horizontal.3': 'tune', 'tray.full': 'inbox',
  'line.3.horizontal.decrease.circle': 'filter_list', 'line.3.horizontal.decrease.circle.fill': 'filter_list',
};

export const SymbolView = ({ name, ...props }: Omit<SymbolViewProps, 'name'> & { name: SFSymbol }) =>
  <Native name={{ ios: name, android: material[name] }} {...props} />;
