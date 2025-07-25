import React, { useState } from 'react';
import { NetworkEntry } from '../types/network';
import { formatFileSize, formatDuration, formatLongUrl } from './utils';
import { Card, EmptyState, Tooltip } from './components';
import styles from './network-details.module.css';

// Enhanced network entry type to match the panel
type EnhancedNetworkEntry = NetworkEntry & {
  type?: string;
  initiator?: {
    type: string;
    url?: string;
    lineNumber?: number;
    columnNumber?: number;
  };
  request?: {
    url: string;
    method: string;
    headers: Record<string, string>;
    postData?: string;
    hasPostData?: boolean;
  };
  response?: {
    url: string;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    mimeType: string;
    encodedDataLength: number;
    responseTime: number;
  };
  responseBody?: {
    body: string;
    base64Encoded: boolean;
  };
  dataLength?: number;
};

// Symbolication response types
interface SymbolicatedStackFrame {
  column: number;
  file: string;
  lineNumber: number;
  methodName: string;
  collapse: boolean;
}

interface CodeFrame {
  content: string;
  location: {
    row: number;
    column: number;
  };
  fileName: string;
}

interface SymbolicationResponse {
  codeFrame: CodeFrame;
  stack: SymbolicatedStackFrame[];
}

interface NetworkDetailsProps {
  entry: EnhancedNetworkEntry | null;
  onRequestResponseBody?: (requestId: string) => void;
}

