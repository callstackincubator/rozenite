import type { ComponentProps } from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from '../utils/cn';
import { usePluginTheme } from '../theme/theme-context';

export type PluginHeaderProps = ComponentProps<'header'>;

function PluginHeaderRoot({ className, ...props }: PluginHeaderProps) {
  return (
    <header
      data-slot="plugin-header"
      className={cn(
        'flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-3',
        className,
      )}
      {...props}
    />
  );
}

export type PluginHeaderTitleProps = ComponentProps<'h1'>;

function PluginHeaderTitle({ className, ...props }: PluginHeaderTitleProps) {
  return (
    <h1
      data-slot="plugin-header-title"
      className={cn('text-sm font-semibold text-foreground', className)}
      {...props}
    />
  );
}

export type PluginHeaderSubtitleProps = ComponentProps<'p'>;

function PluginHeaderSubtitle({
  className,
  ...props
}: PluginHeaderSubtitleProps) {
  return (
    <p
      data-slot="plugin-header-subtitle"
      className={cn('text-xs text-muted-foreground', className)}
      {...props}
    />
  );
}

export type PluginHeaderActionsProps = ComponentProps<'div'>;

function PluginHeaderActions({
  className,
  ...props
}: PluginHeaderActionsProps) {
  return (
    <div
      data-slot="plugin-header-actions"
      className={cn('ml-auto flex items-center gap-2', className)}
      {...props}
    />
  );
}

export type PluginHeaderThemeSwitcherProps = ComponentProps<'button'>;

function PluginHeaderThemeSwitcher({
  className,
  ...props
}: PluginHeaderThemeSwitcherProps) {
  const { theme, toggleTheme } = usePluginTheme();

  return (
    <button
      type="button"
      data-slot="plugin-header-theme-switcher"
      aria-label={
        theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
      }
      onClick={toggleTheme}
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground',
        'hover:bg-accent hover:text-accent-foreground',
        'outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'transition-colors',
        className,
      )}
      {...props}
    >
      {theme === 'dark' ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </button>
  );
}

/** A themed header with title, supporting text, actions, and theme switching. */
export const PluginHeader = Object.assign(PluginHeaderRoot, {
  Title: PluginHeaderTitle,
  Subtitle: PluginHeaderSubtitle,
  Actions: PluginHeaderActions,
  ThemeSwitcher: PluginHeaderThemeSwitcher,
});
