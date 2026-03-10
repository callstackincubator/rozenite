export type ControlsTextItem = {
  id: string;
  type: 'text';
  title: string;
  value: string;
  description?: string;
};

export type ControlsValidationResult =
  | { valid: true }
  | { valid: false; message: string };

export type ControlsMutableItemBase<TValue> = {
  id: string;
  title: string;
  value: TValue;
  description?: string;
  disabled?: boolean;
  validate?: (nextValue: TValue) => ControlsValidationResult;
  onUpdate: (nextValue: TValue) => void | Promise<void>;
};

export type ControlsToggleItem = ControlsMutableItemBase<boolean> & {
  type: 'toggle';
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

export type ControlsSelectItem = ControlsMutableItemBase<string> & {
  type: 'select';
  options: ControlsSelectOption[];
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

export type ControlsToggleItemSnapshot = Omit<
  ControlsToggleItem,
  'validate' | 'onUpdate'
>;

export type ControlsButtonItemSnapshot = Omit<ControlsButtonItem, 'onPress'>;

export type ControlsSelectItemSnapshot = Omit<
  ControlsSelectItem,
  'validate' | 'onUpdate'
>;

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
