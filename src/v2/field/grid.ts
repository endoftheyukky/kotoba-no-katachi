/** a field's grid on the page: where a cell's centre is (FieldGeometry decides the grid, Layout reads it) */
import type { FieldGrid } from '../types/field'

/** the centre of a cell of a grid */
export function cellAt(g: FieldGrid, row: number, col: number): { x: number; y: number } {
  return { x: g.x0 + (col + 0.5) * g.sx + Math.floor(col / g.n) * g.gap, y: g.y0 + (row + 0.5) * g.sy }
}
