import { ScrollArea } from '../components/ScrollArea';
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
  const generatedLocation = formatFrameLocation(
    getGeneratedFrameLocation(initiator),
  );
  const status = formatSymbolicationStatus(initiator);

  return [
    {
      key: 'Type',
      value: formatInitiatorType(initiator.type),
    },
    ...(status
      ? [
          {
            key: 'Source map',
            value: status,
            valueClassName:
              initiator.symbolicationStatus === 'failed'
                ? 'text-red-300'
                : 'text-gray-300',
          },
        ]
      : []),
    ...(sourceFrame?.functionName
      ? [
          {
            key: 'Function',
            value: sourceFrame.functionName,
            valueClassName: 'font-mono text-blue-300',
          },
        ]
      : []),
    ...(sourceFrame?.url
      ? [
          {
            key: 'Source',
            value: formatSourcePath(sourceFrame.url),
            valueClassName: 'font-mono text-blue-300',
          },
        ]
      : []),
    ...(sourceFrame?.lineNumber !== undefined
      ? [
          {
            key: 'Line',
            value: sourceFrame.lineNumber,
          },
        ]
      : []),
    ...(sourceFrame?.columnNumber !== undefined
      ? [
          {
            key: 'Column',
            value: sourceFrame.columnNumber,
          },
        ]
      : []),
    ...(sourceLocation
      ? [
          {
            key: 'Location',
            value: sourceLocation,
            valueClassName: 'font-mono text-blue-300',
          },
        ]
      : []),
    ...(generatedLocation && generatedLocation !== sourceLocation
      ? [
          {
            key: 'Generated',
            value: generatedLocation,
            valueClassName: 'font-mono text-gray-500',
          },
        ]
      : []),
  ];
};

const getStackFrameLocation = (frame: InitiatorStackFrame) => {
  const sourceLocation = formatFrameLocation(getSourceFrameLocation(frame));
  const generatedLocation = formatFrameLocation(
    getGeneratedFrameLocation(frame),
  );

  if (
    sourceLocation &&
    generatedLocation &&
    sourceLocation !== generatedLocation
  ) {
    return (
      <span>
        {sourceLocation}
        <span className="ml-2 text-gray-500">
          generated {generatedLocation}
        </span>
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
        keyClassName: 'font-mono',
        valueClassName: 'font-mono text-blue-300',
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
    <ScrollArea className="h-full w-full">
      <div className="p-4 space-y-4">
        <div className="rounded-md border border-gray-700 bg-gray-800/60 p-3">
          <div className="text-xs uppercase text-gray-500">Triggered by</div>
          <div className="mt-1 font-mono text-sm text-blue-300">
            {initiatorLabel ?? 'Unknown initiator'}
          </div>
          {initiatorLocation && initiatorLocation !== initiatorLabel && (
            <div className="mt-1 font-mono text-xs text-gray-400 wrap-anywhere">
              {initiatorLocation}
            </div>
          )}
        </div>

        <Section title="Initiator">
          <KeyValueGrid
            items={initiatorItems}
            emptyMessage="No initiator metadata available"
          />
        </Section>

        {!hasSourceMappedFrame &&
          initiator?.symbolicationStatus !== 'pending' && (
            <div className="rounded-md border border-gray-700 bg-gray-800/60 p-3 text-sm text-gray-400">
              This request only includes generated bundle location data. Metro
              source maps were not available for this entry.
            </div>
          )}

        {initiator?.symbolicationError && (
          <div className="rounded-md border border-red-900/70 bg-red-950/30 p-3 text-sm text-red-200">
            {initiator.symbolicationError}
          </div>
        )}

        {initiator?.codeFrame && (
          <Section title="Code Frame">
            <pre className="overflow-auto rounded-md bg-gray-950 p-3 text-xs text-gray-300">
              <code>{initiator.codeFrame.content}</code>
            </pre>
          </Section>
        )}

        {stackItems.length > 0 && (
          <Section title="Stack Preview">
            <KeyValueGrid items={stackItems} />
          </Section>
        )}
      </div>
    </ScrollArea>
  );
};