export const NetworkDetails: React.FC<NetworkDetailsProps> = ({
  entry,
  onRequestResponseBody,
}) => {
  const [isSymbolicating, setIsSymbolicating] = useState(false);
  const [, forceUpdate] = useState({});

  const symbolicateCaller = async () => {
    if (!entry?.initiator) return;

    setIsSymbolicating(true);
    try {
      const stackData = {
        stack: [
          {
            column: entry.initiator.columnNumber || 0,
            file: entry.initiator.url || '',
            lineNumber: entry.initiator.lineNumber || 0,
          },
        ],
      };

      const response = await fetch(`${window.location.origin}/symbolicate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(stackData),
      });

      if (response.ok) {
        const data: SymbolicationResponse = await response.json();

        // Update the entry.initiator with symbolicated data
        if (data.stack && data.stack.length > 0) {
          const symbolicatedFrame = data.stack[0];
          if (entry.initiator) {
            entry.initiator.url = symbolicatedFrame.file;
            entry.initiator.lineNumber = symbolicatedFrame.lineNumber;
            entry.initiator.columnNumber = symbolicatedFrame.column;
            // Add method name to initiator
            (entry.initiator as any).methodName = symbolicatedFrame.methodName;
          }
        }
        forceUpdate({});
      } else {
        console.error('Symbolication failed:', response.statusText);
      }
    } catch (error) {
      console.error('Symbolication error:', error);
    } finally {
      setIsSymbolicating(false);
    }
  };

  if (!entry) {
    return <EmptyState message="Select a request to view details" />;
  }

  return (
    <div className={styles.container}>
      {/* General Information */}
      <Card className={styles.card}>
        <h3 className={styles.cardTitle}>General</h3>
        <div className={styles.infoText}>
          <div className={styles.infoRowUrl}>
            <strong>Request URL:</strong>
            <Tooltip content={entry.url} showOnlyWhenTruncated>
              <span className={styles.urlText}>
                {formatLongUrl(entry.url, 100)}
              </span>
            </Tooltip>
          </div>
          <div className={styles.infoRow}>
            <strong>Request Method:</strong> {entry.method}
          </div>
          <div className={styles.infoRow}>
            <strong>Status Code:</strong> {entry.response?.status || 'Pending'}
          </div>
          <div className={styles.infoRow}>
            <strong>Status:</strong> {entry.status}
          </div>
          {entry.type && (
            <div className={styles.infoRow}>
              <strong>Resource Type:</strong> {entry.type}
            </div>
          )}
          {entry.initiator && (
            <div className={styles.infoRow}>
              <strong>Initiator:</strong> {entry.initiator.type}
              {(entry.initiator as any).methodName && (
                <div className={styles.infoRowSub}>
                  <strong>Method:</strong> {(entry.initiator as any).methodName}
                </div>
              )}
              {entry.initiator.url && (
                <div className={styles.infoRowSub}>
                  <strong>URL:</strong> {entry.initiator.url}
                </div>
              )}
              {entry.initiator.lineNumber && (
                <div className={styles.infoRowSub}>
                  <strong>Line:</strong> {entry.initiator.lineNumber}:
                  {entry.initiator.columnNumber || 0}
                </div>
              )}
              <div className={styles.infoRowSub}>
                <button
                  className={styles.symbolicateButton}
                  onClick={symbolicateCaller}
                  disabled={isSymbolicating}
                >
                  {isSymbolicating
                    ? 'Symbolicating...'
                    : 'Symbolicate initiator'}
                </button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Response Headers */}
      {entry.response && (
        <Card className={styles.card}>
          <h3 className={styles.cardTitle}>Response Headers</h3>
          <div className={styles.headersContainer}>
            {Object.entries(entry.response.headers).map(([key, value]) => (
              <div key={key} className={styles.headerRow}>
                <strong>{key}:</strong>
                <Tooltip content={value} showOnlyWhenTruncated>
                  <span className={styles.headerValue}>{value}</span>
                </Tooltip>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Request Headers */}
      <Card className={styles.card}>
        <h3 className={styles.cardTitle}>Request Headers</h3>
        <div className={styles.headersContainer}>
          {Object.entries(entry.headers).map(([key, value]) => (
            <div key={key} className={styles.headerRow}>
              <strong>{key}:</strong>
              <Tooltip content={value} showOnlyWhenTruncated>
                <span className={styles.headerValue}>{value}</span>
              </Tooltip>
            </div>
          ))}
        </div>
      </Card>

      {/* Size Information */}
      {(entry.encodedDataLength || entry.dataLength) && (
        <Card className={styles.card}>
          <h3 className={styles.cardTitle}>Size Information</h3>
          <div className={styles.infoText}>
            {entry.dataLength && (
              <div className={styles.infoRow}>
                <strong>Data Length:</strong> {formatFileSize(entry.dataLength)}
              </div>
            )}
            {entry.encodedDataLength && (
              <div className={styles.infoRow}>
                <strong>Encoded Data Length:</strong>{' '}
                {formatFileSize(entry.encodedDataLength)}
              </div>
            )}
            {entry.response?.mimeType && (
              <div className={styles.infoRow}>
                <strong>MIME Type:</strong> {entry.response.mimeType}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Timing Information */}
      {entry.duration && (
        <Card className={styles.card}>
          <h3 className={styles.cardTitle}>Timing</h3>
          <div className={styles.infoText}>
            <div className={styles.infoRow}>
              <strong>Duration:</strong> {formatDuration(entry.duration)}
            </div>
            <div className={styles.infoRow}>
              <strong>Start Time:</strong>{' '}
              {new Date(entry.startTime).toLocaleTimeString()}
            </div>
            {entry.endTime && (
              <div className={styles.infoRow}>
                <strong>End Time:</strong>{' '}
                {new Date(entry.endTime).toLocaleTimeString()}
              </div>
            )}
            {entry.response?.responseTime && (
              <div className={styles.infoRow}>
                <strong>Response Time:</strong>{' '}
                {new Date(entry.response.responseTime).toLocaleTimeString()}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Error Information */}
      {entry.status === 'failed' && (
        <Card className={styles.card}>
          <h3 className={styles.cardTitle}>Error Information</h3>
          <div className={styles.infoText}>
            <div className={styles.infoRow}>
              <strong>Error:</strong> {entry.errorText || 'Unknown error'}
            </div>
            <div className={styles.infoRow}>
              <strong>Canceled:</strong> {entry.canceled ? 'Yes' : 'No'}
            </div>
          </div>
        </Card>
      )}

      {/* Post Data */}
      {entry.postData && (
        <Card className={styles.card}>
          <h3 className={styles.cardTitle}>Post Data</h3>
          <div className={styles.postDataContainer}>
            <pre className={styles.postDataText}>{entry.postData}</pre>
          </div>
        </Card>
      )}

      {/* Response Body */}
      {entry.response && (
        <Card className={styles.card}>
          <h3 className={styles.cardTitle}>Response Body</h3>
          {entry.responseBody ? (
            <div className={styles.responseBodyContainer}>
              <pre className={styles.responseBodyText}>
                {entry.responseBody.base64Encoded
                  ? atob(entry.responseBody.body)
                  : entry.responseBody.body}
              </pre>
            </div>
          ) : (
            <div className={styles.responseBodyContainer}>
              <button
                className={styles.loadResponseBodyButton}
                onClick={() => onRequestResponseBody?.(entry.requestId)}
                disabled={!onRequestResponseBody}
              >
                Load Response Body
              </button>
            </div>
          )}
        </Card>
      )}

      {/* Request Details */}
      {entry.request && (
        <Card className={styles.card}>
          <h3 className={styles.cardTitle}>Request Details</h3>
          <div className={styles.infoText}>
            <div className={styles.infoRow}>
              <strong>Has Post Data:</strong>{' '}
              {entry.request.hasPostData ? 'Yes' : 'No'}
            </div>
            {entry.request.postData && (
              <div className={styles.infoRow}>
                <strong>Post Data Length:</strong>{' '}
                {entry.request.postData.length} characters
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};
