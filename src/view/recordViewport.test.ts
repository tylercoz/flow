import { describe, expect, it } from 'vitest'
import { Diagram } from '../domain/Diagram'
import { recordViewport } from './recordViewport'

describe('recordViewport', () => {
  it('copies x, y and zoom into the Diagram viewport', () => {
    let changes = 0
    const diagram = new Diagram('d', {
      ids: { next: () => 'id' },
      onChange: () => changes++,
    })
    recordViewport(diagram, { x: 10, y: -20, zoom: 1.5 })
    expect(diagram.viewport).toEqual({ x: 10, y: -20, zoom: 1.5 })
    expect(changes).toBe(1)
  })
})
