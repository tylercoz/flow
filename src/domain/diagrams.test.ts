import { describe, expect, it } from 'vitest'
import { History } from './History'
import { Navigator } from './Navigator'
import { Workspace } from './Workspace'

function setup() {
  let n = 0
  const workspace = Workspace.empty({ next: () => `id${++n}` }, () => '2024-01-01T00:00:00.000Z')
  return { workspace, navigator: new Navigator(workspace) }
}

describe('Workspace diagrams', () => {
  it('starts with one named diagram', () => {
    const { workspace } = setup()
    expect(workspace.diagrams.map((d) => d.name)).toEqual(['Diagram 1'])
    expect(workspace.root).toBe(workspace.diagrams[0].diagram)
  })

  it('adds and renames a diagram, notifying each time', () => {
    const { workspace } = setup()
    let calls = 0
    workspace.subscribe(() => calls++)
    const added = workspace.addDiagram('Second')
    workspace.renameDiagram(added.id, 'Renamed')
    expect(workspace.diagrams.map((d) => d.name)).toEqual(['Diagram 1', 'Renamed'])
    expect(calls).toBe(2)
  })

  it('shares Resources between diagrams', () => {
    const { workspace } = setup()
    const second = workspace.addDiagram('Second')
    const placed = workspace.createPlacedResource(workspace.root, { kind: 'component', name: 'A' }, { x: 0, y: 0 })
    expect(() => second.addPlacement(placed.resourceId, { x: 1, y: 1 })).not.toThrow()
  })

  it('removes a diagram and the Resources placed only in it', () => {
    const { workspace } = setup()
    const second = workspace.addDiagram('Second')
    const kept = workspace.createPlacedResource(workspace.root, { kind: 'user', name: 'Kept' }, { x: 0, y: 0 })
    const lost = workspace.createPlacedResource(second, { kind: 'user', name: 'Lost' }, { x: 0, y: 0 })
    expect(workspace.diagramImpact(second.id)).toEqual({ nodes: 1, links: 0 })
    workspace.removeDiagram(second.id)
    expect(workspace.diagrams).toHaveLength(1)
    expect(workspace.resources.get(kept.resourceId)).toBeDefined()
    expect(workspace.resources.get(lost.resourceId)).toBeUndefined()
  })

  it('refuses to remove the last diagram and unknown ones', () => {
    const { workspace } = setup()
    expect(() => workspace.removeDiagram(workspace.root.id)).toThrow(expect.objectContaining({ code: 'LAST_DIAGRAM' }))
    expect(() => workspace.removeDiagram('nope')).toThrow(expect.objectContaining({ code: 'MISSING_DIAGRAM' }))
  })

  it('detects a cycle across diagrams', () => {
    const { workspace } = setup()
    const second = workspace.addDiagram('Second')
    const a = workspace.createPlacedResource(second, { kind: 'component', name: 'A' }, { x: 0, y: 0 })
    const inner = workspace.resources.get(a.resourceId)!.definition!.diagram
    expect(() => inner.addPlacement(a.resourceId, { x: 0, y: 0 })).toThrow(expect.objectContaining({ code: 'REFERENCE_CYCLE' }))
  })

  it('undoes adding a diagram through History', () => {
    const { workspace, navigator } = setup()
    const history = new History(workspace, navigator)
    history.start()
    workspace.addDiagram('Second')
    history.undo()
    expect(workspace.diagrams).toHaveLength(1)
  })
})

describe('Navigator diagrams', () => {
  it('switches diagram and drops the path', () => {
    const { workspace, navigator } = setup()
    const second = workspace.addDiagram('Second')
    const placed = workspace.createPlacedResource(workspace.root, { kind: 'component', name: 'A' }, { x: 0, y: 0 })
    navigator.open(placed.id)
    navigator.openDiagram(second.id)
    expect(navigator.current).toBe(second)
    expect(navigator.path).toEqual([])
    expect(() => navigator.openDiagram('nope')).toThrow(expect.objectContaining({ code: 'MISSING_DIAGRAM' }))
  })

  it('falls back to the first diagram when the viewed one is gone', () => {
    const { workspace, navigator } = setup()
    const second = workspace.addDiagram('Second')
    navigator.openDiagram(second.id)
    workspace.removeDiagram(second.id)
    navigator.reconcile()
    expect(navigator.current).toBe(workspace.root)
  })
})

describe('Project metadata', () => {
  it('edits name and description as undoable steps', () => {
    const { workspace, navigator } = setup()
    const history = new History(workspace, navigator)
    history.start()
    workspace.setProjectName('Shop')
    workspace.setProjectDescription('Checkout flows')
    expect(workspace.project).toMatchObject({ name: 'Shop', description: 'Checkout flows' })
    history.undo()
    history.undo()
    expect(workspace.project).toMatchObject({ name: 'Untitled project', description: '' })
  })

  it('stamping a save changes neither the capture nor History', () => {
    const { workspace, navigator } = setup()
    const history = new History(workspace, navigator)
    history.start()
    const before = workspace.capture()
    workspace.stampSaved('2025-05-05T00:00:00.000Z')
    expect(workspace.capture()).toBe(before)
    expect(workspace.project.updatedAt).toBe('2025-05-05T00:00:00.000Z')
    expect(workspace.project.createdAt).toBe('2024-01-01T00:00:00.000Z')
    expect(history.canUndo).toBe(false)
  })

  it('keeps timestamps when undo restores content', () => {
    const { workspace, navigator } = setup()
    const history = new History(workspace, navigator)
    history.start()
    workspace.setProjectName('Shop')
    workspace.stampSaved('2025-05-05T00:00:00.000Z')
    history.undo()
    expect(workspace.project.updatedAt).toBe('2025-05-05T00:00:00.000Z')
  })

  it('load replaces content, project and timestamps; reset clears History', () => {
    const { workspace, navigator } = setup()
    const history = new History(workspace, navigator)
    history.start()
    workspace.setProjectName('Old')
    const other = Workspace.empty({ next: (() => { let n = 100; return () => `o${++n}` })() }, () => '2020-02-02T00:00:00.000Z')
    workspace.load(other.toSnapshot())
    history.reset()
    navigator.reconcile()
    expect(workspace.project).toEqual(other.project)
    expect(workspace.root.id).toBe(other.root.id)
    expect(history.canUndo).toBe(false)
    expect(navigator.current).toBe(workspace.root)
  })
})
