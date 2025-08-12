import React from 'react';

export type SectionProps = {
  title: string;
  children: React.ReactNode;
  childClassName?: string;
};

export const Section = ({ title, children, childClassName }: SectionProps) => {
  return (
    <div>
      <h4 className="text-sm font-medium text-gray-300 mb-2">{title}</h4>
      <div className={childClassName}>{children}</div>
    </div>
  );
};
