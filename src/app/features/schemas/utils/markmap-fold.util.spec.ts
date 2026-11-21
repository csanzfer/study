import { describe, expect, it } from 'vitest';
import { FoldableNode, applyFoldMode } from './markmap-fold.util';

function createSampleTree(): FoldableNode {
  return {
    children: [
      {
        children: [
          {
            children: [{}],
          },
        ],
      },
      {
        children: [{}],
      },
    ],
  };
}

describe('applyFoldMode', () => {
  it('folds level 1 and deeper nodes with children in fold-level-1 mode', () => {
    const tree = createSampleTree();
    applyFoldMode(tree, 'fold-level-1');

    expect(tree.payload?.['fold']).toBe(0);
    expect(tree.children?.[0].payload?.['fold']).toBe(1);
    expect(tree.children?.[0].children?.[0].payload?.['fold']).toBe(1);
    expect(tree.children?.[1].payload?.['fold']).toBe(1);
  });

  it('keeps level 1 open and folds level 2+ in fold-level-2 mode', () => {
    const tree = createSampleTree();
    applyFoldMode(tree, 'fold-level-2');

    expect(tree.payload?.['fold']).toBe(0);
    expect(tree.children?.[0].payload?.['fold']).toBe(0);
    expect(tree.children?.[0].children?.[0].payload?.['fold']).toBe(1);
    expect(tree.children?.[1].payload?.['fold']).toBe(0);
  });

  it('unfolds all nodes in expand-all mode', () => {
    const tree = createSampleTree();
    applyFoldMode(tree, 'fold-level-1');
    applyFoldMode(tree, 'expand-all');

    expect(tree.payload?.['fold']).toBe(0);
    expect(tree.children?.[0].payload?.['fold']).toBe(0);
    expect(tree.children?.[0].children?.[0].payload?.['fold']).toBe(0);
    expect(tree.children?.[1].payload?.['fold']).toBe(0);
  });
});
