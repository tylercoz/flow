import type { Position } from '../domain/NodeBounds'

const CORNER_RADIUS = 12

// Straight segments with rounded bends. The radius shrinks on short segments so neighbouring bends never overlap.
export function roundedPath(points: readonly Position[], radius = CORNER_RADIUS): string {
  const [first, ...rest] = points
  let d = `M ${first.x} ${first.y}`
  rest.forEach((p, i) => {
    const prev = points[i]
    const next = points[i + 2]
    const before = Math.hypot(p.x - prev.x, p.y - prev.y)
    const after = next ? Math.hypot(next.x - p.x, next.y - p.y) : 0
    // A zero-length segment has no direction to round along.
    if (!next || before === 0 || after === 0) return void (d += ` L ${p.x} ${p.y}`)
    const inset = Math.min(radius, before / 2, after / 2)
    const enter = { x: p.x + ((prev.x - p.x) / before) * inset, y: p.y + ((prev.y - p.y) / before) * inset }
    const leave = { x: p.x + ((next.x - p.x) / after) * inset, y: p.y + ((next.y - p.y) / after) * inset }
    d += ` L ${enter.x} ${enter.y} Q ${p.x} ${p.y} ${leave.x} ${leave.y}`
  })
  return d
}

// Where the label sits: on the middle bend, or halfway along the middle segment when there is no single middle point.
export function labelPoint(points: readonly Position[]): Position {
  const mid = (points.length - 1) / 2
  const a = points[Math.floor(mid)]
  const b = points[Math.ceil(mid)]
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

export function midpoint(a: Position, b: Position): Position {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}
