export interface FoldableNode {
  children?: FoldableNode[];
  payload?: Record<string, unknown>;
}

export type ActiveRecallFoldMode = 'expand-all' | 'fold-level-1' | 'fold-level-2';

/**
 * Applies Markmap's `payload.fold` flags recursively on a transformed node tree.
 * - `fold-level-1`: folds nodes at depth >= 1 (shows root + main level-1 branches only).
 * - `fold-level-2`: folds nodes at depth >= 2 (shows root + level-1 + level-2 branches).
 * - `expand-all`: unfolds every node in the tree.
 */
export function applyFoldMode<T extends FoldableNode>(
  root: T,
  mode: ActiveRecallFoldMode,
): T {
  const minFoldDepth = mode === 'fold-level-1' ? 1 : mode === 'fold-level-2' ? 2 : Number.POSITIVE_INFINITY;
  visitNode(root, 0, minFoldDepth);
  return root;
}

function visitNode(node: FoldableNode, depth: number, minFoldDepth: number): void {
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;

  if (hasChildren) {
    const shouldFold = depth >= minFoldDepth;
    node.payload = {
      ...(node.payload ?? {}),
      fold: shouldFold ? 1 : 0,
    };

    for (const child of node.children!) {
      visitNode(child, depth + 1, minFoldDepth);
    }
  } else if (node.payload && 'fold' in node.payload) {
    node.payload = {
      ...node.payload,
      fold: 0,
    };
  }
}
