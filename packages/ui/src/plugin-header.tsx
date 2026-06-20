import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { ToggleButton, ToggleButtonGroup } from '@heroui/react';
import { Monitor, MoonStar, SunMedium } from 'lucide-react';
import { cn } from './utils/cn.js';
import { usePluginTheme, type PluginThemeName } from './plugin-theme.js';

type PluginHeaderProps = ComponentPropsWithoutRef<'header'> & {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  showThemeSwitcher?: boolean;
};

type ThemeOption = {
  label: string;
  theme: Extract<PluginThemeName, 'light' | 'dark' | 'system'>;
  icon: typeof SunMedium;
};

const themeOptions: ThemeOption[] = [
  {
    label: 'Light theme',
    theme: 'light',
    icon: SunMedium,
  },
  {
    label: 'Dark theme',
    theme: 'dark',
    icon: MoonStar,
  },
  {
    label: 'System theme',
    theme: 'system',
    icon: Monitor,
  },
];

function PluginThemeSwitcher() {
  const { theme, setTheme } = usePluginTheme();
  const selectedTheme = theme === 'default' ? 'system' : theme;

  return (
    <ToggleButtonGroup
      aria-label="Theme switcher"
      disallowEmptySelection
      orientation="horizontal"
      selectedKeys={[selectedTheme]}
      selectionMode="single"
      size="sm"
      onSelectionChange={(keys) => {
        const [nextTheme] = Array.from(keys);

        if (
          nextTheme === 'light' ||
          nextTheme === 'dark' ||
          nextTheme === 'system'
        ) {
          setTheme(nextTheme);
        }
      }}
    >
      {themeOptions.map((option) => {
        const Icon = option.icon;

        return (
          <ToggleButton
            key={option.theme}
            aria-label={`Use ${option.label.toLowerCase()}`}
            id={option.theme}
            isIconOnly
            variant="default"
          >
            <Icon />
          </ToggleButton>
        );
      })}
    </ToggleButtonGroup>
  );
}

export function PluginHeader({
  title,
  subtitle,
  actions,
  showThemeSwitcher = true,
  className,
  ...props
}: PluginHeaderProps) {
  return (
    <header
      className={cn('sticky top-0 z-20 flex flex-wrap items-center gap-3 bg-background px-4 py-3 border-b border-border', className)}
      {...props}
    >
      <div className="min-w-0 flex-1 flex flex-col justify-center min-h-[2.5rem]">
        <h1 className="truncate text-sm font-semibold text-foreground">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 truncate text-xs text-muted">{subtitle}</p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          {actions}
        </div>
      ) : null}

      {showThemeSwitcher ? <PluginThemeSwitcher /> : null}
    </header>
  );
}
