import fc from 'fast-check'
import { describe, it, expect } from 'vitest'
import type { Describable } from './Describable'
import { allDiagrams, detailsPatchArb, positionArb, workspaceArb } from './testing/workspaceArbitrary'

describe('edits', () => {
  // Feature: flow, Property 2: Edits are read back unchanged
  // **Validates: Requirements 1.2, 1.3, 3.2**
  it('Property 2: a partial update changes exactly the given fields and setPosition reads back', () => {
    fc.assert(
      fc.property(workspaceArb, fc.nat(), detailsPatchArb, positionArb, ({ workspace }, pickIndex, patch, position) => {
        // Guarantee at least one Component and one Link exist, whatever the generated shape.
        const root = workspace.root
        const a = root.addComponent({ x: 0, y: 0 })
        const b = root.addComponent({ x: 1, y: 1 })
        root.addLink(a.id, b.id)

        const targets: Describable[] = allDiagrams(workspace).flatMap((d) => [...d.components, ...d.links])
        const target = targets[pickIndex % targets.length]

        const before = target.details.toJSON()
        target.details.patch(patch)
        expect(target.details.toJSON()).toEqual({
          name: patch.name ?? before.name,
          description: patch.description ?? before.description,
          notes: patch.notes ?? before.notes,
        })

        const components = allDiagrams(workspace).flatMap((d) => [...d.components])
        const component = components[pickIndex % components.length]
        component.setPosition(position)
        expect(component.position).toEqual(position)
      }),
    )
  })
})
