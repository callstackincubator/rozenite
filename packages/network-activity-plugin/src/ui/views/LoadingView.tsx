import { PluginShell, RozeniteLoader, Text } from '@rozenite/ui';

export const LoadingView = () => {
  return (
    <PluginShell className="items-center justify-center gap-4">
      <RozeniteLoader />
      <div className="flex flex-col items-center gap-1 text-center">
        <Text variant="heading">Loading Network Inspector</Text>
        <Text variant="caption">Initializing network monitoring...</Text>
      </div>
    </PluginShell>
  );
};
