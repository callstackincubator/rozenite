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

/**
 * A non-interactive row used for a directory's "empty" and "failed" states.
 * It's a `NestedList.Item` rather than a bare `<div>` so it picks up the
 * list's automatic depth indentation and lines up with sibling directories;
 * the blank leading slot reserves the space a folder icon would take.
 */
function FileTreeMessage({ children, tone }: { children: string; tone?: 'danger' }) {
  return (
    <NestedList.Item
      label={children}
      leading={<span />}
      disabled
      className={
        tone === 'danger'
          ? 'pointer-events-none text-danger'
          : 'pointer-events-none text-sidebar-foreground/60'
      }
    />
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
      leading={<Folder />}
      selected={path === activePath}
      expanded={expanded}
      onExpandedChange={(next) => tree.setExpanded(path, next)}
      onClick={() => onSelectDir(path)}
      title={path}
    >
      {cache === 'loading' ? (
        // Listing a directory is fast enough that a spinner only reads as a
        // flicker, but the node still has to render *something*: `NestedList`
        // derives the disclosure chevron and the expand/collapse handler from
        // whether it was given children.
        <span className="hidden" aria-hidden />
      ) : cache === 'error' ? (
        <FileTreeMessage tone="danger">Failed to load</FileTreeMessage>
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
        <FileTreeMessage>No subfolders</FileTreeMessage>
      )}
    </NestedList.Item>
  );
}
