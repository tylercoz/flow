import { describe, expect, it } from 'vitest'
import { Navigator } from './Navigator'
import { locatePlacements } from './PlacementLocator'
import { Workspace } from './Workspace'

function setup() {
  let n = 0
  const workspace = Workspace.empty({ next: () => `id${++n}` })
  const a = workspace.createPlacedResource(workspace.root, { kind: 'component', name: 'A' }, { x: 0, y: 0 })
  const aDiagram = workspace.resources.get(a.resourceId)!.definition!.diagram
  const inner = workspace.createPlacedResource(aDiagram, { kind: 'text', name: 'note' }, { x: 5, y: 5 })
  return { workspace, a, inner }
}

describe('locatePlacements', () => {
  it('finds a Placement on a nested Level with the path to reach it', () => {
    const { workspace, a, inner } = setup()
    expect(locatePlacements(workspace, inner.resourceId)).toEqual([{ rootId: workspace.root.id, path: [a.id], placementId: inner.id }])
  })
  it('finds every Placement of a Resource across Levels', () => {
    const { workspace, a, inner } = setup()
    const aDiagram = workspace.resources.get(a.resourceId)!.definition!.diagram
    const second = aDiagram.addPlacement(inner.resourceId, { x: 9, y: 9 })
    const top = workspace.root.addPlacement(inner.resourceId, { x: 1, y: 1 })
    expect(locatePlacements(workspace, inner.resourceId).map((l) => l.placementId).sort()).toEqual([inner.id, second.id, top.id].sort())
  })
})

describe('Navigator.goTo', () => {
  it('opens a nested Level in one step and rejects an unknown path without moving', () => {
    const { workspace, a } = setup()
    const navigator = new Navigator(workspace)
    navigator.goTo(workspace.root.id, [a.id])
    expect(navigator.current).toBe(workspace.resources.get(a.resourceId)!.definition!.diagram)
    expect(() => navigator.goTo(workspace.root.id, ['missing'])).toThrow()
    expect(navigator.path).toEqual([a.id])
  })
})
