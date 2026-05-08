import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';

type DevHostPanelEntry = {
  label: string;
  source: string;
};

type DevHostState = {
  packageName: string;
  packageDescription: string;
  panels: DevHostPanelEntry[];
};

declare global {
  interface Window {
    __ROZENITE_DEV_HOST__?: DevHostState;
  }
}

const styles = `
  :root {
    color-scheme: dark;
    font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #101114;
    color: #f5f7fa;
  }

  * {
    box-sizing: border-box;
  }

  html,
  body,
  #root {
    height: 100%;
    margin: 0;
  }

  body {
    background:
      radial-gradient(circle at top, rgba(89, 125, 255, 0.16), transparent 32%),
      #101114;
  }

  button,
  input,
  textarea,
  select {
    font: inherit;
  }
`;

const shellStyles = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100%',
} as const;

const topbarStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '16px',
  padding: '14px 18px',
  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  background: 'rgba(19, 21, 27, 0.92)',
  backdropFilter: 'blur(12px)',
} as const;

const tabsStyles = {
  display: 'flex',
  gap: '8px',
  padding: '12px 18px 0',
  overflowX: 'auto',
} as const;

const frameWrapStyles = {
  flex: 1,
  minHeight: 0,
  padding: '14px 18px 18px',
} as const;

const frameCardStyles = {
  height: '100%',
  minHeight: '320px',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: '18px',
  overflow: 'hidden',
  background: 'rgba(6, 8, 12, 0.8)',
  boxShadow: '0 24px 80px rgba(0, 0, 0, 0.35)',
} as const;

const iframeStyles = {
  display: 'block',
  width: '100%',
  height: '100%',
  border: 0,
  background: 'white',
} as const;

const getInitialPanel = (panels: DevHostPanelEntry[]) => {
  const requestedPanel = new URLSearchParams(window.location.search).get('panel');

  if (requestedPanel) {
    const matchedPanel = panels.find((panel) => panel.label === requestedPanel);
    if (matchedPanel) {
      return matchedPanel;
    }
  }

  return panels[0] ?? null;
};

const HostApp = ({ packageName, packageDescription, panels }: DevHostState) => {
  const [activePanel, setActivePanel] = useState<DevHostPanelEntry | null>(() =>
    getInitialPanel(panels),
  );

  const activeSource = activePanel?.source ?? '';
  const activeLabel = activePanel?.label ?? '';

  const emptyState = panels.length === 0;

  const selectPanel = (panel: DevHostPanelEntry) => {
    setActivePanel(panel);
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('panel', panel.label);
    window.history.replaceState(null, '', nextUrl);
  };

  return (
    <>
      <style>{styles}</style>
      <div style={shellStyles}>
        <header style={topbarStyles}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
              {packageName}
            </h1>
            <p
              style={{
                margin: '3px 0 0',
                color: 'rgba(245, 247, 250, 0.7)',
                fontSize: '12px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {packageDescription}
            </p>
          </div>
        </header>

        <nav style={tabsStyles} aria-label="Plugin panels">
          {panels.map((panel) => {
            const isActive = panel.source === activeSource;

            return (
              <button
                key={panel.source}
                type="button"
                onClick={() => selectPanel(panel)}
                style={{
                  appearance: 'none',
                  border: isActive
                    ? '1px solid #4f7cff'
                    : '1px solid rgba(255, 255, 255, 0.1)',
                  background: isActive ? '#4f7cff' : 'rgba(255, 255, 255, 0.04)',
                  color: 'inherit',
                  borderRadius: '999px',
                  padding: '8px 12px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {panel.label}
              </button>
            );
          })}
        </nav>

        <main style={frameWrapStyles}>
          <div style={frameCardStyles}>
            {emptyState ? (
              <div
                style={{
                  display: 'flex',
                  height: '100%',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'rgba(245, 247, 250, 0.7)',
                  padding: '24px',
                  textAlign: 'center',
                }}
              >
                No panels were defined in rozenite.config.ts.
              </div>
            ) : (
              <iframe
                key={activeSource}
                title={activeLabel || 'Rozenite panel preview'}
                src={activeSource}
                style={iframeStyles}
              />
            )}
          </div>
        </main>
      </div>
    </>
  );
};

const state = window.__ROZENITE_DEV_HOST__;
const rootElement = document.getElementById('root');

if (!state || !rootElement) {
  throw new Error('Rozenite dev host failed to initialize.');
}

createRoot(rootElement).render(
  <StrictMode>
    <HostApp {...state} />
  </StrictMode>,
);
