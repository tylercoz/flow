import fc from 'fast-check'
import type { Position, Size } from '../NodeBounds'
import type { Placement } from '../Placement'
import { portNodeHandleIds, type Port } from '../Port'
import { RESOURCE_KINDS, type ResourceKind } from '../ResourceKinds'
import type { IdGenerator } from '../IdGenerator'
import type { Viewport } from '../Viewport'
import { Workspace } from '../Workspace'

// Test-support only: imported by property tests, never by production code.

// Deterministic ids keep failing counterexamples reproducible and shrinkable.
export class CounterIds implements IdGenerator {
  private n = 0
  next(): string {
    return `id-${this.n++}`
  }
}

// Quarter-step numbers are exact in JSON, so serialization round trips never hit -0, NaN or float drift.
const coordinate = fc.integer({ min: -4000, max: 4000 }).map((n) => n / 4)
export const positionArb = fc.record({ x: coordinate, y: coordinate })
export const viewportArb: fc.Arbitrary<Viewport> = fc.record({
  x: coordinate,
  y: coordinate,
  zoom: fc.integer({ min: 1, max: 400 }).map((n) => n / 100),
})
// Generated workspaces have no ids to point at, so ports are untyped here; type references are covered by unit tests.
// Inputs and outputs get different id prefixes: a port id names one node on its component's Level, so no id is both.
const portArb = (prefix: string) =>
  fc.record({ id: fc.nat({ max: 20 }).map((n) => `${prefix}${n}`), name: fc.string(), typeId: fc.constant(null) })
export type ComponentPatch = { inputs?: Port[]; outputs?: Port[]; notes?: string }
export const componentPatchArb: fc.Arbitrary<ComponentPatch> = fc.record(
  { inputs: fc.array(portArb('i')), outputs: fc.array(portArb('o')), notes: fc.string() },
  { requiredKeys: [] },
)

// Picks are raw numbers resolved modulo the live workspace, so every command is valid for any workspace shape
// and shrinking a sequence never invalidates the remaining commands.
const pick = fc.nat({ max: 1000 })

export type Command =
  | { kind: 'addComponent'; diagram: number; position: { x: number; y: number } }
  | { kind: 'addLink'; diagram: number; source: number; target: number; sourcePort: number; targetPort: number }
  | { kind: 'addPortLink'; diagram: number; source: number; target: number; sourceHandle: number; targetHandle: number }
  | { kind: 'movePortNode'; component: number; port: number; position: Position }
  | { kind: 'duplicatePortNode'; component: number; port: number; position: Position }
  | { kind: 'removePortNode'; component: number; port: number }
  | { kind: 'removeLink'; diagram: number; link: number }
  | { kind: 'patchComponent'; component: number; patch: ComponentPatch }
  | { kind: 'patchLink'; diagram: number; link: number; name: string }
  | { kind: 'setViewport'; diagram: number; viewport: Viewport }
  | { kind: 'addException'; name: string }
  | { kind: 'toggleException'; component: number; exception: number }
  | { kind: 'removeException'; exception: number }
  | { kind: 'addEnvironmentVariable'; name: string }
  | { kind: 'toggleEnvironmentVariable'; component: number; variable: number }
  | { kind: 'removeEnvironmentVariable'; variable: number }
  | { kind: 'addResource'; resourceKind: ResourceKind; name: string; type: number; diagram: number; position: Position }
  | { kind: 'addPlacement'; diagram: number; resource: number; position: Position }
  | { kind: 'removePlacement'; diagram: number; placement: number }
  | { kind: 'movePlacement'; diagram: number; placement: number; position: Position; size?: Size }
  | { kind: 'renameResource'; resource: number; name: string }
  | { kind: 'retypeResource'; resource: number; type: number }
  | { kind: 'removeResource'; resource: number }

const resourceKindArb = fc.constantFrom<ResourceKind>(...(Object.keys(RESOURCE_KINDS) as ResourceKind[]))
const sizeArb: fc.Arbitrary<Size> = fc.record({ width: fc.integer({ min: 1, max: 1000 }), height: fc.integer({ min: 1, max: 1000 }) })

