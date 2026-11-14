import { useEffect, useRef, useState } from 'react';
import { Boxes, MousePointerClick } from 'lucide-react';
import { EmptyState, PluginShell, Split } from '@rozenite/ui';
import { isRecording, usePanelStore, panelActions } from './state/panel-store';
import { useZustandConnection } from './state/use-zustand-connection';
import { jumpTo, setRecording } from './state/operations';
import { useRunWithToast } from './state/use-run-with-toast';
import { canJump } from './history/model';
import { StoreSidebar } from './components/store-sidebar';
import { Timeline, buildRows } from './components/timeline';
import { DetailPane } from './components/detail-pane';
import { StoreHome } from './components/store-home';
import { MainToolbar } from './components/main-toolbar';
import { Scrubber } from './components/scrubber';
import { WarningsBanner } from './components/warnings-banner';
import './globals.css';

const NARROW_PX = 760;

const useNarrow = (ref: React.RefObject<HTMLDivElement | null>) => {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) =>
      setNarrow(entry.contentRect.width < NARROW_PX),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return narrow;
};

/** Widgets that own their keys: buttons, switches, tabs, selects, sliders, menus. */
const OWNS_KEYS =
  'button, a[href], [role="option"], [role="listbox"], [role="combobox"], [role="tab"], [role="switch"], [role="slider"], [role="menu"], [role="menuitem"], [role="tree"], [role="treeitem"]';

const isTyping = (target: EventTarget | null) => {
  const element = target as HTMLElement | null;
  if (!element || typeof element.closest !== 'function') return false;
  const tag = element.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    element.isContentEditable ||
    element.closest(OWNS_KEYS) !== null
  );
};

/** ↑/↓ move through the timeline, J jumps, / filters, Space pauses. */
const useKeyboard = (filterRef: React.RefObject<HTMLInputElement | null>) => {
  const run = useRunWithToast();
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // A focused row or widget that already handled the key (Space on a
      // timeline row selects it) must not also trigger a shortcut.
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      const state = usePanelStore.getState();

      if (event.key === '/') {
        event.preventDefault();
        filterRef.current?.focus();
        return;
      }
      if (event.key === ' ') {
        event.preventDefault();
        if (state.model.stores.size === 0) return;
        void run('Recording', () => setRecording(state.selectedStoreId, !isRecording(state)));
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const entries = buildRows(state.model, state.selectedStoreId, state.filter).map(
          (row) => row.entry,
        );
        if (entries.length === 0) return;
        event.preventDefault();
        const current = state.selection
          ? entries.findIndex(
              (entry) =>
                entry.storeId === state.selection?.storeId &&
                entry.transition.seq === state.selection.seq,
            )
          : -1;
        const next =
          current < 0
            ? entries.length - 1
            : Math.max(
                0,
                Math.min(entries.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1)),
              );
        panelActions.select({ storeId: entries[next].storeId, seq: entries[next].transition.seq });
        return;
      }
      if (!state.selection || (event.key !== 'j' && event.key !== 'J')) return;
      const { storeId, seq } = state.selection;
      const history = state.model.stores.get(storeId);
      if (history && canJump(history, seq)) {
        void run('Jump', () => jumpTo(storeId, seq));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [filterRef, run]);
};

function RightPane() {
  const selection = usePanelStore((state) => state.selection);
  const selectedStoreId = usePanelStore((state) => state.selectedStoreId);
  const selectionHistory = usePanelStore((state) =>
    state.selection ? state.model.stores.get(state.selection.storeId) : undefined,
  );
  const storeHistory = usePanelStore((state) =>
    state.selectedStoreId ? state.model.stores.get(state.selectedStoreId) : undefined,
  );

  if (selection && selectionHistory) {
    return <DetailPane history={selectionHistory} seq={selection.seq} />;
  }
  if (selectedStoreId && storeHistory) {
    return <StoreHome history={storeHistory} />;
  }
  return (
    <EmptyState
      icon={MousePointerClick}
      title="Select a transition or a store"
      description="Pick a row to see its diff, the state at that point, its arguments and stack trace. Pick a store for its live state, actions and persistence."
    />
  );
}

function ZustandPanelContent() {
  useZustandConnection();
  const rootRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const narrow = useNarrow(rootRef);
  useKeyboard(filterRef);

  const hasStores = usePanelStore((state) => state.model.stores.size > 0);
  const scrubHistory = usePanelStore((state) =>
    state.selectedStoreId ? state.model.stores.get(state.selectedStoreId) : undefined,
  );

  const main = (
    <Split direction={narrow ? 'vertical' : 'horizontal'} autoSaveId="zustand-main">
      <Split.Pane defaultSize={narrow ? 50 : 45} minSize={20}>
        <div className="flex h-full min-h-0 flex-col">
          <div className="min-h-0 flex-1">
            <Timeline />
          </div>
          {scrubHistory && (
            // Keyed: play state and a pending drag belong to one store.
            <Scrubber key={scrubHistory.storeId} history={scrubHistory} />
          )}
        </div>
      </Split.Pane>
      <Split.Handle />
      <Split.Pane minSize={20}>
        <div className="h-full min-h-0">
          <RightPane />
        </div>
      </Split.Pane>
    </Split>
  );

  return (
    <div ref={rootRef} className="flex min-h-0 flex-1 flex-col">
      <MainToolbar narrow={narrow} filterRef={filterRef} />
      <WarningsBanner />
      <PluginShell.Body className="overflow-hidden">
        {!hasStores && narrow ? (
          <EmptyState
            icon={Boxes}
            title="No stores yet"
            description="Waiting for the app to register a store…"
          />
        ) : narrow ? (
          main
        ) : (
          <Split direction="horizontal" autoSaveId="zustand-root">
            <Split.Pane defaultSize={18} minSize={12} maxSize={35}>
              <StoreSidebar />
            </Split.Pane>
            <Split.Handle />
            <Split.Pane>{main}</Split.Pane>
          </Split>
        )}
      </PluginShell.Body>
    </div>
  );
}

export default function ZustandPanel() {
  return (
    <PluginShell>
      <ZustandPanelContent />
    </PluginShell>
  );
}
