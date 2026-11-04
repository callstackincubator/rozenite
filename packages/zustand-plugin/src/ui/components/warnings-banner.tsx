import { useState } from 'react';
import { AlertTriangle, Copy, X } from 'lucide-react';
import { Alert, IconButton, useCopyToClipboard } from '@rozenite/ui';
import { panelActions, usePanelStore, warningKey } from '../state/panel-store';

/** Store-level warnings (not outermost, duplicate names, large state, …) with copyable fixes. */
export function WarningsBanner() {
  const warnings = usePanelStore((state) => state.warnings);
  const dismissed = usePanelStore((state) => state.dismissedWarnings);
  const selectedStoreId = usePanelStore((state) => state.selectedStoreId);
  const [expanded, setExpanded] = useState(false);
  const { copy } = useCopyToClipboard();

  const visible = warnings.filter(
    (warning) =>
      !dismissed.has(warningKey(warning)) &&
      (selectedStoreId === null || !warning.storeId || warning.storeId === selectedStoreId),
  );
  if (visible.length === 0) return null;
  const shown = expanded ? visible : visible.slice(-1);

  return (
    <Alert tone="warning" className="shrink-0 gap-0 rounded-none border-x-0 border-t-0 p-0 text-xs">
      {shown.map((warning) => (
        <div key={warningKey(warning)} className="flex items-start gap-2 px-3 py-1.5">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
          <div className="min-w-0 flex-1">
            <span className="text-foreground">
              {warning.storeId && (
                <span className="font-mono font-medium">{warning.storeId}: </span>
              )}
              {warning.message}
            </span>
            {warning.fix && (
              <span className="mt-1 flex items-center gap-1">
                <code className="min-w-0 truncate rounded-sm bg-background/60 px-1 py-0.5 font-mono">
                  {warning.fix}
                </code>
                <IconButton
                  size="sm"
                  tone="neutral"
                  variant="ghost"
                  className="size-5 [&_svg]:size-3"
                  label="Copy fix"
                  onClick={() => void copy(warning.fix ?? '')}
                >
                  <Copy />
                </IconButton>
              </span>
            )}
          </div>
          <IconButton
            size="sm"
            tone="neutral"
            variant="ghost"
            className="size-5"
            label="Dismiss"
            onClick={() => panelActions.dismissWarning(warning)}
          >
            <X />
          </IconButton>
        </div>
      ))}
      {visible.length > 1 && (
        <button
          type="button"
          className="w-full px-3 pb-1 text-left text-[11px] text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded
            ? 'Show fewer'
            : `${visible.length - 1} more warning${visible.length > 2 ? 's' : ''}`}
        </button>
      )}
    </Alert>
  );
}
