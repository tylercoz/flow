import { describe, expect, it } from 'vitest'
import { DomainError } from './DomainError'
import { History } from './History'
import { connect } from './testing/connect'
import { Workspace } from './Workspace'
import type { DiagramDto, WorkspaceSnapshot } from './WorkspaceSnapshot'

const details = (name: string) => ({ name, inputs: [], outputs: [], notes: '' })
const viewport = { x: 0, y: 0, zoom: 1 }
const emptyDiagram = (id: string): DiagramDto => ({ id, viewport, components: [], links: [] })

const snapshot: WorkspaceSnapshot = {
  schemaVersion: 6,
  types: [],
  exceptions: [],
  root: {
    id: 'r',
    viewport,
    components: [
      { id: 'a', details: details('A'), position: { x: 1, y: 2 }, exceptionIds: [], diagram: {
        id: 'ad',
        viewport,
        components: [{ id: 'b', details: details('B'), position: { x: 3, y: 4 }, exceptionIds: [], diagram: emptyDiagram('bd') }],
        links: [],
      } },
    ],
    links: [],
  },
}

function restore() {
  let n = 0
  const workspace = Workspace.restore(snapshot, { next: () => `new${++n}` })
  return { workspace, nested: workspace.root.components[0].diagram.components[0] }
}

describe('Workspace.restore', () => {
  it('keeps stored ids and details', () => {
    const { workspace, nested } = restore()
    expect(workspace.root.id).toBe('r')
    expect(workspace.root.components[0].id).toBe('a')
    expect(nested.id).toBe('b')
    expect(nested.details.name).toBe('B')
  })

  it('notifies when a nested Component changes', () => {
    const { workspace, nested } = restore()
    const before = workspace.getVersion()
    nested.details.patch({ name: 'B2' })
    expect(workspace.getVersion()).toBeGreaterThan(before)
  })

  it('gives Components added after restore fresh ids', () => {
    const { workspace, nested } = restore()
    const added = nested.diagram.addComponent({ x: 0, y: 0 })
    const stored = ['r', 'a', 'ad', 'b', 'bd']
    expect(stored).not.toContain(added.id)
    expect(stored).not.toContain(added.diagram.id)
    expect(workspace.root.addComponent({ x: 0, y: 0 }).id).not.toBe(added.id)
  })
})

describe('Workspace types', () => {
  const empty = () => {
    let n = 0
    return Workspace.empty({ next: () => `t${++n}` })
  }
  it('starts with number, string and boolean', () => {
    expect(empty().types.map((t) => t.name)).toEqual(['number', 'string', 'boolean'])
  })
  it('adds, renames and removes an unused type, notifying each time', () => {
    const ws = empty()
    const before = ws.getVersion()
    const type = ws.addType('date')
    ws.renameType(type.id, 'timestamp')
    expect(ws.types.at(-1)).toEqual({ id: type.id, name: 'timestamp' })
    ws.removeType(type.id)
    expect(ws.types.some((t) => t.id === type.id)).toBe(false)
    expect(ws.getVersion()).toBe(before + 3)
  })
  it('refuses to remove a type used by a nested component port or a link port', () => {
    const ws = empty()
    const [number, string] = ws.types
    const parent = ws.root.addComponent({ x: 0, y: 0 })
    const nested = parent.diagram.addComponent({ x: 0, y: 0 })
    parent.diagram.setPorts(nested.id, 'inputs', [{ name: 'a', typeId: number.id }])
    const other = ws.root.addComponent({ x: 1, y: 1 })
    const link = connect(ws.root, other, ws.root.components[0])
    link.details.patch({ outputs: [{ id: 'lp', name: 'b', typeId: string.id }] })
    expect(() => ws.removeType(number.id)).toThrow(DomainError)
    expect(() => ws.removeType(string.id)).toThrow(DomainError)
    parent.diagram.setPorts(nested.id, 'inputs', [])
    ws.removeType(number.id)
    expect(ws.types.some((t) => t.id === number.id)).toBe(false)
  })
})

