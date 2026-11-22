import { describe, expect, it } from 'vitest'
import type { ComponentDto } from '../domain/WorkspaceSnapshot'
import { NODE_SIZE } from './createAtPoint'
import { offsetToCenter } from './pasteOffset'

const component = (x: number, y: number, size?: { width: number; height: number }): ComponentDto => ({
  id: 'c',
  details: { name: '', inputs: [], outputs: [], notes: '' },
  position: { x, y },
  size,
  exceptionIds: [],
  diagram: { id: 'd', viewport: { x: 0, y: 0, zoom: 1 }, components: [], links: [] },
})

describe('offsetToCenter', () => {
  it('centres a single Component on the target', () => {
    const offset = offsetToCenter({ components: [component(0, 0, { width: 100, height: 50 })], links: [] }, { x: 200, y: 200 })
    expect(offset).toEqual({ x: 150, y: 175 })
  })
  it('centres the bounding box of several Components', () => {
    const fragment = { components: [component(0, 0, { width: 10, height: 10 }), component(90, 90, { width: 10, height: 10 })], links: [] }
    expect(offsetToCenter(fragment, { x: 0, y: 0 })).toEqual({ x: -50, y: -50 })
  })
  it('prefers the measured size over the stored and default ones', () => {
    const measured = new Map([['c', { width: 100, height: 200 }]])
    expect(offsetToCenter({ components: [component(0, 0)], links: [] }, { x: 0, y: 0 }, measured)).toEqual({ x: -50, y: -100 })
  })
  it('falls back to the default size when none is stored', () => {
    const centre = { x: NODE_SIZE.width / 2, y: NODE_SIZE.height / 2 }
    expect(offsetToCenter({ components: [component(0, 0)], links: [] }, centre)).toEqual({ x: 0, y: 0 })
  })
})
