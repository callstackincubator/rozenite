import React from 'react';

// Skeleton UI – mimics a typical React Native app screen
function AppSkeleton() {
  return (
    <div style={styles.appContent}>
      {/* Header */}
      <div style={styles.appHeader}>
        <div style={{ ...styles.bone, width: 80, height: 12, borderRadius: 6 }} />
        <div style={{ ...styles.bone, width: 20, height: 20, borderRadius: '50%' }} />
      </div>

      {/* Hero banner */}
      <div style={{ ...styles.bone, width: '100%', height: 64, borderRadius: 8, marginBottom: 12 }} />

      {/* List items */}
      {[1, 2, 3].map((i) => (
        <div key={i} style={styles.listItem}>
          <div style={{ ...styles.bone, width: 36, height: 36, borderRadius: 8, flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
            <div style={{ ...styles.bone, width: '70%', height: 10, borderRadius: 5 }} />
            <div style={{ ...styles.bone, width: '50%', height: 8, borderRadius: 5 }} />
          </div>
        </div>
      ))}

      {/* Bottom nav */}
      <div style={styles.bottomNav}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 4 }}>
            <div style={{ ...styles.bone, width: 20, height: 20, borderRadius: 6, opacity: i === 1 ? 1 : 0.4 }} />
            <div style={{ ...styles.bone, width: 28, height: 6, borderRadius: 3, opacity: i === 1 ? 1 : 0.4 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// Mobile device frame
function MobileDevice() {
  return (
    <div style={styles.mobileWrapper}>
      <div style={styles.mobileLabel}>React Native</div>
      <div style={styles.mobileDevice}>
        {/* Notch */}
        <div style={styles.mobileNotch} />
        {/* Screen */}
        <div style={styles.mobileScreen}>
          <AppSkeleton />
        </div>
        {/* Home indicator */}
        <div style={styles.mobileHomeBar} />
      </div>
    </div>
  );
}

// Desktop browser frame
function DesktopBrowser() {
  return (
    <div style={styles.desktopWrapper}>
      <div style={styles.desktopLabel}>React Native for Web</div>
      <div style={styles.desktopBrowser}>
        {/* Browser chrome */}
        <div style={styles.browserChrome}>
          <div style={styles.browserDots}>
            <div style={{ ...styles.dot, background: '#ff5f57' }} />
            <div style={{ ...styles.dot, background: '#ffbd2e' }} />
            <div style={{ ...styles.dot, background: '#28c840' }} />
          </div>
          <div style={styles.addressBar}>
            <div style={styles.addressText}>localhost:8081</div>
          </div>
        </div>
        {/* Browser content */}
        <div style={styles.browserContent}>
          <AppSkeleton />
        </div>
      </div>
    </div>
  );
}

export default function RozeniteWebIllustration() {
  return (
    <div style={styles.root}>
      <MobileDevice />
      <div style={styles.divider}>
        <div style={styles.dividerLine} />
        <div style={styles.dividerBadge}>same code</div>
        <div style={styles.dividerLine} />
      </div>
      <DesktopBrowser />
    </div>
  );
}

// ─── Shared skeleton bone colour ────────────────────────────────────────────

const BONE_LIGHT = '#e2e8f0';
const BONE_DARK = '#334155';

// We rely on CSS custom properties from rspress for dark-mode awareness
const bone: React.CSSProperties = {
  background: `var(--rp-c-bg-soft, ${BONE_LIGHT})`,
  flexShrink: 0,
};

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    padding: '40px 24px',
    flexWrap: 'wrap',
  },

  // ── Shared skeleton ─────────────────────────────────────────────────────

  bone,

  appContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: '12px 10px',
    height: '100%',
    boxSizing: 'border-box',
  },

  appHeader: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },

  listItem: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: '6px 0',
  },

  bottomNav: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: 8,
    borderTop: `1px solid var(--rp-c-divider, #e2e8f0)`,
  },

  // ── Mobile device ────────────────────────────────────────────────────────

  mobileWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },

  mobileLabel: {
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    color: 'var(--rp-c-text-2)',
  },

  mobileDevice: {
    width: 160,
    background: 'var(--rp-c-bg)',
    borderRadius: 28,
    border: '6px solid var(--rp-c-bg-soft)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.12), inset 0 0 0 1px rgba(0,0,0,0.06)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
  },

  mobileNotch: {
    width: 60,
    height: 16,
    background: 'var(--rp-c-bg-soft)',
    borderRadius: '0 0 12px 12px',
    margin: '0 auto',
    flexShrink: 0,
  },

  mobileScreen: {
    flex: 1,
    background: 'var(--rp-c-bg)',
    minHeight: 280,
    overflow: 'hidden',
  },

  mobileHomeBar: {
    width: 48,
    height: 4,
    borderRadius: 2,
    background: 'var(--rp-c-text-3, #94a3b8)',
    margin: '8px auto',
    flexShrink: 0,
  },

  // ── Desktop browser ──────────────────────────────────────────────────────

  desktopWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },

  desktopLabel: {
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    color: 'var(--rp-c-text-2)',
  },

  desktopBrowser: {
    width: 300,
    background: 'var(--rp-c-bg)',
    borderRadius: 10,
    border: '1px solid var(--rp-c-divider, #e2e8f0)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },

  browserChrome: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    background: 'var(--rp-c-bg-soft)',
    borderBottom: '1px solid var(--rp-c-divider, #e2e8f0)',
    flexShrink: 0,
  },

  browserDots: {
    display: 'flex',
    flexDirection: 'row',
    gap: 4,
    flexShrink: 0,
  },

  dot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
  },

  addressBar: {
    flex: 1,
    background: 'var(--rp-c-bg)',
    borderRadius: 4,
    padding: '3px 8px',
    display: 'flex',
    alignItems: 'center',
  },

  addressText: {
    fontSize: 11,
    color: 'var(--rp-c-text-3, #94a3b8)',
    fontFamily: 'monospace',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },

  browserContent: {
    minHeight: 280,
    overflow: 'hidden',
    background: 'var(--rp-c-bg)',
  },

  // ── Divider ──────────────────────────────────────────────────────────────

  divider: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    color: 'var(--rp-c-text-3, #94a3b8)',
  },

  dividerLine: {
    width: 1,
    height: 40,
    background: 'var(--rp-c-divider, #e2e8f0)',
  },

  dividerBadge: {
    fontSize: 11,
    fontWeight: 500,
    padding: '2px 8px',
    borderRadius: 12,
    border: '1px solid var(--rp-c-divider, #e2e8f0)',
    color: 'var(--rp-c-text-2)',
    whiteSpace: 'nowrap' as const,
  },
};