describe('Workspace snapshots', () => {
  const fresh = () => {
    let n = 0
    return Workspace.empty({ next: () => `w${++n}` })
  }

  it('replaceContent rebuilds types and notifies once', () => {
    const ws = fresh()
    const before = ws.capture()
    ws.addType('date')
    ws.renameType(ws.types[0].id, 'num')
    const after = ws.capture()
    ws.replaceContent(before)
    expect(ws.types.map((t) => t.name)).toEqual(['number', 'string', 'boolean'])
    const version = ws.getVersion()
    ws.replaceContent(after)
    expect(ws.types.map((t) => t.name)).toEqual(['num', 'string', 'boolean', 'date'])
    expect(ws.getVersion()).toBe(version + 1)
  })

  it('capture ignores viewport changes', () => {
    const ws = fresh()
    const before = ws.capture()
    ws.root.setViewport({ x: 10, y: 20, zoom: 2 })
    expect(ws.capture()).toBe(before)
    ws.root.addComponent({ x: 0, y: 0 })
    expect(ws.capture()).not.toBe(before)
  })

  it('replaceContent keeps the current viewport of Diagrams that still exist', () => {
    const ws = fresh()
    const snap = ws.capture()
    ws.root.setViewport({ x: 5, y: 6, zoom: 3 })
    ws.replaceContent(snap)
    expect(ws.root.viewport).toEqual({ x: 5, y: 6, zoom: 3 })
  })

  it('gives a deleted-then-restored Diagram the neutral viewport', () => {
    const ws = fresh()
    const component = ws.root.addComponent({ x: 0, y: 0 })
    const nestedId = component.diagram.id
    component.diagram.setViewport({ x: 9, y: 9, zoom: 4 })
    const withComponent = ws.capture()
    ws.root.removeComponent(component.id)
    ws.replaceContent(withComponent)
    const restored = ws.root.components.find((c) => c.diagram.id === nestedId)
    expect(restored?.diagram.viewport).toEqual({ x: 0, y: 0, zoom: 1 })
  })
})

describe('Workspace exceptions', () => {
  const setup = () => {
    let n = 0
    const workspace = Workspace.empty({ next: () => `x${++n}` })
    const outer = workspace.root.addComponent({ x: 0, y: 0 })
    const other = workspace.root.addComponent({ x: 1, y: 1 })
    const inner = outer.diagram.addComponent({ x: 2, y: 2 })
    return { workspace, outer, other, inner }
  }

  it('adds and renames catalog entries', () => {
    const { workspace } = setup()
    const e = workspace.addException('NotFound')
    workspace.renameException(e.id, 'Missing')
    expect(workspace.exceptions).toEqual([{ id: e.id, name: 'Missing' }])
  })

  it('stores each exception once per Component and notifies once', () => {
    const { workspace, outer } = setup()
    const e = workspace.addException('NotFound')
    const before = workspace.getVersion()
    outer.setExceptions([e.id, e.id])
    expect(outer.exceptionIds).toEqual([e.id])
    expect(workspace.getVersion()).toBe(before + 1)
  })

  it('counts and removes uses at every nesting level', () => {
    const { workspace, outer, other, inner } = setup()
    const e = workspace.addException('Timeout')
    const keep = workspace.addException('Keep')
    ;[outer, other, inner].forEach((c) => c.setExceptions([e.id, keep.id]))
    expect(workspace.exceptionUsage(e.id)).toBe(3)
    workspace.removeException(e.id)
    expect(workspace.exceptionUsage(e.id)).toBe(0)
    expect(workspace.exceptions.map((x) => x.id)).toEqual([keep.id])
    expect([outer, other, inner].map((c) => c.exceptionIds)).toEqual([[keep.id], [keep.id], [keep.id]])
  })

  it('removes an exception from many Components as one undo step', () => {
    const { workspace, outer, other, inner } = setup()
    const e = workspace.addException('Timeout')
    ;[outer, other, inner].forEach((c) => c.setExceptions([e.id]))
    const history = new History(workspace, { reconcile: () => {} })
    history.start()
    workspace.removeException(e.id)
    history.undo()
    // History started after the setup, so an empty stack means the removal was exactly one step.
    expect(history.canUndo).toBe(false)
    expect(workspace.exceptions).toEqual([e])
    expect(workspace.exceptionUsage(e.id)).toBe(3)
  })

  it('reverts setExceptions with undo', () => {
    const { workspace, outer } = setup()
    const e = workspace.addException('NotFound')
    const history = new History(workspace, { reconcile: () => {} })
    history.start()
    outer.setExceptions([e.id])
    history.undo()
    expect(workspace.root.components[0].exceptionIds).toEqual([])
  })
})
