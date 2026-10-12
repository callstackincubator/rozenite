import { JSONTree } from 'react-json-tree';
import { JsonTreeCopyableItem } from './JsonTreeCopyableItem';

export type JsonTreeProps = {
  data: unknown;
  shouldExpandNodeInitially?: () => boolean;
};

// The theme is made of the panel's own tokens (as CSS variables), so the tree follows the
// light and dark themes without a second palette. Same reading as `@rozenite/ui`'s
// `JsonInspector`: keys in the foreground, punctuation faint, strings and numbers in the accent.
const JSON_TREE_THEME = {
  base00: 'transparent',
  base01: 'var(--border)',
  base02: 'var(--border-strong)',
  base03: 'var(--faint)', // item counts, `{} 3 keys`
  base04: 'var(--muted-foreground)',
  base05: 'var(--foreground)',
  base06: 'var(--foreground)',
  base07: 'var(--foreground)',
  base08: 'var(--muted-foreground)', // null
  base09: 'var(--primary)', // numbers, booleans
  base0A: 'var(--muted-foreground)',
  base0B: 'var(--primary)', // strings
  base0C: 'var(--muted-foreground)',
  base0D: 'var(--foreground)', // keys
  base0E: 'var(--muted-foreground)',
  base0F: 'var(--muted-foreground)',
};

export const JsonTree = ({ data, shouldExpandNodeInitially = () => true }: JsonTreeProps) => {
  return (
    <JSONTree
      data={data}
      theme={JSON_TREE_THEME}
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
