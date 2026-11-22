import { describe, expect, it } from 'vitest'
import { Workspace } from '../domain/Workspace'

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
