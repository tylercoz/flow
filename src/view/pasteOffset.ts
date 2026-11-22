import type { Position, Size } from '../domain/Component'
import type { Fragment } from '../domain/WorkspaceSnapshot'
import { NODE_SIZE } from './createAtPoint'

// The shift that moves the centre of the fragment's bounding box onto `target`.
// `measured` holds the sizes React Flow rendered, keyed by Component or Placement id. A box grows with its name and
// ports, so the stored size (set only by a resize) and the default are poor stand-ins for it.
export function offsetToCenter(fragment: Fragment, target: Position, measured: ReadonlyMap<string, Size> = new Map()): Position {
  const nodes = [...fragment.components, ...fragment.placements]
  if (nodes.length === 0) return { x: 0, y: 0 }
  const boxes = nodes.map((n) => ({ ...n.position, ...(measured.get(n.id) ?? n.size ?? NODE_SIZE) }))
  const left = Math.min(...boxes.map((b) => b.x))
  const top = Math.min(...boxes.map((b) => b.y))
  const right = Math.max(...boxes.map((b) => b.x + b.width))
  const bottom = Math.max(...boxes.map((b) => b.y + b.height))
  return { x: target.x - (left + right) / 2, y: target.y - (top + bottom) / 2 }
}
