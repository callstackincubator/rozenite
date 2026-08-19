import type { Meta, StoryObj } from '@storybook/react-vite';
import { Alert } from '@rozenite/ui';

const meta = {
  component: Alert,
  title: 'Components/Alert',
  parameters: {
    docs: {
      description: {
        component: 'A tone-aware strip for surfacing status, warnings, or errors inline.',
      },
    },
  },
} satisfies Meta<typeof Alert>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Compare every tone.
 * @summary Compare every alert tone.
 */
export const AllTones: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <Alert tone="neutral">
        <Alert.Description>A neutral, informational note.</Alert.Description>
      </Alert>
      <Alert tone="info">
        <Alert.Title>Heads up</Alert.Title>
        <Alert.Description>New data is available.</Alert.Description>
      </Alert>
      <Alert tone="success">
        <Alert.Title>Saved</Alert.Title>
        <Alert.Description>Your changes were saved.</Alert.Description>
      </Alert>
      <Alert tone="warning">
        <Alert.Title>Careful</Alert.Title>
        <Alert.Description>This action may be slow on large datasets.</Alert.Description>
      </Alert>
      <Alert tone="danger">
        <Alert.Title>Connection lost</Alert.Title>
        <Alert.Description>Reconnect to resume streaming events.</Alert.Description>
      </Alert>
    </div>
  ),
};
