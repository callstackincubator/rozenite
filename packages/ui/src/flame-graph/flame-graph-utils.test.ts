import { describe, expect, it } from 'vitest';
import {
  findMaxSelfValue,
  getFrameKey,
  getHeatBucket,
  getSelfValue,
  layoutFlameGraph,
  type FlameGraphNode,
} from './flame-graph-utils';

describe('getSelfValue', () => {
  it('derives self value as value minus the sum of children', () => {
    const node: FlameGraphNode = {
      name: 'root',
      value: 10,
      children: [
        { name: 'a', value: 3 },
        { name: 'b', value: 2 },
      ],
    };

    expect(getSelfValue(node)).toBe(5);
  });

  it('uses an explicit selfValue when given, ignoring children', () => {
    const node: FlameGraphNode = {
      name: 'root',
      value: 10,
      selfValue: 1,
      children: [{ name: 'a', value: 3 }],
    };

    expect(getSelfValue(node)).toBe(1);
  });

  it('is 0 for a leaf with no explicit selfValue', () => {
    expect(getSelfValue({ name: 'leaf', value: 4 })).toBe(4);
  });

  it('clamps to 0 when children exceed the parent value', () => {
    const node: FlameGraphNode = {
      name: 'root',
      value: 5,
      children: [
        { name: 'a', value: 3 },
        { name: 'b', value: 4 },
      ],
    };

    expect(getSelfValue(node)).toBe(0);
  });

  it('clamps a negative explicit selfValue to 0', () => {
    expect(getSelfValue({ name: 'leaf', value: 4, selfValue: -2 })).toBe(0);
  });
});

describe('getFrameKey', () => {
  it('uses the explicit id when present', () => {
    expect(getFrameKey({ id: 'stable-id', name: 'a', value: 1 }, 'parent', 0)).toBe('stable-id');
  });

  it('builds a root key from just the name', () => {
    expect(getFrameKey({ name: 'root', value: 1 }, null, 0)).toBe('0:root');
  });

  it('builds a path-based key from the parent key and index', () => {
    expect(getFrameKey({ name: 'child', value: 1 }, '0:root', 2)).toBe('0:root/2:child');
  });

  it('is stable across repeated calls with the same inputs', () => {
    const node: FlameGraphNode = { name: 'child', value: 1 };
    expect(getFrameKey(node, '0:root', 1)).toBe(getFrameKey(node, '0:root', 1));
  });

  it('is unique for same-named siblings by index', () => {
    const first = getFrameKey({ name: 'dup', value: 1 }, '0:root', 0);
    const second = getFrameKey({ name: 'dup', value: 1 }, '0:root', 1);
    expect(first).not.toBe(second);
  });
});

describe('findMaxSelfValue', () => {
  it('finds the largest self value across the whole tree', () => {
    const tree: FlameGraphNode = {
      name: 'root',
      value: 20,
      children: [
        { name: 'a', value: 5 },
        {
          name: 'b',
          value: 15,
          children: [
            { name: 'c', value: 2 },
            { name: 'd', value: 3 },
          ],
        },
      ],
    };

    // root self = 20 - (5+15) = 0; a self = 5; b self = 15-(2+3) = 10; c=2; d=3
    expect(findMaxSelfValue(tree)).toBe(10);
  });

  it('returns the single node self value for a leaf tree', () => {
    expect(findMaxSelfValue({ name: 'leaf', value: 7 })).toBe(7);
  });
});

describe('getHeatBucket', () => {
  it('buckets values at the documented boundaries', () => {
    expect(getHeatBucket(0)).toBe('none');
    expect(getHeatBucket(0.01)).toBe('light');
    expect(getHeatBucket(0.2)).toBe('light');
    expect(getHeatBucket(0.2001)).toBe('moderate');
    expect(getHeatBucket(0.4)).toBe('moderate');
    expect(getHeatBucket(0.4001)).toBe('heavy');
    expect(getHeatBucket(0.7)).toBe('heavy');
    expect(getHeatBucket(0.7001)).toBe('heaviest');
    expect(getHeatBucket(1)).toBe('heaviest');
  });
});

