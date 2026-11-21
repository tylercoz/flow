import { describe, expect, it } from 'vitest'
import { Diagram } from '../domain/Diagram'
import type { Scheduler } from '../domain/Scheduler'
import { NODE_SIZE, createComponentAt, isEmptyCanvas } from './createAtPoint'
import { RenameController } from './RenameController'

// Vitest runs in Node, so targets are plain objects that expose only classList.
const target = (...classes: string[]) => ({ classList: { contains: (c: string) => classes.includes(c) } }) as unknown as EventTarget

describe('isEmptyCanvas', () => {
  it('is true for the React Flow pane', () => {
    expect(isEmptyCanvas(target('react-flow__pane', 'draggable'))).toBe(true)
  })

  it.each(['react-flow__node', 'react-flow__edge', 'react-flow__controls', 'rename-input'])('is false for %s', (cls) => {
    expect(isEmptyCanvas(target(cls))).toBe(false)
  })

  it('is false for null and for targets without classList', () => {
    expect(isEmptyCanvas(null)).toBe(false)
    expect(isEmptyCanvas({} as EventTarget)).toBe(false)
  })
})

describe('createComponentAt', () => {
  function setup() {
    let n = 0
    const diagram = new Diagram('root', { ids: { next: () => `id${++n}` }, onChange: () => {} })
    const scheduler: Scheduler = { set: () => 0 as never, cancel: () => {} }
    return { diagram, rename: new RenameController(scheduler) }
  }

  it('creates the same Component as the toolbar add action, only positioned differently', () => {
    const toolbar = setup()
    const expected = toolbar.diagram.addComponent({ x: 0, y: 0 })

    const { diagram, rename } = setup()
    const c = createComponentAt(diagram, { x: 0, y: 0 }, rename)

    expect(c.details.toJSON()).toEqual(expected.details.toJSON())
    expect(c.diagram.components).toHaveLength(0)
    expect(c.diagram.links).toHaveLength(0)
    expect(diagram.components).toEqual([c])
  })

  it('centers the Component on the point and starts Rename on it', () => {
    const { diagram, rename } = setup()
    const c = createComponentAt(diagram, { x: 200, y: 100 }, rename)
    expect(c.position).toEqual({ x: 200 - NODE_SIZE.width / 2, y: 100 - NODE_SIZE.height / 2 })
    expect(rename.editingId).toBe(c.id)
  })
})
