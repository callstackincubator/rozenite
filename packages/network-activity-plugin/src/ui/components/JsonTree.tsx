import { JSONTree } from 'react-json-tree';

export type JsonTreeProps = {
  data: unknown;
  shouldExpandNodeInitially?: () => boolean;
};

export const JsonTree = ({
  data,
  shouldExpandNodeInitially = () => true,
}: JsonTreeProps) => {
  return (
    <JSONTree
      data={data}
      theme={{
        base00: 'transparent',
        base01: '#374151', // bg-gray-700
        base02: '#4b5563', // bg-gray-600
        base03: '#6b7280', // text-gray-500
        base04: '#9ca3af', // text-gray-400
        base05: '#d1d5db', // text-gray-300
        base06: '#e5e7eb', // text-gray-200
        base07: '#f9fafb', // text-gray-100
        base08: '#ef4444', // text-red-500
        base09: '#f59e0b', // text-yellow-500
        base0A: '#10b981', // text-green-500
        base0B: '#3b82f6', // text-blue-500
        base0C: '#06b6d4', // text-cyan-500
        base0D: '#8b5cf6', // text-purple-500
        base0E: '#ec4899', // text-pink-500
        base0F: '#f97316', // text-orange-500
      }}
      invertTheme={false}
      shouldExpandNodeInitially={shouldExpandNodeInitially}
    />
  );
};
