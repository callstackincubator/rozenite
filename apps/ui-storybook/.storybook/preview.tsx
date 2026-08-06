import type { Preview } from '@storybook/react-vite';
import { PluginShell } from '@rozenite/ui';
import '../../../packages/ui/styles.css';

const preview: Preview = {
  decorators: [
    (Story, context) => {
      if (context.parameters.withPluginShell === false) {
        return <Story />;
      }

      return (
        <PluginShell className="min-h-screen w-full">
          <PluginShell.Body>
            <div className="min-h-full p-4">
              <Story />
            </div>
          </PluginShell.Body>
        </PluginShell>
      );
    },
  ],
  parameters: {
    layout: 'fullscreen',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo',
    },
  },
};

export default preview;
