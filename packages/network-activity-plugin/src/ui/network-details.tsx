import React from 'react';
import { NetworkEntry } from '../types/network';
import { formatFileSize, formatDuration, formatLongUrl } from './utils';
import { Card, EmptyState, Tooltip } from './components';
import styles from './network-details.module.css';

interface NetworkDetailsProps {
  entry: NetworkEntry | null;
}

export const NetworkDetails: React.FC<NetworkDetailsProps> = ({ entry }) => {
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
            <Tooltip content={entry.request.request.url} showOnlyWhenTruncated>
              <span className={styles.urlText}>
                {formatLongUrl(entry.request.request.url, 100)}
              </span>
            </Tooltip>
          </div>
          <div className={styles.infoRow}>
            <strong>Request Method:</strong> {entry.request.request.method}
          </div>
          <div className={styles.infoRow}>
            <strong>Status Code:</strong> {entry.response?.response.status || 'Pending'}
          </div>
          <div className={styles.infoRow}>
            <strong>Remote Address:</strong> {entry.response?.response.remoteIPAddress || 'Unknown'}
          </div>
          <div className={styles.infoRow}>
            <strong>Referrer Policy:</strong> {entry.request.request.headers['referer'] || 'no-referrer'}
          </div>
        </div>
      </Card>

      {/* Response Headers */}
      {entry.response && (
        <Card className={styles.card}>
          <h3 className={styles.cardTitle}>Response Headers</h3>
          <div className={styles.headersContainer}>
            {Object.entries(entry.response.response.headers).map(([key, value]) => (
              <div key={key} className={styles.headerRow}>
                <strong>{key}:</strong> 
                <Tooltip content={value} showOnlyWhenTruncated>
                  <span className={styles.headerValue}>
                    {value}
                  </span>
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
          {Object.entries(entry.request.request.headers).map(([key, value]) => (
            <div key={key} className={styles.headerRow}>
              <strong>{key}:</strong> 
              <Tooltip content={value} showOnlyWhenTruncated>
                <span className={styles.headerValue}>
                  {value}
                </span>
              </Tooltip>
            </div>
          ))}
        </div>
      </Card>

      {/* Size Information */}
      {entry.response && (
        <Card className={styles.card}>
          <h3 className={styles.cardTitle}>Size Information</h3>
          <div className={styles.infoText}>
            <div className={styles.infoRow}>
              <strong>Decoded Body Size:</strong> {formatFileSize(entry.response.response.decodedBodySize)}
            </div>
          </div>
        </Card>
      )}

      {/* Timing Information */}
      {entry.response?.response.timing && (
        <Card className={styles.card}>
          <h3 className={styles.cardTitle}>Timing</h3>
          <div className={styles.infoText}>
            <div className={styles.infoRow}>
              <strong>Time to First Byte:</strong> {entry.response.response.timing.receiveHeadersEnd - entry.response.response.timing.sendEnd}ms
            </div>
            <div className={styles.infoRow}>
              <strong>Total Duration:</strong> {entry.duration ? formatDuration(entry.duration) : 'Unknown'}
            </div>
          </div>
        </Card>
      )}

      {/* Error Information */}
      {entry.loadingFailed && (
        <Card className={styles.card}>
          <h3 className={styles.cardTitleError}>Error</h3>
          <div className={styles.infoText}>
            <div className={styles.infoRow}>
              <strong>Error Text:</strong> {entry.loadingFailed.errorText}
            </div>
            <div className={styles.infoRow}>
              <strong>Type:</strong> {entry.loadingFailed.type}
            </div>
            {entry.loadingFailed.blockedReason && (
              <div className={styles.infoRow}>
                <strong>Blocked Reason:</strong> {entry.loadingFailed.blockedReason}
              </div>
            )}
            {entry.loadingFailed.canceled && (
              <div className={styles.infoRow}>
                <strong>Canceled:</strong> Yes
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}; 