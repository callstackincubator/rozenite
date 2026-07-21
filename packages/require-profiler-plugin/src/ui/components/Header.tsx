import { Button, PluginHeader } from '@rozenite/ui';
import { ChevronLeft, ChevronRight, PanelRight, RefreshCw, Settings } from 'lucide-react';

export type HeaderProps = {
  onRefresh: () => void;
  onToggleSidebar: () => void;
  onOpenOptions: () => void;
  showSidebar: boolean;
  loading: boolean;
  clientAvailable: boolean;
  currentChainIndex?: number;
  totalChains?: number;
  onPrevChain?: () => void;
  onNextChain?: () => void;
};

export const Header = ({
  onRefresh,
  onToggleSidebar,
  onOpenOptions,
  showSidebar,
  loading,
  clientAvailable,
  currentChainIndex,
  totalChains,
  onPrevChain,
  onNextChain,
}: HeaderProps) => {
  return (
    <PluginHeader
      title="Require Profiler"
      subtitle="Visualize module load time and require chains."
      actions={
        <div className="flex items-center gap-1">
          {totalChains !== undefined && totalChains > 0 && (
            <div className="flex items-center gap-1 mr-1">
              <Button
                isIconOnly
                size="sm"
                variant="secondary"
                onPress={onPrevChain}
                isDisabled={loading || (currentChainIndex ?? 0) === 0}
                aria-label="Previous chain"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs text-muted min-w-[3ch] text-center tabular-nums">
                {(currentChainIndex ?? 0) + 1}/{totalChains}
              </span>
              <Button
                isIconOnly
                size="sm"
                variant="secondary"
                onPress={onNextChain}
                isDisabled={
                  loading || (currentChainIndex ?? 0) === (totalChains ?? 0) - 1
                }
                aria-label="Next chain"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          <Button
            isIconOnly
            size="sm"
            variant="secondary"
            onPress={onRefresh}
            isDisabled={loading || !clientAvailable}
            aria-label="Refresh data"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant="secondary"
            onPress={onOpenOptions}
            aria-label="Options"
          >
            <Settings className="h-3.5 w-3.5" />
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant={showSidebar ? 'primary' : 'secondary'}
            onPress={onToggleSidebar}
            aria-label="Toggle details panel"
          >
            <PanelRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      }
    />
  );
};
