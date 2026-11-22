import { describe, expect, it, vi } from 'vitest'
import { NodeBounds } from './NodeBounds'
import { Placement } from './Placement'

describe('NodeBounds', () => {
  it('has no size until one is given', () => {
    expect(new NodeBounds({ x: 1, y: 2 }, () => {}).size).toBeUndefined()
  })

  it('keeps the initial position and size', () => {
    const b = new NodeBounds({ x: 1, y: 2 }, () => {}, { width: 3, height: 4 })
    expect(b.position).toEqual({ x: 1, y: 2 })
    expect(b.size).toEqual({ width: 3, height: 4 })
  })

  it('setPosition moves, keeps the size and notifies once', () => {
    const onChange = vi.fn()
    const b = new NodeBounds({ x: 0, y: 0 }, onChange, { width: 3, height: 4 })
    b.setPosition({ x: 5, y: 6 })
    expect(b.position).toEqual({ x: 5, y: 6 })
    expect(b.size).toEqual({ width: 3, height: 4 })
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('setBounds sets position and size and notifies once', () => {
    const onChange = vi.fn()
    const b = new NodeBounds({ x: 0, y: 0 }, onChange)
    b.setBounds({ x: 7, y: 8 }, { width: 9, height: 10 })
    expect(b.position).toEqual({ x: 7, y: 8 })
    expect(b.size).toEqual({ width: 9, height: 10 })
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('does not alias the objects passed in', () => {
    const p = { x: 1, y: 1 }
    const b = new NodeBounds(p, () => {})
    p.x = 99
    expect(b.position.x).toBe(1)
  })
})

describe('Placement', () => {
  it('holds its id and Resource id', () => {
    const p = new Placement('p1', 'r1', { x: 1, y: 2 }, () => {})
    expect([p.id, p.resourceId, p.position, p.size]).toEqual(['p1', 'r1', { x: 1, y: 2 }, undefined])
  })

  it('delegates setPosition and setBounds and notifies each time', () => {
    const onChange = vi.fn()
    const p = new Placement('p1', 'r1', { x: 0, y: 0 }, onChange)
    p.setPosition({ x: 3, y: 4 })
    expect(p.position).toEqual({ x: 3, y: 4 })
    p.setBounds({ x: 5, y: 6 }, { width: 7, height: 8 })
    expect(p.position).toEqual({ x: 5, y: 6 })
    expect(p.size).toEqual({ width: 7, height: 8 })
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('accepts an initial size', () => {
    const p = new Placement('p1', 'r1', { x: 0, y: 0 }, () => {}, { width: 2, height: 3 })
    expect(p.size).toEqual({ width: 2, height: 3 })
  })
})