// Weighted toward additions so sequences build shared, nested, non-trivial workspaces.
export const commandArb: fc.Arbitrary<Command> = fc.oneof(
  { arbitrary: fc.record({ kind: fc.constant('addComponent' as const), diagram: pick, position: positionArb }), weight: 5 },
  { arbitrary: fc.record({ kind: fc.constant('addLink' as const), diagram: pick, source: pick, target: pick, sourcePort: pick, targetPort: pick }), weight: 3 },
  { arbitrary: fc.record({ kind: fc.constant('addPortLink' as const), diagram: pick, source: pick, target: pick, sourceHandle: pick, targetHandle: pick }), weight: 3 },
  { arbitrary: fc.record({ kind: fc.constant('movePortNode' as const), component: pick, port: pick, position: positionArb }), weight: 2 },
  { arbitrary: fc.record({ kind: fc.constant('duplicatePortNode' as const), component: pick, port: pick, position: positionArb }), weight: 2 },
  { arbitrary: fc.record({ kind: fc.constant('removePortNode' as const), component: pick, port: pick }), weight: 1 },
  { arbitrary: fc.record({ kind: fc.constant('removeLink' as const), diagram: pick, link: pick }), weight: 1 },
  { arbitrary: fc.record({ kind: fc.constant('patchComponent' as const), component: pick, patch: componentPatchArb }), weight: 2 },
  { arbitrary: fc.record({ kind: fc.constant('patchLink' as const), diagram: pick, link: pick, name: fc.string() }), weight: 1 },
  { arbitrary: fc.record({ kind: fc.constant('setViewport' as const), diagram: pick, viewport: viewportArb }), weight: 2 },
  { arbitrary: fc.record({ kind: fc.constant('addException' as const), name: fc.string() }), weight: 2 },
  { arbitrary: fc.record({ kind: fc.constant('toggleException' as const), component: pick, exception: pick }), weight: 3 },
  { arbitrary: fc.record({ kind: fc.constant('removeException' as const), exception: pick }), weight: 1 },
  { arbitrary: fc.record({ kind: fc.constant('addEnvironmentVariable' as const), name: fc.string() }), weight: 2 },
  { arbitrary: fc.record({ kind: fc.constant('toggleEnvironmentVariable' as const), component: pick, variable: pick }), weight: 3 },
  { arbitrary: fc.record({ kind: fc.constant('removeEnvironmentVariable' as const), variable: pick }), weight: 1 },
  { arbitrary: fc.record({ kind: fc.constant('addResource' as const), resourceKind: resourceKindArb, name: fc.string(), type: pick, diagram: pick, position: positionArb }), weight: 3 },
  { arbitrary: fc.record({ kind: fc.constant('addPlacement' as const), diagram: pick, resource: pick, position: positionArb }), weight: 3 },
  { arbitrary: fc.record({ kind: fc.constant('removePlacement' as const), diagram: pick, placement: pick }), weight: 1 },
  { arbitrary: fc.record({ kind: fc.constant('movePlacement' as const), diagram: pick, placement: pick, position: positionArb, size: sizeArb }, { requiredKeys: ['kind', 'diagram', 'placement', 'position'] }), weight: 2 },
  { arbitrary: fc.record({ kind: fc.constant('renameResource' as const), resource: pick, name: fc.string() }), weight: 1 },
  { arbitrary: fc.record({ kind: fc.constant('retypeResource' as const), resource: pick, type: pick }), weight: 1 },
  { arbitrary: fc.record({ kind: fc.constant('removeResource' as const), resource: pick }), weight: 1 },
)

export const commandsArb = fc.array(commandArb, { maxLength: 40 })

const at = <T>(items: readonly T[], i: number): T | undefined => (items.length ? items[i % items.length] : undefined)

// Port or handle ids a Placement offers as the source or target end of a Link.
export function handleIds(workspace: Workspace, placement: Placement, role: 'source' | 'target'): readonly string[] {
  const resource = workspace.resources.get(placement.resourceId)
  if (!resource) return []
  return resource.handleIds(role)
}

