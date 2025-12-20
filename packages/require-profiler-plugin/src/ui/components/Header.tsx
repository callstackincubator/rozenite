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
    <header className="header">
      <div className="header-left">
        <div className="logo">
          <span className="logo-text">Require Profiler</span>
        </div>
      </div>
      <div className="header-right">
        {totalChains !== undefined && totalChains > 0 && (
          <div className="chain-nav">
            <button
              className="btn btn-icon"
              onClick={onPrevChain}
              title="Previous chain"
              disabled={loading || (currentChainIndex ?? 0) === 0}
              aria-label="Previous chain"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <span className="chain-counter">
              {(currentChainIndex ?? 0) + 1}/{totalChains}
            </span>
            <button
              className="btn btn-icon"
              onClick={onNextChain}
              title="Next chain"
              disabled={
                loading || (currentChainIndex ?? 0) === (totalChains ?? 0) - 1
              }
              aria-label="Next chain"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        )}
        <button
          className="btn btn-icon"
          onClick={onRefresh}
          title="Refresh data"
          disabled={loading || !clientAvailable}
          aria-label="Refresh data"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={loading ? 'spinning' : ''}
          >
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
          </svg>
        </button>
        <button
          className="btn btn-icon"
          onClick={onOpenOptions}
          title="Options"
          aria-label="Options"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
        <button
          className={`btn btn-icon ${showSidebar ? 'btn-primary' : ''}`}
          onClick={onToggleSidebar}
          title="Toggle details panel"
          aria-label="Toggle details panel"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M15 3v18" />
          </svg>
        </button>
      </div>
    </header>
  );
};
