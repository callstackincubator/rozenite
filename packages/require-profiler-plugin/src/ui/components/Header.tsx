export type HeaderProps = {
  onRefresh: () => void;
  onFetchDataAgain: () => void;
  onToggleSidebar: () => void;
  showSidebar: boolean;
  loading: boolean;
  clientAvailable: boolean;
};

export const Header = ({
  onRefresh,
  onFetchDataAgain,
  onToggleSidebar,
  showSidebar,
  loading,
  clientAvailable,
}: HeaderProps) => {
  return (
    <header className="header">
      <div className="header-left">
        <div className="logo">
          <span className="logo-text">Require Profiler</span>
        </div>
      </div>
      <div className="header-right">
        <button
          className="btn btn-icon"
          onClick={onFetchDataAgain}
          title="Fetch data again"
          disabled={loading || !clientAvailable}
          aria-label="Fetch data again"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7,10 12,15 17,10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>
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
