import { PluginShell, Text } from '@rozenite/ui';

/**
 * Storybook is the real entry point of this package. This page only exists so `vite` has
 * something to serve; it points people at the component workshop.
 */
function App() {
  return (
    <PluginShell>
      <PluginShell.Body>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
          <Text variant="title">Rozenite UI</Text>
          <Text variant="caption">
            Run <code className="font-mono text-foreground">pnpm start:ui-storybook</code> to open
            the component workshop.
          </Text>
        </div>
      </PluginShell.Body>
    </PluginShell>
  );
}

export default App;
