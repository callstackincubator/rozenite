import type { ComponentProps } from 'react';
import { useRender } from '@base-ui/react/use-render';
import { Moon, Sun } from 'lucide-react';
import { cn } from '../utils/cn';
import { usePluginTheme } from '../theme/theme-context';

export type PluginHeaderProps = ComponentProps<'header'> & {
  render?: useRender.RenderProp;
};

function PluginHeaderRoot({ className, render, ref, ...props }: PluginHeaderProps) {
  return useRender({
    render: render ?? <header />,
    ref,
    props: {
      'data-slot': 'plugin-header',
      className: cn(
        'flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-3',
        className,
      ),
      ...props,
    },
  });
}

export type PluginHeaderTitleProps = ComponentProps<'h1'> & {
  render?: useRender.RenderProp;
};

function PluginHeaderTitle({ className, render, ref, ...props }: PluginHeaderTitleProps) {
  return useRender({
    render: render ?? <h1 />,
    ref,
    props: {
      'data-slot': 'plugin-header-title',
      className: cn('text-sm font-semibold text-foreground', className),
      ...props,
    },
  });
}

export type PluginHeaderSubtitleProps = ComponentProps<'p'> & {
  render?: useRender.RenderProp;
};

function PluginHeaderSubtitle({ className, render, ref, ...props }: PluginHeaderSubtitleProps) {
  return useRender({
    render: render ?? <p />,
    ref,
    props: {
      'data-slot': 'plugin-header-subtitle',
      className: cn('text-xs text-muted-foreground', className),
      ...props,
    },
  });
}

export type PluginHeaderActionsProps = ComponentProps<'div'> & {
  render?: useRender.RenderProp;
};

function PluginHeaderActions({ className, render, ref, ...props }: PluginHeaderActionsProps) {
  return useRender({
    render: render ?? <div />,
    ref,
    props: {
      'data-slot': 'plugin-header-actions',
      className: cn('ml-auto flex items-center gap-2', className),
      ...props,
    },
  });
}

export type PluginHeaderThemeSwitcherProps = ComponentProps<'button'> & {
  /** Accessible name shown while in dark theme (switches to light).
   * @default 'Switch to light theme' */
  lightLabel?: string;
  /** Accessible name shown while in light theme (switches to dark).
   * @default 'Switch to dark theme' */
  darkLabel?: string;
  render?: useRender.RenderProp;
};

function PluginHeaderThemeSwitcher({
  className,
  lightLabel = 'Switch to light theme',
  darkLabel = 'Switch to dark theme',
  render,
  ref,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- discarded so it can't override the Sun/Moon icon below via ...props
  children: _children,
  ...props
}: PluginHeaderThemeSwitcherProps) {
  const { theme, toggleTheme } = usePluginTheme();

  return useRender({
    render: render ?? <button type="button" />,
    ref,
    props: {
      'data-slot': 'plugin-header-theme-switcher',
      'aria-label': theme === 'dark' ? lightLabel : darkLabel,
      onClick: toggleTheme,
      className: cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground',
        'hover:bg-accent hover:text-accent-foreground',
        'outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'transition-colors',
        className,
      ),
      children: theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />,
      ...props,
    },
  });
}

/** A themed header with title, supporting text, actions, and theme switching. */
export const PluginHeader = Object.assign(PluginHeaderRoot, {
  Title: PluginHeaderTitle,
  Subtitle: PluginHeaderSubtitle,
  Actions: PluginHeaderActions,
  ThemeSwitcher: PluginHeaderThemeSwitcher,
});
