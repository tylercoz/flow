import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { WorkspaceSerializer } from '../persistence/WorkspaceSerializer'
import { DomainError } from './DomainError'
import type { Diagram } from './Diagram'
import type { Workspace } from './Workspace'
import { allComponents, allDiagrams, workspaceArb } from './testing/workspaceArbitrary'

const pick = fc.nat({ max: 1000 })
const serializer = new WorkspaceSerializer()

// Runs a rejected addLink and checks the error code, the serialized tree, the diagram's links and the change signal.
function expectRejected(workspace: Workspace, diagram: Diagram, source: string, target: string, code: DomainError['code']): void {
  const before = JSON.stringify(serializer.serialize(workspace))
  const links = [...diagram.links]
  const version = workspace.getVersion()
  let notified = 0
  const unsubscribe = workspace.subscribe(() => notified++)

  let error: unknown
  try {
    diagram.addLink(source, target, 'bottom', 'top')
  } catch (e) {
    error = e
  } finally {
    unsubscribe()
  }

  expect(error).toBeInstanceOf(DomainError)
  expect((error as DomainError).code).toBe(code)
  expect((error as DomainError).message).not.toBe('')
  expect(JSON.stringify(serializer.serialize(workspace))).toBe(before)
  expect(diagram.links).toEqual(links)
  expect(notified).toBe(0)
  expect(workspace.getVersion()).toBe(version)
}

describe('Diagram invalid links', () => {
  // Feature: flow, Property 4: Invalid links are rejected and change nothing
  // **Validates: Requirements 3.4**
  it('rejects a link from a component to itself with SELF_LINK and changes nothing', () => {
    fc.assert(
      fc.property(workspaceArb, pick, pick, ({ workspace }, di, ci) => {
        const diagrams = allDiagrams(workspace).filter((d) => d.components.length > 0)
        fc.pre(diagrams.length > 0)
        const diagram = diagrams[di % diagrams.length]
        const { id } = diagram.components[ci % diagram.components.length]
        expectRejected(workspace, diagram, id, id, 'SELF_LINK')
      }),
    )
  })

  // Feature: flow, Property 4: Invalid links are rejected and change nothing
  // **Validates: Requirements 3.4**
  it('rejects a link whose endpoints are not both in the diagram with NOT_IN_DIAGRAM and changes nothing', () => {
    fc.assert(
      fc.property(workspaceArb, pick, pick, pick, fc.boolean(), ({ workspace }, di, ci, oi, outgoing) => {
        const diagrams = allDiagrams(workspace)
        const diagram = diagrams[di % diagrams.length]
        const inside = new Set(diagram.components.map((c) => c.id))
        const outside = allComponents(workspace).filter((c) => !inside.has(c.id))
        fc.pre(diagram.components.length > 0 && outside.length > 0)
        const member = diagram.components[ci % diagram.components.length].id
        const foreign = outside[oi % outside.length].id
        const [source, target] = outgoing ? [member, foreign] : [foreign, member]
        expectRejected(workspace, diagram, source, target, 'NOT_IN_DIAGRAM')
      }),
    )
  })
})
