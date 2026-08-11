import { Flag } from 'lucide-react';
import { EmptyState, PluginShell } from '@rozenite/ui';
import './globals.css';

export default function FeatureFlagsPanel() {
  return (
    <PluginShell>
      <PluginShell.Body>
        <EmptyState
          icon={Flag}
          title="No providers registered"
          description="Call useRozeniteFeatureFlagsPlugin with at least one provider to see your flags here."
        />
      </PluginShell.Body>
    </PluginShell>
  );
}
