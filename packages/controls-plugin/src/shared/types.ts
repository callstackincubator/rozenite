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

export type ControlsItem =
  | ControlsTextItem
  | ControlsToggleItem
  | ControlsButtonItem;

export type ControlsSection = {
  id: string;
  title: string;
  description?: string;
  items: ControlsItem[];
};

export type ControlsTextItemSnapshot = Omit<ControlsTextItem, never>;

export type ControlsToggleItemSnapshot = Omit<ControlsToggleItem, 'onToggle'>;

export type ControlsButtonItemSnapshot = Omit<ControlsButtonItem, 'onPress'>;

export type ControlsItemSnapshot =
  | ControlsTextItemSnapshot
  | ControlsToggleItemSnapshot
  | ControlsButtonItemSnapshot;

export type ControlsSectionSnapshot = Omit<ControlsSection, 'items'> & {
  items: ControlsItemSnapshot[];
};

export type RozeniteControlsPluginOptions = {
  sections: ControlsSection[];
};

export const createSection = <TSection extends ControlsSection>(
  section: TSection
): TSection => section;
