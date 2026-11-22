import { describe, expect, it } from 'vitest'
import { labelPoint, roundedPath } from './linkPath'

describe('roundedPath', () => {
  it('draws a straight line when there are no bends', () => {
    expect(roundedPath([{ x: 0, y: 0 }, { x: 10, y: 0 }])).toBe('M 0 0 L 10 0')
  })

  it('rounds a bend with a quadratic curve through the bend point', () => {
    expect(roundedPath([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }], 10)).toBe('M 0 0 L 90 0 Q 100 0 100 10 L 100 100')
  })

  it('limits the radius to half of a short segment', () => {
    expect(roundedPath([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 100 }], 50)).toContain('L 5 0 Q 10 0 10 5')
  })

  it('skips rounding next to a repeated point', () => {
    expect(roundedPath([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }])).toBe('M 0 0 L 0 0 L 10 0')
  })
})

describe('labelPoint', () => {
  it('uses the middle point when the count is odd', () => {
    expect(labelPoint([{ x: 0, y: 0 }, { x: 4, y: 6 }, { x: 10, y: 0 }])).toEqual({ x: 4, y: 6 })
  })

  it('uses the middle of the middle segment when the count is even', () => {
    expect(labelPoint([{ x: 0, y: 0 }, { x: 10, y: 20 }])).toEqual({ x: 5, y: 10 })
  })
})
