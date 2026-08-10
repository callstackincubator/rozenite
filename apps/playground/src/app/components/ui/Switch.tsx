import { Switch as RNSwitch } from 'react-native';
import { useTheme } from '../../theme/useTheme';

type SwitchProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
};

export const Switch = ({ value, onValueChange, accessibilityLabel, disabled }: SwitchProps) => {
  const { theme } = useTheme();

  return (
    <RNSwitch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      trackColor={{ false: theme.colors.secondary, true: theme.colors.primary }}
      thumbColor={theme.colors.background}
    />
  );
};
