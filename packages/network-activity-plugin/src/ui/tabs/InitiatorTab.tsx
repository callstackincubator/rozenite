import { Text } from '@rozenite/ui';
import { TabContent } from '../components/TabContent';
import { Section } from '../components/Section';
import { KeyValueGrid, type KeyValueItem } from '../components/KeyValueGrid';
import type { HttpNetworkEntry, SSENetworkEntry } from '../state/model';
import type { Initiator, InitiatorStackFrame } from '../../shared/client';
import {
  formatFrameLocation,
  formatSourcePath,
  getBestInitiatorFrame,
  getGeneratedFrameLocation,
  getInitiatorLabel,
  getInitiatorLocationLabel,
  getSourceFrameLocation,
} from '../utils/initiator';

export type InitiatorTabProps = {
  selectedRequest: HttpNetworkEntry | SSENetworkEntry;
};

const formatInitiatorType = (type: string) => {
  switch (type) {
    case 'script':
      return 'Script';
    case 'other':
      return 'Other';
    default:
      return type;
  }
};

const formatSymbolicationStatus = (initiator?: Initiator) => {
  switch (initiator?.symbolicationStatus) {
    case 'pending':
      return 'Resolving source...';
    case 'complete':
      return 'Resolved';
    case 'failed':
      return 'Failed';
    case 'unavailable':
      return 'Unavailable';
    default:
      return null;
  }
};

const getInitiatorItems = (initiator?: Initiator): KeyValueItem[] => {
  if (!initiator) {
    return [];
  }

  const sourceFrame = getBestInitiatorFrame(initiator);
  const sourceLocation = getInitiatorLocationLabel(initiator);
  const generatedLocation = formatFrameLocation(getGeneratedFrameLocation(initiator));
  const status = formatSymbolicationStatus(initiator);

  return [
    {
      key: 'Type',
      value: formatInitiatorType(initiator.type),
      valueClassName: 'font-mono text-xs',
    },
    ...(status
      ? [
          {
            key: 'Source map',
            value: status,
            valueClassName:
              initiator.symbolicationStatus === 'failed'
                ? 'font-mono text-xs text-danger'
                : 'font-mono text-xs',
          },
        ]
      : []),
    ...(sourceFrame?.functionName
      ? [
          {
            key: 'Function',
            value: sourceFrame.functionName,
            valueClassName: 'font-mono text-xs',
          },
        ]
      : []),
    ...(sourceFrame?.url
      ? [
          {
            key: 'Source',
            value: formatSourcePath(sourceFrame.url),
            valueClassName: 'font-mono text-xs',
          },
        ]
      : []),
    ...(sourceFrame?.lineNumber !== undefined
      ? [
          {
            key: 'Line',
            value: sourceFrame.lineNumber,
            valueClassName: 'font-mono text-xs',
          },
        ]
      : []),
    ...(sourceFrame?.columnNumber !== undefined
      ? [
          {
            key: 'Column',
            value: sourceFrame.columnNumber,
            valueClassName: 'font-mono text-xs',
          },
        ]
      : []),
    ...(sourceLocation
      ? [
          {
            key: 'Location',
            value: sourceLocation,
            valueClassName: 'font-mono text-xs',
          },
        ]
      : []),
    ...(generatedLocation && generatedLocation !== sourceLocation
      ? [
          {
            key: 'Generated',
            value: generatedLocation,
            valueClassName: 'font-mono text-xs text-faint',
          },
        ]
      : []),
  ];
};

const getStackFrameLocation = (frame: InitiatorStackFrame) => {
  const sourceLocation = formatFrameLocation(getSourceFrameLocation(frame));
  const generatedLocation = formatFrameLocation(getGeneratedFrameLocation(frame));

  if (sourceLocation && generatedLocation && sourceLocation !== generatedLocation) {
    return (
      <span>
        {sourceLocation}
        <span className="ml-2 text-faint">generated {generatedLocation}</span>
      </span>
    );
  }

  return sourceLocation ?? generatedLocation ?? 'Unknown location';
};

const getStackItems = (initiator?: Initiator): KeyValueItem[] => {
  return (
    initiator?.stack?.map((frame, index) => {
      return {
        key: frame.functionName || `Frame ${index + 1}`,
        value: getStackFrameLocation(frame),
        valueClassName: 'font-mono text-xs',
      };
    }) ?? []
  );
};

export const InitiatorTab = ({ selectedRequest }: InitiatorTabProps) => {
  const initiator = selectedRequest.initiator;
  const initiatorItems = getInitiatorItems(initiator);
  const stackItems = getStackItems(initiator);
  const initiatorLabel = getInitiatorLabel(initiator);
  const initiatorLocation = getInitiatorLocationLabel(initiator);
  const hasSourceMappedFrame = Boolean(
    getSourceFrameLocation(initiator) ||
    initiator?.stack?.some((frame) => getSourceFrameLocation(frame)),
  );

  return (
    <TabContent>
      <div className="flex flex-col gap-1 border border-border bg-surface p-3">
        <Text variant="label">Triggered by</Text>
        <Text variant="code" className="text-sm">
          {initiatorLabel ?? 'Unknown initiator'}
        </Text>
        {initiatorLocation && initiatorLocation !== initiatorLabel && (
          <Text variant="code" className="wrap-anywhere text-muted-foreground">
            {initiatorLocation}
          </Text>
        )}
      </div>

      <Section title="Initiator">
        <KeyValueGrid items={initiatorItems} emptyMessage="No initiator metadata available" />
      </Section>

      {!hasSourceMappedFrame && initiator?.symbolicationStatus !== 'pending' && (
        <div className="border border-border bg-surface p-3 text-sm text-muted-foreground">
          This request only includes generated bundle location data. Metro source maps were not
          available for this entry.
        </div>
      )}

      {initiator?.symbolicationError && (
        <div className="border border-danger bg-danger-soft p-3 text-sm text-danger">
          {initiator.symbolicationError}
        </div>
      )}

      {initiator?.codeFrame && (
        <Section title="Code Frame">
          <pre className="overflow-auto border border-border bg-muted p-3 font-mono text-xs text-foreground">
            <code>{initiator.codeFrame.content}</code>
          </pre>
        </Section>
      )}

      {stackItems.length > 0 && (
        <Section title="Stack Preview">
          <KeyValueGrid variant="data" items={stackItems} />
        </Section>
      )}
    </TabContent>
  );
};
