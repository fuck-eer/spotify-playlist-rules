/** Pure boustrophedon layout for the cover graph (interaction-spec §1, §7). */
export interface GraphLayout {
  cols: number;
  rows: number;
  colWidth: number;
  rowHeight: number;
  /** Centre of node i; odd rows run right to left. */
  pos(i: number): { x: number; y: number; row: number; col: number };
  height: number;
  width: number;
}

export const COL_WIDTH = 72;
export const ROW_HEIGHT = 92;
export const MIN_COLS = 3;

export function layout(
  count: number,
  width: number,
  colWidth = COL_WIDTH,
  rowHeight = ROW_HEIGHT,
): GraphLayout {
  const cols = Math.max(MIN_COLS, Math.floor(width / colWidth));
  const rows = Math.ceil(count / cols);
  return {
    cols,
    rows,
    colWidth,
    rowHeight,
    width: cols * colWidth,
    height: rows * rowHeight,
    pos(i: number) {
      const row = Math.floor(i / cols);
      const c = i % cols;
      const col = row % 2 === 0 ? c : cols - 1 - c;
      return { x: col * colWidth + colWidth / 2, y: row * rowHeight + rowHeight / 2, row, col };
    },
  };
}

/** Index of the node nearest to (x, y), or -1 when none is within `radius`. */
export function nearestIndex(
  l: GraphLayout,
  count: number,
  x: number,
  y: number,
  radius: number,
  allow: (i: number) => boolean = () => true,
): number {
  let best = -1;
  let bestD = radius * radius;
  for (let i = 0; i < count; i++) {
    if (!allow(i)) continue;
    const p = l.pos(i);
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d <= bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}