// Commands that have no valid target (empty diagram, self-link pick) are skipped, not errors.
export function applyCommand(workspace: Workspace, cmd: Command): void {
  // Workspace-level commands have no target diagram.
  if (cmd.kind === 'addException') {
    workspace.addException(cmd.name)
    return
  }
  if (cmd.kind === 'removeException') {
    const e = at(workspace.exceptions, cmd.exception)
    if (e) workspace.removeException(e.id)
    return
  }
  if (cmd.kind === 'addEnvironmentVariable') {
    workspace.addEnvironmentVariable(cmd.name)
    return
  }
  if (cmd.kind === 'removeEnvironmentVariable') {
    const v = at(workspace.environmentVariables, cmd.variable)
    if (v) workspace.removeEnvironmentVariable(v.id)
    return
  }
  if (cmd.kind === 'renameResource') {
    at(workspace.resources.all, cmd.resource)?.setName(cmd.name)
    return
  }
  if (cmd.kind === 'retypeResource') {
    const r = at(workspace.resources.all.filter((r) => RESOURCE_KINDS[r.kind].typed), cmd.resource)
    const t = at(workspace.types, cmd.type)
    if (r && t) workspace.setResourceType(r.id, t.id)
    return
  }
  if (cmd.kind === 'removeResource') {
    const r = at(workspace.resources.all, cmd.resource)
    if (r) workspace.removeResource(r.id)
    return
  }
  const components = workspace.componentResources()
  switch (cmd.kind) {
    case 'patchComponent': {
      const c = at(components, cmd.component)?.definition
      if (!c) return
      // Port lists go through Workspace.setPorts so Links on removed ports are dropped in every Diagram, as in the
      // app. A command must be one change notification (History records one step per notification).
      const { inputs, outputs, ...rest } = cmd.patch
      if (inputs) workspace.setPorts(at(components, cmd.component)!.id, 'inputs', inputs)
      else if (outputs) workspace.setPorts(at(components, cmd.component)!.id, 'outputs', outputs)
      else if (rest.notes !== undefined) c.setNotes(rest.notes)
      return
    }
    case 'movePortNode': {
      const c = at(components, cmd.component)?.definition
      const node = c && at(c.portPlacements, cmd.port)
      if (c && node) c.setPortPlacementPosition(node.id, cmd.position)
      return
    }
    case 'duplicatePortNode': {
      const c = at(components, cmd.component)?.definition
      const node = c && at(c.portPlacements, cmd.port)
      if (c && node) c.addPortPlacements([{ portId: node.portId, position: cmd.position }])
      return
    }
    case 'removePortNode': {
      const c = at(components, cmd.component)?.definition
      const node = c && at(c.portPlacements, cmd.port)
      // A port's last node cannot go; that refusal is tested on its own, so here the command is skipped.
      if (c && node && c.portPlacements.some((n) => n.portId === node.portId && n.id !== node.id)) c.removePortPlacements([node.id])
      return
    }
    case 'toggleEnvironmentVariable': {
      const c = at(components, cmd.component)?.definition
      const v = at(workspace.environmentVariables, cmd.variable)
      if (!c || !v) return
      c.setEnvironmentVariables(
        c.environmentVariableIds.includes(v.id) ? c.environmentVariableIds.filter((id) => id !== v.id) : [...c.environmentVariableIds, v.id],
      )
      return
    }
    case 'toggleException': {
      const c = at(components, cmd.component)?.definition
      const e = at(workspace.exceptions, cmd.exception)
      if (!c || !e) return
      c.setExceptions(c.exceptionIds.includes(e.id) ? c.exceptionIds.filter((id) => id !== e.id) : [...c.exceptionIds, e.id])
      return
    }
  }
  const diagrams = workspace.allDiagrams()
  const d = diagrams[cmd.diagram % diagrams.length]
  switch (cmd.kind) {
    case 'addResource': {
      const typed = RESOURCE_KINDS[cmd.resourceKind].typed
      const t = at(workspace.types, cmd.type)
      if (typed && !t) return
      workspace.createPlacedResource(d, { kind: cmd.resourceKind, name: cmd.name, typeId: typed ? t?.id : undefined }, cmd.position)
      return
    }
    case 'addPlacement': {
      const r = at(workspace.resources.all, cmd.resource)
      // Skipped, not an error: the generated workspace stays acyclic.
      if (r && !workspace.wouldCreateCycle(d, r.id)) d.addPlacement(r.id, cmd.position)
      return
    }
    case 'removePlacement': {
      const p = at(d.placements, cmd.placement)
      if (p) d.removePlacement(p.id)
      return
    }
    case 'movePlacement': {
      const p = at(d.placements, cmd.placement)
      if (!p) return
      if (cmd.size) p.setBounds(cmd.position, cmd.size)
      else p.setPosition(cmd.position)
      return
    }
    case 'addComponent':
      workspace.createPlacedResource(d, { kind: 'component', name: '' }, cmd.position)
      return
    case 'addLink': {
      const source = at(d.placements, cmd.source)
      const target = at(d.placements, cmd.target)
      if (!source || !target || source === target) return
      const out = at(handleIds(workspace, source, 'source'), cmd.sourcePort)
      const inn = at(handleIds(workspace, target, 'target'), cmd.targetPort)
      if (out && inn) d.addLink(source.id, target.id, out, inn)
      return
    }
    case 'addPortLink': {
      // Only a component's own Level has port nodes; the root is skipped.
      const owner = components.find((c) => c.definition?.diagram === d)?.definition
      if (!owner) return
      const nodes = [...owner.portPlacements.map((n) => n.id), ...d.placements.map((p) => p.id)]
      const handlesOf = (id: string, role: 'source' | 'target') => {
        const placement = d.placement(id)
        if (placement) return handleIds(workspace, placement, role)
        const portRole = owner.portRole(id)
        return portRole ? portNodeHandleIds(portRole, role) : []
      }
      const source = at(nodes, cmd.source)
      const target = at(nodes, cmd.target)
      if (source === undefined || target === undefined || source === target) return
      const out = at(handlesOf(source, 'source'), cmd.sourceHandle)
      const inn = at(handlesOf(target, 'target'), cmd.targetHandle)
      if (out && inn) d.addLink(source, target, out, inn)
      return
    }
    case 'removeLink': {
      const l = at(d.links, cmd.link)
      if (l) d.removeLink(l.id)
      return
    }
    case 'patchLink':
      at(d.links, cmd.link)?.setName(cmd.name)
      return
    case 'setViewport':
      d.setViewport(cmd.viewport)
      return
  }
}

export function buildWorkspace(commands: readonly Command[], ids: IdGenerator = new CounterIds()): Workspace {
  const workspace = Workspace.empty(ids)
  commands.forEach((cmd) => applyCommand(workspace, cmd))
  return workspace
}

// Generated workspace plus the id source it used, so tests can keep adding content with fresh ids.
export const workspaceArb: fc.Arbitrary<{ workspace: Workspace; ids: IdGenerator }> = commandsArb.map((commands) => {
  const ids = new CounterIds()
  return { workspace: buildWorkspace(commands, ids), ids }
})
