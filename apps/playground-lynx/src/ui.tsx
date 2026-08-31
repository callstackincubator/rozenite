import type { ReactNode } from '@lynx-js/react';

import './ui.css';

export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <view className="Group">
      <text className="Group__title">{title}</text>
      <view className="Group__body">{children}</view>
    </view>
  );
}

export function Row({
  label,
  value,
  trailing,
  last,
}: {
  label: string;
  value?: string;
  trailing?: ReactNode;
  last?: boolean;
}) {
  return (
    <view className={last ? 'Row Row--last' : 'Row'}>
      <text className="Row__label">{label}</text>
      {trailing ?? <text className="Row__value">{value}</text>}
    </view>
  );
}

export function Button({ label, onTap }: { label: string; onTap: () => void }) {
  return (
    <view className="Button" bindtap={onTap}>
      <text className="Button__label">{label}</text>
    </view>
  );
}
