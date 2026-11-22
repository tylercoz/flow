import { describe, expect, it } from 'vitest'
import { Workspace } from '../domain/Workspace'
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
    const workspace = Workspace.empty({ next: () => crypto.randomUUID() })
    const scheduler: Scheduler = { set: () => 0 as never, cancel: () => {} }
    return { workspace, diagram: workspace.root, rename: new RenameController(scheduler) }
  }

  it('creates one empty component Resource and one Placement of it', () => {
    const { workspace, diagram, rename } = setup()
    const p = createComponentAt(workspace, diagram, { x: 0, y: 0 }, rename)
    const resource = workspace.resources.get(p.resourceId)!
    expect(resource.kind).toBe('component')
    expect(resource.definition!.diagram.placements).toHaveLength(0)
    expect(resource.definition!.diagram.links).toHaveLength(0)
    expect(workspace.resources.byKind('component')).toEqual([resource])
    expect(diagram.placements).toEqual([p])
  })

  it('centers the Placement on the point and starts Rename on it', () => {
    const { workspace, diagram, rename } = setup()
    const p = createComponentAt(workspace, diagram, { x: 200, y: 100 }, rename)
    expect(p.position).toEqual({ x: 200 - NODE_SIZE.width / 2, y: 100 - NODE_SIZE.height / 2 })
    expect(rename.editingId).toBe(p.id)
  })

  it('notifies once for the Resource and Placement together', () => {
    const { workspace, diagram, rename } = setup()
    const before = workspace.getVersion()
    createComponentAt(workspace, diagram, { x: 0, y: 0 }, rename)
    expect(workspace.getVersion()).toBe(before + 1)
  })
})

describe('Picker cycle filter', () => {
  // ResourcePicker lists byKind(kind) minus wouldCreateCycle(diagram, id); Component is a RESOURCE_KINDS entry.
  it('lists a component Resource unless placing it in the Diagram would close a cycle', () => {
    const workspace = Workspace.empty({ next: () => crypto.randomUUID() })
    const outer = workspace.createPlacedResource(workspace.root, { kind: 'component', name: 'Outer' }, { x: 0, y: 0 })
    const outerDiagram = workspace.resources.get(outer.resourceId)!.definition!.diagram
    const inner = workspace.createPlacedResource(outerDiagram, { kind: 'component', name: 'Inner' }, { x: 0, y: 0 })
    const innerDiagram = workspace.resources.get(inner.resourceId)!.definition!.diagram
    const listed = (diagram: typeof outerDiagram) =>
      workspace.resources.byKind('component').filter((r) => !workspace.wouldCreateCycle(diagram, r.id)).map((r) => r.id)
    expect(listed(workspace.root)).toEqual([outer.resourceId, inner.resourceId])
    expect(listed(outerDiagram)).toEqual([inner.resourceId])
    expect(listed(innerDiagram)).toEqual([])
  })
})
