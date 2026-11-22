import { describe, expect, it } from 'vitest'
import type { Fragment } from './WorkspaceSnapshot'
import { withFreshIds } from './WorkspaceSnapshotMapper'

describe('withFreshIds', () => {
  it('renames placements and links, rewires link ends, and keeps resource and port ids', () => {
    let n = 0
    const ids = { next: () => `new${++n}` }
    const fragment: Fragment = {
      placements: [
        { id: 'p1', resourceId: 'r1', position: { x: 0, y: 0 } },
        { id: 'p2', resourceId: 'r2', position: { x: 1, y: 1 } },
      ],
      links: [{ id: 'l1', name: '', sourceId: 'p1', targetId: 'p2', sourcePortId: 'o', targetPortId: 'i' }],
    }

    const fresh = withFreshIds(fragment, ids)

    const [a, b] = fresh.placements
    expect([a.id, b.id]).toEqual(['new1', 'new2'])
    expect([a.resourceId, b.resourceId]).toEqual(['r1', 'r2'])
    expect(fresh.links[0]).toMatchObject({ id: 'new3', sourceId: 'new1', targetId: 'new2', sourcePortId: 'o', targetPortId: 'i' })
  })
})
