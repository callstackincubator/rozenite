import { useLayoutEffect, useRef, useState } from 'react';

let measureContext: CanvasRenderingContext2D | null | undefined;

const getMeasureContext = (): CanvasRenderingContext2D | null => {
  if (measureContext === undefined) {
    measureContext = document.createElement('canvas').getContext('2d');
  }
  return measureContext;
};

const measureWidth = (text: string, font: string): number => {
  const context = getMeasureContext();
  if (!context) {
    return text.length * 7;
  }
  context.font = font;
  return context.measureText(text).width;
};

/** Truncates `text` from the start so its tail fits within `maxWidth`, e.g. `…/index.ts`. */
const truncateStart = (text: string, maxWidth: number, font: string): string => {
  if (measureWidth(text, font) <= maxWidth) {
    return text;
  }

  const ellipsis = '…';
  let low = 0;
  let high = text.length;

  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const candidate = ellipsis + text.slice(text.length - mid);
    if (measureWidth(candidate, font) <= maxWidth) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  return low === 0 ? ellipsis : ellipsis + text.slice(text.length - low);
};

export type EllipsisStartProps = {
  text: string;
  className?: string;
};

/** Renders `text` truncated from the start, so the meaningful tail (e.g. a file name) stays visible. */
export const EllipsisStart = ({ text, className }: EllipsisStartProps) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [label, setLabel] = useState(text);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }

    const update = () => {
      const style = getComputedStyle(node);
      const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      setLabel(truncateStart(text, node.clientWidth, font));
    };

    update();

    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [text]);

  return (
    <span ref={ref} className={className}>
      {label}
    </span>
  );
};
