import { describe, expect, it } from 'vitest'
import { findCycle, reaches, type DiagramGraph } from './DiagramGraph'

const graph = (edges: Record<string, string[]>): DiagramGraph => new Map(Object.entries(edges))

describe('DiagramGraph', () => {
  it('handles an empty graph', () => {
    expect(findCycle(graph({}))).toBeUndefined()
    expect(reaches(graph({}), 'a', 'b')).toBe(false)
  })

  it('reaches is reflexive, even for ids missing from the graph', () => {
    expect(reaches(graph({}), 'a', 'a')).toBe(true)
  })

  it('detects a self-loop', () => {
    expect(findCycle(graph({ a: ['a'] }))).toBe('a')
  })

  it('detects an indirect cycle and returns a Diagram on it', () => {
    const g = graph({ root: ['a'], a: ['b'], b: ['c'], c: ['a'] })
    expect(['a', 'b', 'c']).toContain(findCycle(g))
  })

  it('accepts a diamond as acyclic', () => {
    const g = graph({ a: ['b', 'c'], b: ['d'], c: ['d'], d: [] })
    expect(findCycle(g)).toBeUndefined()
    expect(reaches(g, 'a', 'd')).toBe(true)
  })

  it('reaches follows edges one way only', () => {
    const g = graph({ a: ['b'], b: ['c'], x: [] })
    expect(reaches(g, 'a', 'c')).toBe(true)
    expect(reaches(g, 'c', 'a')).toBe(false)
    expect(reaches(g, 'a', 'x')).toBe(false)
  })

  it('reaches terminates on a cycle', () => {
    expect(reaches(graph({ a: ['b'], b: ['a'] }), 'a', 'z')).toBe(false)
  })
})
