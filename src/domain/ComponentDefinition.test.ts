import { describe, expect, it } from 'vitest'
import { DomainError } from './DomainError'
import { Workspace } from './Workspace'

// One component with inputs a and b and output c, plus a database inside it.
function setup() {
  let n = 0
  const ws = Workspace.empty({ next: () => `id${++n}` })
  const placed = ws.createPlacedResource(ws.root, { kind: 'component', name: 'C' }, { x: 0, y: 0 })
  ws.setPorts(placed.resourceId, 'inputs', [{ name: 'a', typeId: null }, { name: 'b', typeId: null }])
  ws.setPorts(placed.resourceId, 'outputs', [{ name: 'c', typeId: null }])
  const def = ws.resources.get(placed.resourceId)!.definition!
  const inner = ws.createPlacedResource(def.diagram, { kind: 'database', name: 'D' }, { x: 0, y: 0 })
  const nodeOf = (portId: string) => def.portPlacements.filter((p) => p.portId === portId)
  return { ws, placed, def, inner, nodeOf }
}
const code = (fn: () => unknown) => {
  try {
    fn()
  } catch (e) {
    return (e as DomainError).code
  }
  return 'none'
}

describe('ComponentDefinition port nodes', () => {
  it('gives each new port one node with no stored position, in the same change as the port', () => {
    const { ws, placed, def } = setup()
    expect(def.portPlacements.map((p) => p.position)).toEqual([null, null, null])
    const before = ws.getVersion()
    ws.setPorts(placed.resourceId, 'inputs', [...def.inputs, { name: 'd', typeId: null }])
    expect(ws.getVersion()).toBe(before + 1)
    expect(def.portPlacements).toHaveLength(4)
  })

  it('adds nodes for the same port in one change, with their own ids and no Links', () => {
    const { ws, def, nodeOf } = setup()
    const a = def.inputs[0]
    const before = ws.getVersion()
    const added = def.addPortPlacements([
      { portId: a.id, position: { x: 1, y: 2 } },
      { portId: a.id, position: { x: 3, y: 4 } },
    ])
    expect(ws.getVersion()).toBe(before + 1)
    expect(nodeOf(a.id)).toHaveLength(3)
    expect(new Set(added.map((p) => p.id)).size).toBe(2)
    expect(def.diagram.links).toHaveLength(0)
    expect(def.portOf(added[0].id)).toEqual(a)
    expect(def.portRole(added[0].id)).toBe('input')
  })

  it('refuses a node for an unknown port', () => {
    const { ws, def } = setup()
    const before = ws.capture()
    expect(code(() => def.addPortPlacements([{ portId: 'ghost', position: { x: 0, y: 0 } }]))).toBe('INVALID_PORT')
    expect(ws.capture()).toBe(before)
  })

  it('removes a copy with its Links and keeps the other nodes and Links', () => {
    const { def, inner, nodeOf } = setup()
    const a = def.inputs[0]
    const [first] = nodeOf(a.id)
    const [copy] = def.addPortPlacements([{ portId: a.id, position: { x: 1, y: 2 } }])
    def.diagram.addLink(first.id, inner.id, 'top', 'top')
    def.diagram.addLink(copy.id, inner.id, 'top', 'top')
    def.removePortPlacements([copy.id])
    expect(nodeOf(a.id).map((p) => p.id)).toEqual([first.id])
    expect(def.diagram.links.map((l) => l.sourceId)).toEqual([first.id])
  })

  it('refuses to remove the last node of a port and changes nothing, even when another node in the batch could go', () => {
    const { ws, def, nodeOf } = setup()
    const a = def.inputs[0]
    const [copy] = def.addPortPlacements([{ portId: a.id, position: { x: 1, y: 2 } }])
    const [onlyB] = nodeOf(def.inputs[1].id)
    const before = ws.capture()
    expect(code(() => def.removePortPlacements([copy.id, onlyB.id]))).toBe('LAST_PORT_NODE')
    expect(ws.capture()).toBe(before)
    // Removing every node of one port is refused too.
    expect(code(() => def.removePortPlacements(nodeOf(a.id).map((p) => p.id)))).toBe('LAST_PORT_NODE')
    expect(ws.capture()).toBe(before)
  })

  it('refuses an unknown node id', () => {
    const { ws, def } = setup()
    const before = ws.capture()
    expect(code(() => def.removePortPlacements(['ghost']))).toBe('NOT_IN_DIAGRAM')
    expect(code(() => def.setPortPlacementPosition('ghost', { x: 0, y: 0 }))).toBe('NOT_IN_DIAGRAM')
    expect(ws.capture()).toBe(before)
  })

  it('links every node of one port to different inner nodes and removes the port with all its nodes and Links', () => {
    const { ws, placed, def, inner, nodeOf } = setup()
    const a = def.inputs[0]
    const other = ws.createPlacedResource(def.diagram, { kind: 'database', name: 'E' }, { x: 5, y: 5 })
    const [first] = nodeOf(a.id)
    const [copy] = def.addPortPlacements([{ portId: a.id, position: { x: 1, y: 2 } }])
    def.diagram.addLink(first.id, inner.id, 'top', 'top')
    def.diagram.addLink(copy.id, other.id, 'top', 'top')
    const before = ws.getVersion()
    ws.setPorts(placed.resourceId, 'inputs', [def.inputs[1]])
    expect(ws.getVersion()).toBe(before + 1)
    expect(def.diagram.links).toHaveLength(0)
    expect(nodeOf(a.id)).toHaveLength(0)
  })
  it('shows each environment variable as a node that can start a Link but not end one', () => {
    const { ws, def, inner } = setup()
    const v = ws.addEnvironmentVariable('DATABASE_URL')
    def.setEnvironmentVariables([v.id])
    const node = def.portPlacements.find((n) => n.portId === v.id)!
    expect(def.portRole(node.id)).toBe('environment')
    expect(code(() => def.diagram.addLink(node.id, inner.id, 'top', 'top'))).toBe('none')
    expect(code(() => def.diagram.addLink(inner.id, node.id, 'top', 'top'))).toBe('INVALID_PORT')
  })
  it('removes the node and its Links when the variable is unassigned or deleted', () => {
    const { ws, def, inner } = setup()
    const v = ws.addEnvironmentVariable('DATABASE_URL')
    def.setEnvironmentVariables([v.id])
    const node = def.portPlacements.find((n) => n.portId === v.id)!
    def.diagram.addLink(node.id, inner.id, 'top', 'top')
    ws.removeEnvironmentVariable(v.id)
    expect(def.portPlacements.some((n) => n.portId === v.id)).toBe(false)
    expect(def.diagram.links).toHaveLength(0)
  })
})
