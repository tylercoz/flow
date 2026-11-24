import fc from 'fast-check'
import { describe, it, expect } from 'vitest'
import { connect } from './testing/connect'
import { componentPatchArb, positionArb, workspaceArb } from './testing/workspaceArbitrary'

describe('Placement bounds', () => {
  // Feature: components-as-resources, Property 2: Placement bounds are private
  // **Validates: Requirements 2.1, 2.2**
  it('Property 2: a new Placement gets a fresh id and the given position', () => {
    fc.assert(
      fc.property(workspaceArb, fc.nat(), positionArb, ({ workspace }, pickIndex, position) => {
        const diagrams = workspace.allDiagrams()
        const diagram = diagrams[pickIndex % diagrams.length]
        const existing = new Set(diagrams.flatMap((d) => d.placements.map((p) => p.id)))

        const created = workspace.createPlacedResource(diagram, { kind: 'component', name: '' }, position)

        expect(existing.has(created.id)).toBe(false)
        expect(created.position).toEqual(position)
        expect(diagram.placement(created.id)).toBe(created)
      }),
    )
  })
})

describe('edits', () => {
  // Feature: flow, Property 2: Edits are read back unchanged
  // **Validates: Requirements 1.2, 1.3, 3.2**
  it('Property 2: a partial update changes exactly the given fields and setPosition reads back', () => {
    fc.assert(
      fc.property(workspaceArb, fc.nat(), componentPatchArb, fc.string(), positionArb, ({ workspace }, pickIndex, patch, name, position) => {
        // Guarantee at least one component Resource and one Link exist, whatever the generated shape.
        const root = workspace.root
        const a = workspace.createPlacedResource(root, { kind: 'component', name: '' }, { x: 0, y: 0 })
        const b = workspace.createPlacedResource(root, { kind: 'component', name: '' }, { x: 1, y: 1 })
        connect(workspace, root, a, b)

        const components = workspace.componentResources()
        const definition = components[pickIndex % components.length].definition!
        const before = { inputs: definition.inputs, outputs: definition.outputs, notes: definition.notes }
        if (patch.inputs) definition.setPorts('inputs', patch.inputs)
        if (patch.outputs) definition.setPorts('outputs', patch.outputs)
        if (patch.notes !== undefined) definition.setNotes(patch.notes)
        expect({ inputs: definition.inputs, outputs: definition.outputs, notes: definition.notes }).toEqual({
          inputs: patch.inputs ?? before.inputs,
          outputs: patch.outputs ?? before.outputs,
          notes: patch.notes ?? before.notes,
        })
        const links = workspace.allDiagrams().flatMap((d) => d.links)
        const link = links[pickIndex % links.length]
        link.setName(name)
        expect(link.name).toBe(name)

        const placements = workspace.allDiagrams().flatMap((d) => [...d.placements])
        const placement = placements[pickIndex % placements.length]
        placement.setPosition(position)
        expect(placement.position).toEqual(position)
      }),
    )
  })
})
