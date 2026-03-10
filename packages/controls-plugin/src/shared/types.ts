export type ControlsTextItem = {
  id: string;
  type: 'text';
  title: string;
  value: string;
  description?: string;
};

export type ControlsToggleItem = {
  id: string;
  type: 'toggle';
  title: string;
  value: boolean;
  description?: string;
  disabled?: boolean;
  onToggle: (nextValue: boolean) => void | Promise<void>;
};

export type ControlsButtonItem = {
  id: string;
  type: 'button';
  title: string;
  actionLabel?: string;
  description?: string;
  disabled?: boolean;
  onPress: () => void | Promise<void>;
};

export type ControlsSelectOption = {
  label: string;
  value: string;
};

export type ControlsSelectItem = {
  id: string;
  type: 'select';
  title: string;
  value: string;
  options: ControlsSelectOption[];
  description?: string;
  disabled?: boolean;
  onSelect: (nextValue: string) => void | Promise<void>;
};

export type ControlsItem =
  | ControlsTextItem
  | ControlsToggleItem
  | ControlsButtonItem
  | ControlsSelectItem;

export type ControlsSection = {
  id: string;
  title: string;
  description?: string;
  items: ControlsItem[];
};

export type ControlsTextItemSnapshot = Omit<ControlsTextItem, never>;

export type ControlsToggleItemSnapshot = Omit<ControlsToggleItem, 'onToggle'>;

export type ControlsButtonItemSnapshot = Omit<ControlsButtonItem, 'onPress'>;

export type ControlsSelectItemSnapshot = Omit<ControlsSelectItem, 'onSelect'>;

export type ControlsItemSnapshot =
  | ControlsTextItemSnapshot
  | ControlsToggleItemSnapshot
  | ControlsButtonItemSnapshot
  | ControlsSelectItemSnapshot;

export type ControlsSectionSnapshot = Omit<ControlsSection, 'items'> & {
  items: ControlsItemSnapshot[];
};

export type RozeniteControlsPluginOptions = {
  sections: ControlsSection[];
};

export const createSection = <TSection extends ControlsSection>(
  section: TSection
): TSection => section;
