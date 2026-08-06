import { useState, type ComponentProps } from 'react';
import { cn } from '../utils/cn';
import {
  PluginPortalContainerContext,
  PluginThemeProvider,
  usePluginTheme,
} from '../theme/theme-context';

export type PluginShellProps = ComponentProps<'div'> & {
  /**
   * Skip the theme provider and design tokens entirely, rendering a bare
   * `h-screen` wrapper. For panels that bring their own styling story
   * (e.g. styled-components, or a third-party panel with its own theme).
   */
  unstyled?: boolean;
};

function PluginShellRoot({
  unstyled = false,
  className,
  children,
  ...props
}: PluginShellProps) {
  if (unstyled) {
    return (
      <div
        data-slot="plugin-shell"
        className={cn('flex h-screen min-h-0 flex-col', className)}
        {...props}
      >
        {children}
      </div>
    );
  }

  return (
    <PluginThemeProvider>
      <ThemedShell className={className} {...props}>
        {children}
      </ThemedShell>
    </PluginThemeProvider>
  );
}

function ThemedShell({
  className,
  children,
  ...props
}: Omit<PluginShellProps, 'unstyled'>) {
  const { theme } = usePluginTheme();
  const [rootElement, setRootElement] = useState<HTMLDivElement | null>(null);

  return (
    <div
      ref={setRootElement}
      data-slot="plugin-shell"
      className={cn(
        theme === 'dark' && 'dark',
        'flex h-screen min-h-0 flex-col bg-background text-foreground',
        className,
      )}
      {...props}
    >
      <PluginPortalContainerContext.Provider value={rootElement}>
        {children}
      </PluginPortalContainerContext.Provider>
    </div>
  );
}

export type PluginShellBodyProps = ComponentProps<'div'>;

function PluginShellBody({ className, ...props }: PluginShellBodyProps) {
  return (
    <div
      data-slot="plugin-shell-body"
      className={cn('flex min-h-0 flex-1 flex-col overflow-auto', className)}
      {...props}
    />
  );
}

/** The themed layout root that provides design tokens and portal context. */
export const PluginShell = Object.assign(PluginShellRoot, {
  Body: PluginShellBody,
});
