export type FieldTreeLeaf = { kind: 'leaf'; segment: string; name: string };
export type FieldTreeGroup = {
  kind: 'group';
  segment: string;
  path: string;
  children: FieldTreeNode[];
};
export type FieldTreeNode = FieldTreeLeaf | FieldTreeGroup;

/**
 * Builds a tree from dot-path field names (e.g. `address.street`,
 * `items.0.name`), mirroring how react-hook-form nests object and
 * `useFieldArray` array fields under a single flat `formValues` map.
 */
export function buildFieldTree(names: string[]): FieldTreeNode[] {
  const roots: FieldTreeNode[] = [];
  const groupsByPath = new Map<string, FieldTreeGroup>();

  for (const name of names) {
    const segments = name.split('.');
    let siblings = roots;
    let path = '';

    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i];
      path = path ? `${path}.${segment}` : segment;

      let group = groupsByPath.get(path);
      if (!group) {
        group = { kind: 'group', segment, path, children: [] };
        groupsByPath.set(path, group);
        siblings.push(group);
      }
      siblings = group.children;
    }

    siblings.push({ kind: 'leaf', segment: segments[segments.length - 1], name });
  }

  return roots;
}

export function collectLeafNames(node: FieldTreeNode): string[] {
  if (node.kind === 'leaf') return [node.name];
  return node.children.flatMap(collectLeafNames);
}

export type FlatFieldRow =
  | { kind: 'leaf'; depth: number; segment: string; name: string }
  | { kind: 'group'; depth: number; segment: string; path: string; leafNames: string[] };

/**
 * Flattens a field tree into row-per-field order for a plain table, with
 * a `depth` on each row for indentation and a divider row per group (so
 * `address.location.city` still reads as nested without a collapsible
 * tree widget).
 */
export function flattenFieldTree(nodes: FieldTreeNode[], depth = 0): FlatFieldRow[] {
  return nodes.flatMap((node) => {
    if (node.kind === 'leaf') {
      return [{ kind: 'leaf', depth, segment: node.segment, name: node.name } as const];
    }
    const groupRow: FlatFieldRow = {
      kind: 'group',
      depth,
      segment: node.segment,
      path: node.path,
      leafNames: collectLeafNames(node),
    };
    return [groupRow, ...flattenFieldTree(node.children, depth + 1)];
  });
}
