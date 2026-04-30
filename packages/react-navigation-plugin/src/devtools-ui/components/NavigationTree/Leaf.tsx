import type { CSSProperties } from 'react';
import type { NavigationTreeColor } from './navigationTreeColors';

export const Leaf = ({
  title,
  isSelectedTab,
  color,
  subtitle,
}: {
  title: string;
  isSelectedTab?: boolean;
  color: NavigationTreeColor;
  subtitle?: string;
}) => {
  const shellStyle: CSSProperties | undefined = isSelectedTab
    ? { borderColor: color.accent }
    : undefined;
  const leafStyle: CSSProperties = {
    backgroundColor: color.accent,
    color: color.onAccent,
  };

  return (
    <div
      className={`rounded-md ${
        isSelectedTab ? 'border-2 border-dashed p-1' : 'px-1'
      }`}
      style={shellStyle}
    >
      <button
        className="flex flex-col items-center gap-1 rounded-md px-3 py-2 text-center shadow-sm"
        onClick={(e) => {
          e.stopPropagation();
        }}
        style={leafStyle}
        type="button"
      >
        <span className={`text-sm font-medium ${isSelectedTab ? 'underline' : ''}`}>
          {title}
        </span>
        {subtitle ? (
          <span className="max-w-52 break-all text-[11px] opacity-80">
            {subtitle}
          </span>
        ) : null}
      </button>
    </div>
  );
};
