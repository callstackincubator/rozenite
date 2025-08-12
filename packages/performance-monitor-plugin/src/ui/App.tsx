import {
  useRozeniteDevToolsClient,
  Subscription,
} from '@rozenite/plugin-bridge';
import {
  PerformanceMonitorEventMap,
  SerializedPerformanceMeasure,
  SerializedPerformanceMark,
  SerializedPerformanceMetric,
} from '../shared/types';
import { useEffect, useState, useRef } from 'react';
import { TimelineComponent } from './TimelineComponent';

type PerformanceMonitorSession = {
  sessionStartedAt: number;
  timeOrigin: number;
  measures: SerializedPerformanceMeasure[];
  marks: SerializedPerformanceMark[];
  metrics: SerializedPerformanceMetric[];
};

export default function PerformanceMonitorPanel() {
  const client = useRozeniteDevToolsClient<PerformanceMonitorEventMap>({
    pluginId: '@rozenite/performance-monitor-plugin',
  });
  const [session, setSession] = useState<PerformanceMonitorSession>({
    sessionStartedAt: 0,
    timeOrigin: 0,
    measures: [],
    marks: [],
    metrics: [],
  });
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [isSessionActive, setIsSessionActive] = useState(false);

  // Refs for scroll containers
  const metricsScrollRef = useRef<HTMLDivElement>(null);
  const measuresScrollRef = useRef<HTMLDivElement>(null);
  const marksScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll function
  const scrollToBottom = (ref: React.RefObject<HTMLDivElement>) => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  };

  // Auto-scroll when new items are added
  useEffect(() => {
    scrollToBottom(metricsScrollRef);
  }, [session.metrics]);

  useEffect(() => {
    scrollToBottom(measuresScrollRef);
  }, [session.measures]);

  useEffect(() => {
    scrollToBottom(marksScrollRef);
  }, [session.marks]);

  // Real-time session duration updates
  useEffect(() => {
    if (!session.sessionStartedAt) {
      return;
    }

    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [session.sessionStartedAt]);

  useEffect(() => {
    if (!client) {
      return;
    }

    const subscriptions: Subscription[] = [];

    subscriptions.push(
      client.onMessage('setSession', ({ sessionStartedAt, timeOrigin }) => {
        setSession({
          sessionStartedAt,
          timeOrigin,
          measures: [],
          marks: [],
          metrics: [],
        });
        setIsSessionActive(sessionStartedAt > 0);
      })
    );

    subscriptions.push(
      client.onMessage('appendMeasures', ({ measures }) => {
        setSession((oldSession) => ({
          ...oldSession,
          measures: [...oldSession.measures, ...measures],
        }));
      })
    );

    subscriptions.push(
      client.onMessage('appendMarks', ({ marks }) => {
        setSession((oldSession) => ({
          ...oldSession,
          marks: [...oldSession.marks, ...marks],
        }));
      })
    );

    subscriptions.push(
      client.onMessage('setMetrics', ({ metrics }) => {
        setSession((oldSession) => ({
          ...oldSession,
          metrics: [...oldSession.metrics, ...metrics],
        }));
      })
    );

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
      client.send('setEnabled', { enabled: false });
    };
  }, [client]);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatDuration = (duration: number) => {
    if (duration < 1) {
      return `${(duration * 1000).toFixed(2)}ms`;
    }
    return `${duration.toFixed(2)}s`;
  };

  const getSessionDuration = () => {
    if (!session.sessionStartedAt) return 0;
    return currentTime - session.sessionStartedAt;
  };

  const handleStartSession = () => {
    if (client && !isSessionActive) {
      client.send('setEnabled', { enabled: true });
      setIsSessionActive(true);
    }
  };

  const handleStopSession = () => {
    if (client && isSessionActive) {
      client.send('setEnabled', { enabled: false });
      setIsSessionActive(false);
    }
  };

  return (
    <div
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: '20px',
        backgroundColor: '#f5f5f5',
        height: '100vh',
        color: '#333',
        overflow: 'auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          backgroundColor: '#fff',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '20px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      >
        <h1 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>
          Performance Monitor
        </h1>
        <div style={{ color: '#7f8c8d', fontSize: '14px' }}>
          Session started:{' '}
          {session.sessionStartedAt
            ? formatTime(session.sessionStartedAt)
            : 'Not started'}
          {session.sessionStartedAt !== 0 && (
            <span style={{ marginLeft: '20px' }}>
              Duration: {formatDuration(getSessionDuration() / 1000)}
            </span>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div
        style={{
          backgroundColor: '#fff',
          padding: '15px 20px',
          borderRadius: '8px',
          marginBottom: '20px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          display: 'flex',
          gap: '10px',
          alignItems: 'center',
        }}
      >
        <button
          onClick={handleStartSession}
          disabled={isSessionActive}
          style={{
            padding: '8px 16px',
            backgroundColor: isSessionActive ? '#bdc3c7' : '#27ae60',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isSessionActive ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '500',
          }}
        >
          Start Session
        </button>
        <button
          onClick={handleStopSession}
          disabled={!isSessionActive}
          style={{
            padding: '8px 16px',
            backgroundColor: !isSessionActive ? '#bdc3c7' : '#e74c3c',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: !isSessionActive ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '500',
          }}
        >
          Stop Session
        </button>
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isSessionActive ? '#27ae60' : '#e74c3c',
            }}
          />
          <span style={{ fontSize: '14px', color: '#7f8c8d' }}>
            {isSessionActive ? 'Session Active' : 'Session Inactive'}
          </span>
        </div>
      </div>

      {/* Timeline Component */}
      <TimelineComponent
        measures={session.measures}
        marks={session.marks}
        sessionStartedAt={session.sessionStartedAt}
        currentTime={currentTime}
        timeOrigin={session.timeOrigin}
      />

      {/* Metrics Section */}
      <div
        style={{
          backgroundColor: '#fff',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '20px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      >
        <h2
          style={{ margin: '0 0 15px 0', color: '#27ae60', fontSize: '18px' }}
        >
          Metrics ({session.metrics.length})
        </h2>
        {session.metrics.length === 0 ? (
          <div style={{ color: '#95a5a6', fontStyle: 'italic' }}>
            No metrics recorded
          </div>
        ) : (
          <div
            ref={metricsScrollRef}
            style={{
              display: 'grid',
              gap: '10px',
              maxHeight: '300px',
              overflowY: 'auto',
              paddingRight: '10px',
            }}
          >
            {session.metrics.map((metric, index) => (
              <div
                key={index}
                style={{
                  padding: '12px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '6px',
                  borderLeft: '4px solid #27ae60',
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                  {metric.name}
                </div>
                <div style={{ color: '#2c3e50' }}>
                  {metric.value} {metric.unit || ''}
                </div>
                <div
                  style={{
                    color: '#7f8c8d',
                    fontSize: '12px',
                    marginTop: '4px',
                  }}
                >
                  {formatTime(metric.startTime)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Measures Section */}
      <div
        style={{
          backgroundColor: '#fff',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '20px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      >
        <h2
          style={{ margin: '0 0 15px 0', color: '#3498db', fontSize: '18px' }}
        >
          Performance Measures ({session.measures.length})
        </h2>
        {session.measures.length === 0 ? (
          <div style={{ color: '#95a5a6', fontStyle: 'italic' }}>
            No measures recorded
          </div>
        ) : (
          <div
            ref={measuresScrollRef}
            style={{
              display: 'grid',
              gap: '10px',
              maxHeight: '300px',
              overflowY: 'auto',
              paddingRight: '10px',
            }}
          >
            {session.measures.map((measure, index) => (
              <div
                key={index}
                style={{
                  padding: '12px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '6px',
                  borderLeft: '4px solid #3498db',
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                  {measure.name}
                </div>
                <div style={{ color: '#2c3e50', marginBottom: '4px' }}>
                  Duration:{' '}
                  <span style={{ fontWeight: 'bold', color: '#e74c3c' }}>
                    {formatDuration(measure.duration)}
                  </span>
                </div>
                <div
                  style={{
                    color: '#7f8c8d',
                    fontSize: '12px',
                    marginBottom: '4px',
                  }}
                >
                  Started: {formatTime(measure.startTime)}
                </div>
                {measure.category && (
                  <div
                    style={{
                      display: 'inline-block',
                      backgroundColor: '#ecf0f1',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      color: '#34495e',
                    }}
                  >
                    {measure.category}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Marks Section */}
      <div
        style={{
          backgroundColor: '#fff',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '20px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      >
        <h2
          style={{ margin: '0 0 15px 0', color: '#9b59b6', fontSize: '18px' }}
        >
          Performance Marks ({session.marks.length})
        </h2>
        {session.marks.length === 0 ? (
          <div style={{ color: '#95a5a6', fontStyle: 'italic' }}>
            No marks recorded
          </div>
        ) : (
          <div
            ref={marksScrollRef}
            style={{
              display: 'grid',
              gap: '10px',
              maxHeight: '300px',
              overflowY: 'auto',
              paddingRight: '10px',
            }}
          >
            {session.marks.map((mark, index) => (
              <div
                key={index}
                style={{
                  padding: '12px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '6px',
                  borderLeft: '4px solid #9b59b6',
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                  {mark.name}
                </div>
                <div style={{ color: '#7f8c8d', fontSize: '12px' }}>
                  {formatTime(mark.startTime)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary */}
      <div
        style={{
          backgroundColor: '#fff',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      >
        <h2
          style={{ margin: '0 0 15px 0', color: '#34495e', fontSize: '18px' }}
        >
          Summary
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px',
          }}
        >
          <div
            style={{
              textAlign: 'center',
              padding: '15px',
              backgroundColor: '#e8f5e8',
              borderRadius: '6px',
            }}
          >
            <div
              style={{ fontSize: '24px', fontWeight: 'bold', color: '#27ae60' }}
            >
              {session.metrics.length}
            </div>
            <div style={{ color: '#2c3e50' }}>Metrics</div>
          </div>
          <div
            style={{
              textAlign: 'center',
              padding: '15px',
              backgroundColor: '#e8f4fd',
              borderRadius: '6px',
            }}
          >
            <div
              style={{ fontSize: '24px', fontWeight: 'bold', color: '#3498db' }}
            >
              {session.measures.length}
            </div>
            <div style={{ color: '#2c3e50' }}>Measures</div>
          </div>
          <div
            style={{
              textAlign: 'center',
              padding: '15px',
              backgroundColor: '#f4e8fd',
              borderRadius: '6px',
            }}
          >
            <div
              style={{ fontSize: '24px', fontWeight: 'bold', color: '#9b59b6' }}
            >
              {session.marks.length}
            </div>
            <div style={{ color: '#2c3e50' }}>Marks</div>
          </div>
        </div>
      </div>
    </div>
  );
}
