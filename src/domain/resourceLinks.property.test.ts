import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { Diagram } from './Diagram'
import { DomainError } from './DomainError'
import { RESOURCE_KINDS } from './ResourceKinds'
import { allDiagrams, workspaceArb } from './testing/workspaceArbitrary'
import type { Workspace } from './Workspace'

const pick = fc.nat({ max: 1000 })
const SIDES = ['top', 'right', 'bottom', 'left']

// Every id a user could plausibly drop on an end: real ports, every fixed handle, and junk.
function candidateIds(diagram: Diagram, nodeId: string): string[] {
  const component = diagram.component(nodeId)
  const ports = component ? [...component.details.inputs, ...component.details.outputs].map((p) => p.id) : []
  return [...ports, ...SIDES, 'read', 'write', 'nope']
}

// The role rule of Requirement 2, restated independently of LinkRules.
function assertEndId(workspace: Workspace, diagram: Diagram, nodeId: string, portId: string, role: 'source' | 'target'): void {
  expect(typeof portId).toBe('string')
  const component = diagram.component(nodeId)
  if (component) {
    const ports = role === 'source' ? component.details.outputs : component.details.inputs
    expect(ports.map((p) => p.id)).toContain(portId)
    return
  }
  const placement = diagram.placement(nodeId)
  expect(placement).toBeDefined()
  const kind = workspace.resources.get(placement!.resourceId)!.kind
  if (kind === 'database') expect(portId).toBe(role === 'source' ? 'read' : 'write')
  else expect(SIDES).toContain(portId)
  expect(RESOURCE_KINDS[kind][role === 'source' ? 'sourceIds' : 'targetIds']).toContain(portId)
}

// Requirement 2 restated independently of LinkRules: may this id be used on this node in this role?
function endAllows(workspace: Workspace, diagram: Diagram, nodeId: string, portId: string, role: 'source' | 'target'): boolean {
  const component = diagram.component(nodeId)
  if (component) return (role === 'source' ? component.details.outputs : component.details.inputs).some((p) => p.id === portId)
  const placement = diagram.placement(nodeId)
  if (!placement) return false
  const kind = workspace.resources.get(placement.resourceId)!.kind
  if (kind === 'database') return portId === (role === 'source' ? 'read' : 'write')
  return SIDES.includes(portId)
}

describe('Rejected Links', () => {
  // Feature: resource-nodes, Property 5: Invalid Links are rejected without change
  // **Validates: Requirements 2.5**
  it('addLink throws a DomainError for a self link, a foreign end or a wrong-role id, and changes nothing', () => {
    let rejected = 0
    let rejectedPlacementEnd = 0
    fc.assert(
      fc.property(workspaceArb, fc.array(fc.tuple(pick, pick, pick, pick, pick, pick), { maxLength: 30 }), ({ workspace }, attempts) => {
        const diagrams = allDiagrams(workspace)
        for (const [di, a, b, pa, pb, ownerPick] of attempts) {
          const diagram = diagrams[di % diagrams.length]
          // Ends may come from any Diagram, so foreign ends are exercised.
          const owners = diagrams.filter((d) => d.components.length + d.placements.length > 0)
          if (owners.length === 0) continue
          const pickNode = (n: number, owner: Diagram) => [...owner.components, ...owner.placements][n % (owner.components.length + owner.placements.length)]
          const sourceOwner = ownerPick % 3 === 0 ? owners[a % owners.length] : diagram.components.length + diagram.placements.length > 0 ? diagram : owners[0]
          const targetOwner = ownerPick % 5 === 0 ? owners[b % owners.length] : sourceOwner
          const source = pickNode(a, sourceOwner)
          const target = pickNode(b, targetOwner)
          const sIds = candidateIds(sourceOwner, source.id)
          const tIds = candidateIds(targetOwner, target.id)
          const sourcePortId = sIds[pa % sIds.length]
          const targetPortId = tIds[pb % tIds.length]

          const valid =
            source.id !== target.id &&
            endAllows(workspace, diagram, source.id, sourcePortId, 'source') &&
            endAllows(workspace, diagram, target.id, targetPortId, 'target')
          if (valid) {
            diagram.addLink(source.id, target.id, sourcePortId, targetPortId)
            continue
          }

          const before = workspace.capture()
          const version = workspace.getVersion()
          expect(() => diagram.addLink(source.id, target.id, sourcePortId, targetPortId)).toThrow(DomainError)
          expect(workspace.capture()).toBe(before)
          expect(workspace.getVersion()).toBe(version)
          rejected++
          if (diagram.placement(source.id) || diagram.placement(target.id)) rejectedPlacementEnd++
        }
      }),
    )
    // Guards against a generator that never reaches the interesting cases.
    expect(rejected).toBeGreaterThan(0)
    expect(rejectedPlacementEnd).toBeGreaterThan(0)
  })
})

describe('Accepted Links', () => {
  // Feature: resource-nodes, Property 4: Accepted Links have the right end ids
  // **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
  it('every Link addLink accepts, and every Link already stored, has a role-correct string id on each end', () => {
    let accepted = 0
    let placementEnds = 0
    fc.assert(
      fc.property(workspaceArb, fc.array(fc.tuple(pick, pick, pick, pick, pick), { maxLength: 30 }), ({ workspace }, attempts) => {
        const diagrams = allDiagrams(workspace)
        for (const [di, a, b, pa, pb] of attempts) {
          const diagram = diagrams[di % diagrams.length]
          const nodes = [...diagram.components, ...diagram.placements]
          if (nodes.length === 0) continue
          const source = nodes[a % nodes.length]
          const target = nodes[b % nodes.length]
          const sIds = candidateIds(diagram, source.id)
          const tIds = candidateIds(diagram, target.id)
          const sourcePortId = sIds[pa % sIds.length]
          const targetPortId = tIds[pb % tIds.length]
          let link
          try {
            link = diagram.addLink(source.id, target.id, sourcePortId, targetPortId)
          } catch (e) {
            // A rejection is Property 5's concern; only a typed domain error is acceptable here.
            expect(e).toBeInstanceOf(DomainError)
            continue
          }
          accepted++
          if (diagram.placement(source.id) || diagram.placement(target.id)) placementEnds++
          expect([link.sourcePortId, link.targetPortId]).toEqual([sourcePortId, targetPortId])
        }
        for (const diagram of diagrams) {
          for (const link of diagram.links) {
            assertEndId(workspace, diagram, link.sourceId, link.sourcePortId, 'source')
            assertEndId(workspace, diagram, link.targetId, link.targetPortId, 'target')
          }
        }
      }),
    )
    // Guards against a generator that never reaches the interesting cases.
    expect(accepted).toBeGreaterThan(0)
    expect(placementEnds).toBeGreaterThan(0)
  })
})
