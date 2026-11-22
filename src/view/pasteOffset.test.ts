import { describe, expect, it } from 'vitest'
import type { PlacementDto } from '../domain/WorkspaceSnapshot'
import { NODE_SIZE } from './nodeSize'
import { offsetToCenter } from './pasteOffset'

const placement = (x: number, y: number, size?: { width: number; height: number }, id = 'p'): PlacementDto => ({
  id,
  resourceId: 'r',
  position: { x, y },
  size,
})
const fragment = (...placements: PlacementDto[]) => ({ placements, links: [] })

describe('offsetToCenter', () => {
  it('is zero for an empty Fragment', () => {
    expect(offsetToCenter(fragment(), { x: 40, y: 40 })).toEqual({ x: 0, y: 0 })
  })

  it('centres a Placement with a default size when none is stored', () => {
    const centre = { x: NODE_SIZE.width / 2, y: NODE_SIZE.height / 2 }
    expect(offsetToCenter(fragment(placement(0, 0)), centre)).toEqual({ x: 0, y: 0 })
  })

  it('centres a single Placement on the target', () => {
    const offset = offsetToCenter(fragment(placement(0, 0, { width: 100, height: 50 })), { x: 200, y: 200 })
    expect(offset).toEqual({ x: 150, y: 175 })
  })

  it('centres the bounding box of several Placements', () => {
    const f = fragment(placement(0, 0, { width: 10, height: 10 }, 'a'), placement(90, 90, { width: 10, height: 10 }, 'b'))
    expect(offsetToCenter(f, { x: 0, y: 0 })).toEqual({ x: -50, y: -50 })
  })

  it('prefers the measured size over the stored and default ones', () => {
    const measured = new Map([['p', { width: 100, height: 200 }]])
    expect(offsetToCenter(fragment(placement(0, 0)), { x: 0, y: 0 }, measured)).toEqual({ x: -50, y: -100 })
  })
})
