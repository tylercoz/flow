import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { workspaceArb } from '../domain/testing/workspaceArbitrary'
import { PersistenceError } from './PersistenceError'
import { WorkspaceSerializer } from './WorkspaceSerializer'

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const viewport = { x: 0, y: 0, zoom: 1 }
const placement = (id: string, resourceId: string) => ({ id, resourceId, position: { x: 0, y: 0 } })

// Ids carry a `bad-` prefix so they cannot collide with ids from generated workspaces.
function componentResource(id: string, placements: unknown[] = [], links: unknown[] = []) {
  return {
    id,
    kind: 'component',
    name: id,
    typeId: null,
    component: {
      inputs: [{ id: 'in', name: 'in', typeId: null }],
      outputs: [{ id: 'out', name: 'out', typeId: null }],
      portNodes: [{ id: 'in-node', portId: 'in', position: null }, { id: 'out-node', portId: 'out', position: null }],
      notes: '',
      exceptionIds: [],
      environmentVariableIds: [],
      diagram: { id: `${id}-diagram`, viewport, placements, links },
    },
  }
}

function reject(raw: Json): PersistenceError {
  try {
    new WorkspaceSerializer().deserialize(raw)
  } catch (e) {
    expect(e).toBeInstanceOf(PersistenceError)
    return e as PersistenceError
  }
  throw new Error('deserialize accepted a corrupt snapshot')
}

const snapshotArb = workspaceArb.map(({ workspace }) => JSON.parse(JSON.stringify(workspace.toSnapshot())) as Json)

describe('Feature: components-as-resources, Property 11: Corrupt snapshots are rejected', () => {
  // **Validates: Requirements 8.2**
  it('rejects any schemaVersion other than 13', () => {
    fc.assert(
      fc.property(snapshotArb, fc.integer().filter((v) => v !== 13), (raw, version) => {
        raw.schemaVersion = version
        reject(raw)
      }),
    )
  })

  // **Validates: Requirements 8.3**
  it('rejects a Placement of an unknown Resource, naming the Placement id', () => {
    fc.assert(
      fc.property(snapshotArb, (raw) => {
        raw.root.placements.push(placement('bad-placement', 'bad-no-such-resource'))
        expect(reject(raw).message).toContain('bad-placement')
      }),
    )
  })

  // **Validates: Requirements 8.4**
  it('rejects a Link to a port the Resource lacks, naming the Link id', () => {
    const endArb = fc.constantFrom<'sourcePortId' | 'targetPortId'>('sourcePortId', 'targetPortId')
    fc.assert(
      fc.property(snapshotArb, endArb, fc.string({ minLength: 1 }), (raw, end, junk) => {
        raw.resources.push(componentResource('bad-a'), componentResource('bad-b'))
        raw.root.placements.push(placement('bad-pa', 'bad-a'), placement('bad-pb', 'bad-b'))
        const link = { id: 'bad-link', name: '', sourceId: 'bad-pa', targetId: 'bad-pb', sourcePortId: 'out', targetPortId: 'in' }
        link[end] = `bad-missing-${junk}`
        raw.root.links.push(link)
        expect(reject(raw).message).toContain('bad-link')
      }),
    )
  })

  // **Validates: Requirements 8.5**
  it('rejects a ring of component Resources, naming one of them', () => {
    fc.assert(
      fc.property(snapshotArb, fc.integer({ min: 1, max: 4 }), (raw, size) => {
        const ids = Array.from({ length: size }, (_, i) => `bad-cycle-${i}`)
        // Each Resource's child Diagram places the next one; the last closes the ring.
        ids.forEach((id, i) => {
          raw.resources.push(componentResource(id, [placement(`bad-p-${i}`, ids[(i + 1) % size])]))
        })
        const message = reject(raw).message
        expect(ids.some((id) => message.includes(id))).toBe(true)
      }),
    )
  })
})
