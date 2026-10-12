import type { ReactNode } from 'react';
import { AlertTriangle, Icon } from '@rozenite/ui';

/** The note under a body that did not parse as the type its Content-Type claims. */
export const ParseWarning = ({ children }: { children: ReactNode }) => (
  <div className="mt-2 flex items-center gap-1.5 text-xs text-warning">
    <Icon icon={AlertTriangle} size="sm" />
    <span>{children}</span>
  </div>
);
