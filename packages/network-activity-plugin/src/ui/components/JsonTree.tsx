import { JSONTree } from 'react-json-tree';
import { JsonTreeCopyableItem } from './JsonTreeCopyableItem';

export type JsonTreeProps = {
  data: unknown;
  shouldExpandNodeInitially?: () => boolean;
};

export const JsonTree = ({ data, shouldExpandNodeInitially = () => true }: JsonTreeProps) => {
  return (
    <JSONTree
      data={data}
      theme={{
        base00: 'transparent',
        base01: '#1f1f1f', // line
        base02: '#313131', // line-strong
        base03: '#858585', // faint
        base04: '#a3a3a3', // muted
        base05: '#d4d4d4', // text
        base06: '#e5e5e5',
        base07: '#ffffff',
        base08: '#ff7a50', // danger
        base09: '#fbbf24', // warning
        base0A: '#4ade80', // success
        base0B: '#60a5fa', // info
        base0C: '#22d3ee', // cyan
        base0D: '#a3a3a3', // keys: muted
        base0E: '#d4d4d4',
        base0F: '#ff7a50', // danger
      }}
      invertTheme={false}
      shouldExpandNodeInitially={shouldExpandNodeInitially}
      // For objects and arrays
      getItemString={(_type, data, itemType, itemString) => (
        <JsonTreeCopyableItem getCopyableValue={() => JSON.stringify(data, null, 2)}>
          <>
            {itemType} {itemString}
          </>
        </JsonTreeCopyableItem>
      )}
      // For primitives
      valueRenderer={(valueAsString, value) => (
        <JsonTreeCopyableItem getCopyableValue={() => String(value)} className="ml-2">
          {String(valueAsString)}
        </JsonTreeCopyableItem>
      )}
    />
  );
};
