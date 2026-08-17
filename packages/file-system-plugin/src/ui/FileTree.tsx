import { Folder } from 'lucide-react';
import { NestedList } from '@rozenite/ui';
import type { FsRoots } from '../shared/protocol';
import type { FileSystemTreeState } from '../use-file-system-tree';

type FileTreeProps = {
  roots: FsRoots['roots'];
  activePath: string;
  tree: FileSystemTreeState;
  onSelectDir: (path: string) => void;
};

/**
 * Persistent multi-level directory tree (Feature 1, Version A "Explorer
 * tree"). Each root is a top-level node; directories lazily fetch their
 * children the first time they're expanded via `tree.setExpanded`.
 */
export function FileTree({ roots, activePath, tree, onSelectDir }: FileTreeProps) {
  if (roots.length === 0) return null;

  return (
    <NestedList>
      {roots.map((root) => (
        <FileTreeNode
          key={root.id}
          path={root.path}
          label={root.label}
          activePath={activePath}
          tree={tree}
          onSelectDir={onSelectDir}
        />
      ))}
    </NestedList>
  );
}

type FileTreeNodeProps = {
  path: string;
  label: string;
  activePath: string;
  tree: FileSystemTreeState;
  onSelectDir: (path: string) => void;
};

function FileTreeNode({ path, label, activePath, tree, onSelectDir }: FileTreeNodeProps) {
  const expanded = tree.expandedPaths.has(path);
  const cache = tree.childrenByPath.get(path);
  const dirChildren = Array.isArray(cache) ? cache.filter((entry) => entry.isDirectory) : null;

  return (
    <NestedList.Item
      label={label}
      adornment={<Folder />}
      selected={path === activePath}
      expanded={expanded}
      onExpandedChange={(next) => tree.setExpanded(path, next)}
      onClick={() => onSelectDir(path)}
      title={path}
    >
      {cache === 'loading' ? (
        <div className="px-2 py-1 text-xs text-sidebar-foreground/60">Loading…</div>
      ) : cache === 'error' ? (
        <div className="px-2 py-1 text-xs text-destructive">Failed to load</div>
      ) : dirChildren && dirChildren.length > 0 ? (
        dirChildren.map((child) => (
          <FileTreeNode
            key={child.path}
            path={child.path}
            label={child.name}
            activePath={activePath}
            tree={tree}
            onSelectDir={onSelectDir}
          />
        ))
      ) : (
        <div className="px-2 py-1 text-xs text-sidebar-foreground/60">No subfolders</div>
      )}
    </NestedList.Item>
  );
}
