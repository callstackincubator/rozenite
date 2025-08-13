import { JSONTree } from 'react-json-tree';

const THEME = {
  base00: 'transparent',
  base01: '#f3f4f6', // bg-gray-100
  base02: '#e5e7eb', // bg-gray-200
  base03: '#d1d5db', // text-gray-300
  base04: '#9ca3af', // text-gray-400
  base05: '#6b7280', // text-gray-500
  base06: '#374151', // text-gray-700
  base07: '#1f2937', // text-gray-800
  base08: '#ef4444', // text-red-500
  base09: '#f59e0b', // text-yellow-500
  base0A: '#10b981', // text-green-500
  base0B: '#3b82f6', // text-blue-500
  base0C: '#06b6d4', // text-cyan-500
  base0D: '#8b5cf6', // text-purple-500
  base0E: '#ec4899', // text-pink-500
  base0F: '#f97316', // text-orange-500
};

export type JsonTreeProps = {
  data: unknown;
};

export const JsonTree = ({ data }: JsonTreeProps) => {
  return (
    <JSONTree
      data={data}
      theme={THEME}
      invertTheme={false}
      shouldExpandNodeInitially={() => true}
    />
  );
};
