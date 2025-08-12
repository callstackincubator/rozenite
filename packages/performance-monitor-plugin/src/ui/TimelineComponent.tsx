import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Timeline, TimelineOptions } from 'vis-timeline';
import { DataSet } from 'vis-data';
import {
  SerializedPerformanceMeasure,
  SerializedPerformanceMark,
} from '../shared/types';

import 'vis-timeline/styles/vis-timeline-graph2d.min.css';

interface TimelineComponentProps {
  measures: SerializedPerformanceMeasure[];
  marks: SerializedPerformanceMark[];
  sessionStartedAt: number;
  timeOrigin: number;
  currentTime: number;
}

const items = new DataSet<{
  id: string;
  content: string;
  start: Date;
  end: Date;
}>([]);

const options: TimelineOptions = {
  editable: false,
  showMajorLabels: false,
  showMinorLabels: false,
  showCurrentTime: false,
};

export const TimelineComponent: React.FC<TimelineComponentProps> = ({
  measures,
  sessionStartedAt,
  timeOrigin,
}) => {
  const timelineInstanceRef = useRef<Timeline | null>(null);

  useEffect(() => {
    measures.slice(items.length).forEach((measure) => {
      items.add({
        id: measure.name,
        content: measure.name,
        start: new Date(measure.startTime),
        end: new Date(measure.startTime + measure.duration),
      });
    });
    timelineInstanceRef.current?.fit();
  }, [timeOrigin, measures]);

  useEffect(
    () => () => {
      timelineInstanceRef.current?.destroy();
    },
    []
  );

  const initTimeline = useCallback(
    (ref: HTMLDivElement | null) => {
      if (ref) {
        const timeline = new Timeline(ref, items, {
          ...options,
          min: new Date(sessionStartedAt),
          start: new Date(sessionStartedAt),
        });

        timelineInstanceRef.current = timeline;
      } else {
        timelineInstanceRef.current?.destroy();
      }
    },
    [sessionStartedAt]
  );

  return (
    <div
      style={{
        backgroundColor: '#fff',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      }}
    >
      {/* Timeline Container */}
      <div
        ref={initTimeline}
        style={{
          border: '1px solid #ddd',
          borderRadius: '6px',
          overflow: 'hidden',
        }}
      />
    </div>
  );
};