describe('layoutFlameGraph', () => {
  const tree: FlameGraphNode = {
    name: 'root',
    value: 100,
    children: [
      {
        name: 'a',
        value: 60,
        children: [
          { name: 'a1', value: 20 },
          { name: 'a2', value: 30 },
        ],
      },
      { name: 'b', value: 40 },
    ],
  };

  it('returns an empty layout for null data', () => {
    expect(layoutFlameGraph(null)).toEqual({ frames: [], depthCount: 0, focusedNode: null });
  });

  it('positions a simple 3-level tree by offset and width, unfocused', () => {
    const { frames, depthCount, focusedNode } = layoutFlameGraph(tree);

    expect(depthCount).toBe(3);
    expect(focusedNode).toBeNull();

    const byKey = Object.fromEntries(frames.map((frame) => [frame.key, frame]));

    expect(byKey['0:root']).toMatchObject({ depth: 0, left: 0, width: 100 });
    expect(byKey['0:root/0:a']).toMatchObject({ depth: 1, left: 0, width: 60 });
    expect(byKey['0:root/1:b']).toMatchObject({ depth: 1, left: 60, width: 40 });
    expect(byKey['0:root/0:a/0:a1']).toMatchObject({ depth: 2, left: 0, width: 20 });
    expect(byKey['0:root/0:a/1:a2']).toMatchObject({ depth: 2, left: 20, width: 30 });
  });

  it('scales the focused subtree to full width and keeps ancestors full width above it', () => {
    const { frames, depthCount, focusedNode } = layoutFlameGraph(tree, {
      focusedKey: '0:root/0:a',
    });

    expect(focusedNode?.name).toBe('a');
    expect(depthCount).toBe(3);

    const byKey = Object.fromEntries(frames.map((frame) => [frame.key, frame]));

    // Ancestor of the focused node spans the full row.
    expect(byKey['0:root']).toMatchObject({ depth: 0, left: 0, width: 100 });
    // The focused node itself now fills the width at its own depth.
    expect(byKey['0:root/0:a']).toMatchObject({ depth: 1, left: 0, width: 100 });
    // Its children are rescaled against the focused node's value (60), not the root's.
    expect(byKey['0:root/0:a/0:a1']).toMatchObject({ depth: 2, left: 0, width: (20 / 60) * 100 });
    expect(byKey['0:root/0:a/1:a2']).toMatchObject({
      depth: 2,
      left: (20 / 60) * 100,
      width: (30 / 60) * 100,
    });
    // Siblings of the focused node are gone.
    expect(byKey['0:root/1:b']).toBeUndefined();
  });

  it('culls frames narrower than minFrameWidth', () => {
    // Against the root's total of 100, a1 is 20% (culled) and a2 is 30%
    // (kept) — a threshold of 25 splits the two.
    const { frames } = layoutFlameGraph(tree, { minFrameWidth: 25 });
    const keys = frames.map((frame) => frame.key);

    expect(keys).toContain('0:root');
    expect(keys).toContain('0:root/0:a');
    expect(keys).toContain('0:root/1:b');
    expect(keys).not.toContain('0:root/0:a/0:a1');
    expect(keys).toContain('0:root/0:a/1:a2');
  });

  it('culls a whole narrow branch, including grandchildren', () => {
    const deepTree: FlameGraphNode = {
      name: 'root',
      value: 100,
      children: [
        { name: 'big', value: 95 },
        {
          name: 'tiny',
          value: 5,
          children: [{ name: 'tiny-child', value: 5 }],
        },
      ],
    };

    const { frames } = layoutFlameGraph(deepTree, { minFrameWidth: 10 });
    const keys = frames.map((frame) => frame.key);

    expect(keys).toContain('0:root/0:big');
    expect(keys).not.toContain('0:root/1:tiny');
    expect(keys).not.toContain('0:root/1:tiny/0:tiny-child');
  });

  it('distributes width evenly among siblings when the subtree total value is 0', () => {
    const zeroTree: FlameGraphNode = {
      name: 'root',
      value: 0,
      children: [
        { name: 'a', value: 0 },
        { name: 'b', value: 0 },
        { name: 'c', value: 0 },
      ],
    };

    const { frames } = layoutFlameGraph(zeroTree);
    const byKey = Object.fromEntries(frames.map((frame) => [frame.key, frame]));

    expect(byKey['0:root']).toMatchObject({ left: 0, width: 100 });
    expect(byKey['0:root/0:a']).toMatchObject({ left: 0, width: 100 / 3 });
    expect(byKey['0:root/1:b']).toMatchObject({ left: 100 / 3, width: 100 / 3 });
    expect(byKey['0:root/2:c']).toMatchObject({ left: (2 * 100) / 3, width: 100 / 3 });
  });

  it('falls back to the whole tree when focusedKey matches no node', () => {
    const { frames, focusedNode } = layoutFlameGraph(tree, { focusedKey: 'does-not-exist' });

    expect(focusedNode).toBeNull();
    expect(frames.map((frame) => frame.key)).toContain('0:root/1:b');
  });
});
