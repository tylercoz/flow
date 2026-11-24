import type { DataType } from '../domain/DataType'
import type { EnvironmentVariable } from '../domain/EnvironmentVariable'
import type { ExceptionType } from '../domain/ExceptionType'
import { findCycle } from '../domain/DiagramGraph'
import { checkLink } from '../domain/LinkRules'
import { portNodeHandleIds, type Port, type PortRole } from '../domain/Port'
import { handleIds, isResourceKind, kindInvariantError } from '../domain/ResourceKinds'
import type { Workspace } from '../domain/Workspace'
import type { ComponentDto, DiagramDto, LinkDto, PlacementDto, PortPlacementDto, ProjectDto, ResourceDto, WorkspaceSnapshot } from '../domain/WorkspaceSnapshot'
import { PersistenceError } from './PersistenceError'

type Obj = Record<string, unknown>
// The handle ids a Resource offers on each Link end, resolved once per Resource.
type End = { source: readonly string[]; target: readonly string[] }

export class WorkspaceSerializer {
  serialize(workspace: Workspace): WorkspaceSnapshot {
    return workspace.toSnapshot()
  }

  // Validates and copies only known fields, so stored extras never reach the domain.
  deserialize(raw: unknown): WorkspaceSnapshot {
    const obj = asObject(raw, 'workspace')
    // No migrations while in development: data from any other version is rejected and must be cleared.
    if (obj.schemaVersion !== 15) {
      throw new PersistenceError(`Unsupported schemaVersion: ${String(obj.schemaVersion)}`)
    }
    const types = asArray(obj.types, 'types').map((t, i) => parseType(t, `types[${i}]`))
    const exceptions = asArray(obj.exceptions, 'exceptions').map((e, i) => parseType(e, `exceptions[${i}]`))
    const environmentVariables = asArray(obj.environmentVariables, 'environmentVariables').map((v, i) =>
      parseType(v, `environmentVariables[${i}]`),
    )
    const typeIds = new Set(types.map((t) => t.id))
    // First pass: Diagrams may place Resources defined later in the list, so shapes come before any Diagram.
    const headers = asArray(obj.resources, 'resources').map((r, i) => parseHeader(r, `resources[${i}]`, typeIds))
    const shapes = new Map<string, End>()
    for (const h of headers) {
      if (shapes.has(h.id)) throw new PersistenceError(`Duplicate resource id ${h.id}`)
      const ports = h.component
      shapes.set(h.id, { source: handleIds(h.kind, ports, 'source'), target: handleIds(h.kind, ports, 'target') })
    }
    const resources: ResourceDto[] = headers.map((h) => ({
      id: h.id,
      kind: h.kind,
      name: h.name,
      typeId: h.typeId,
      ...(h.remote !== undefined && { remote: h.remote }),
      ...(h.format !== undefined && { format: h.format }),
      component: h.component && {
        inputs: h.component.inputs,
        outputs: h.component.outputs,
        portNodes: h.component.portNodes,
        notes: h.component.notes,
        exceptionIds: h.component.exceptionIds,
        environmentVariableIds: h.component.environmentVariableIds,
        diagram: parseDiagram(h.component.rawDiagram, `resources[${h.id}].diagram`, shapes, portEnds(h.component)),
      },
    }))
    // The root belongs to no component, so no port id is a node there.
    const diagrams = asArray(obj.diagrams, 'diagrams').map((d, i) => {
      const o = asObject(d, `diagrams[${i}]`)
      return { name: asString(o.name, `diagrams[${i}].name`), diagram: parseDiagram(o.diagram, `diagrams[${i}].diagram`, shapes, new Map()) }
    })
    if (diagrams.length === 0) throw new PersistenceError('A project needs at least one diagram')
    const diagramIds = new Set<string>()
    for (const { diagram } of diagrams) {
      if (diagramIds.has(diagram.id)) throw new PersistenceError(`Duplicate diagram id ${diagram.id}`)
      diagramIds.add(diagram.id)
    }
    assertNoCycle(diagrams.map((d) => d.diagram), resources)
    assertTypesExist(resources, typeIds)
    assertExceptionsExist(resources, new Set(exceptions.map((e) => e.id)))
    assertEnvironmentVariablesExist(resources, new Set(environmentVariables.map((v) => v.id)))
    return { schemaVersion: 15, project: parseProject(obj.project), types, exceptions, environmentVariables, resources, diagrams }
  }
}

function malformed(path: string): PersistenceError {
  return new PersistenceError(`Malformed workspace data at ${path}`)
}

function asObject(v: unknown, path: string): Obj {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw malformed(path)
  return v as Obj
}

function asArray(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) throw malformed(path)
  return v
}

function asString(v: unknown, path: string): string {
  if (typeof v !== 'string') throw malformed(path)
  return v
}

function asNumber(v: unknown, path: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw malformed(path)
  return v
}

// DataType, ExceptionType and EnvironmentVariable have the same shape.
function parseType(v: unknown, path: string): DataType & ExceptionType & EnvironmentVariable {
  const o = asObject(v, path)
  return { id: asString(o.id, `${path}.id`), name: asString(o.name, `${path}.name`) }
}
function parseProject(v: unknown): ProjectDto {
  const o = asObject(v, 'project')
  return {
    name: asString(o.name, 'project.name'),
    description: asString(o.description, 'project.description'),
    createdAt: asString(o.createdAt, 'project.createdAt'),
    updatedAt: asString(o.updatedAt, 'project.updatedAt'),
  }
}
function parsePort(v: unknown, path: string): Port {
  const o = asObject(v, path)
  return {
    id: asString(o.id, `${path}.id`),
    name: asString(o.name, `${path}.name`),
    typeId: o.typeId === null ? null : asString(o.typeId, `${path}.typeId`),
    ...(asFlag(o.multiple, `${path}.multiple`) && { multiple: true }),
    ...(asFlag(o.optional, `${path}.optional`) && { optional: true }),
  }
}
// Absent means false, so older saves load.
function asFlag(v: unknown, path: string): boolean {
  if (v === undefined) return false
  if (typeof v !== 'boolean') throw malformed(path)
  return v
}
// A port naming a missing type could never be shown or fixed, so reject it at load.
function assertTypesExist(resources: readonly ResourceDto[], typeIds: ReadonlySet<string>): void {
  for (const { component } of resources) {
    for (const p of component ? [...component.inputs, ...component.outputs] : []) {
      if (p.typeId !== null && !typeIds.has(p.typeId)) throw new PersistenceError(`Port uses unknown type ${p.typeId}`)
    }
  }
}
// Same reasoning as for types: a dangling exception id could never be shown or fixed.
function assertExceptionsExist(resources: readonly ResourceDto[], exceptionIds: ReadonlySet<string>): void {
  for (const r of resources) {
    const missing = r.component?.exceptionIds.find((id) => !exceptionIds.has(id))
    if (missing !== undefined) throw new PersistenceError(`Component uses unknown exception ${missing}`)
  }
}
// Same reasoning again: a dangling environment variable id could never be shown or fixed.
function assertEnvironmentVariablesExist(resources: readonly ResourceDto[], variableIds: ReadonlySet<string>): void {
  for (const r of resources) {
    const missing = r.component?.environmentVariableIds.find((id) => !variableIds.has(id))
    if (missing !== undefined) throw new PersistenceError(`Component uses unknown environment variable ${missing}`)
  }
}
// A cycle of component Resources would make the model infinite, so reject it at load.
function assertNoCycle(roots: readonly DiagramDto[], resources: readonly ResourceDto[]): void {
  const childOf = new Map<string, string>()
  const ownerOf = new Map<string, string>()
  const diagrams = [...roots]
  for (const r of resources) {
    if (!r.component) continue
    childOf.set(r.id, r.component.diagram.id)
    ownerOf.set(r.component.diagram.id, r.id)
    diagrams.push(r.component.diagram)
  }
  const graph = new Map<string, string[]>()
  for (const d of diagrams) {
    const edges = d.placements.flatMap((p) => childOf.get(p.resourceId) ?? [])
    graph.set(d.id, [...(graph.get(d.id) ?? []), ...edges])
  }
  const onCycle = findCycle(graph)
  if (onCycle !== undefined) {
    throw new PersistenceError(`Component ${ownerOf.get(onCycle) ?? onCycle} contains itself`)
  }
}
function parsePorts(o: Obj, key: string, path: string): Port[] {
  return asArray(o[key], `${path}.${key}`).map((p, i) => parsePort(p, `${path}.${key}[${i}]`))
}

// A Resource with its child Diagram still unparsed, which needs every Resource's shape first.
type ResourceHeader = Omit<ResourceDto, 'component'> & {
  component: (Omit<ComponentDto, 'diagram'> & { rawDiagram: unknown }) | null
}

function parseHeader(v: unknown, path: string, typeIds: ReadonlySet<string>): ResourceHeader {
  const o = asObject(v, path)
  const kind = o.kind
  if (!isResourceKind(kind)) throw malformed(`${path}.kind`)
  const typeId = o.typeId === null ? null : asString(o.typeId, `${path}.typeId`)
  const id = asString(o.id, `${path}.id`)
  // Same rule as the Resource constructor, so stored data cannot hold a Resource the domain would refuse.
  const invalid = kindInvariantError(kind, typeId, o.component !== null)
  if (invalid) throw new PersistenceError(`Resource ${id}: ${invalid}`)
  if (typeId !== null && !typeIds.has(typeId)) throw new PersistenceError(`Resource uses unknown type ${typeId}`)
  // A remote on any other kind would be silently dropped on load, so refuse it.
  if (o.remote !== undefined && kind !== 'repository') throw new PersistenceError(`Resource ${id}: A ${kind} resource cannot have a remote.`)
  const remote = o.remote === undefined ? undefined : asString(o.remote, `${path}.remote`)
  if (o.format !== undefined && kind !== 'artifact') throw new PersistenceError(`Resource ${id}: A ${kind} resource cannot have a format.`)
  const format = o.format === undefined ? undefined : asString(o.format, `${path}.format`)
  let component: ResourceHeader['component'] = null
  if (o.component !== null) {
    const c = asObject(o.component, `${path}.component`)
    component = {
      inputs: parsePorts(c, 'inputs', `${path}.component`),
      outputs: parsePorts(c, 'outputs', `${path}.component`),
      portNodes: parsePortNodes(c, `${path}.component`),
      notes: asString(c.notes, `${path}.component.notes`),
      exceptionIds: asArray(c.exceptionIds, `${path}.component.exceptionIds`).map((e, i) => asString(e, `${path}.component.exceptionIds[${i}]`)),
      environmentVariableIds: parseEnvironmentVariableIds(c, `${path}.component`),
      rawDiagram: c.diagram,
    }
  }
  return { id, kind, name: asString(o.name, `${path}.name`), typeId, ...(remote !== undefined && { remote }), ...(format !== undefined && { format }), component }
}

function parsePlacement(v: unknown, path: string, shapes: ReadonlyMap<string, End>): PlacementDto {
  const o = asObject(v, path)
  const pos = asObject(o.position, `${path}.position`)
  const size = o.size === undefined ? undefined : asObject(o.size, `${path}.size`)
  const resourceId = asString(o.resourceId, `${path}.resourceId`)
  const id = asString(o.id, `${path}.id`)
  if (!shapes.has(resourceId)) throw new PersistenceError(`Placement ${id} uses unknown resource ${resourceId}`)
  return {
    id,
    resourceId,
    position: { x: asNumber(pos.x, `${path}.position.x`), y: asNumber(pos.y, `${path}.position.y`) },
    ...(size && { size: { width: asNumber(size.width, `${path}.size.width`), height: asNumber(size.height, `${path}.size.height`) } }),
  }
}

function parseEnvironmentVariableIds(c: Obj, path: string): string[] {
  return asArray(c.environmentVariableIds, `${path}.environmentVariableIds`).map((e, i) => asString(e, `${path}.environmentVariableIds[${i}]`))
}
// A node for a port the component lacks could never be shown or removed, and a port with no node could never be
// linked or have one added by copying, so both are rejected at load.
function parsePortNodes(c: Obj, path: string): PortPlacementDto[] {
  // An environment variable is a port too, so it needs a node and can have no more than the component's own.
  const ports = new Set([...parsePorts(c, 'inputs', path), ...parsePorts(c, 'outputs', path)].map((p) => p.id).concat(parseEnvironmentVariableIds(c, path)))
  const seen = new Set<string>()
  const nodes = asArray(c.portNodes, `${path}.portNodes`).map((v, i): PortPlacementDto => {
    const at = `${path}.portNodes[${i}]`
    const o = asObject(v, at)
    const id = asString(o.id, `${at}.id`)
    const portId = asString(o.portId, `${at}.portId`)
    if (seen.has(id)) throw new PersistenceError(`Duplicate node id ${id}`)
    seen.add(id)
    if (!ports.has(portId)) throw new PersistenceError(`Port node ${id} shows unknown port ${portId}`)
    if (o.position === null) return { id, portId, position: null }
    const p = asObject(o.position, `${at}.position`)
    return { id, portId, position: { x: asNumber(p.x, `${at}.position.x`), y: asNumber(p.y, `${at}.position.y`) } }
  })
  const shown = new Set(nodes.map((n) => n.portId))
  for (const id of ports) if (!shown.has(id)) throw new PersistenceError(`Port ${id} has no node`)
  return nodes
}
// Each Port_Node of a component is a node on its child Diagram, with the handles of its port's role.
function portEnds(c: Pick<ComponentDto, 'inputs' | 'outputs' | 'portNodes' | 'environmentVariableIds'>): Map<string, End> {
  const inputs = new Set(c.inputs.map((p) => p.id))
  const variables = new Set(c.environmentVariableIds)
  const end = (role: PortRole): End => ({ source: portNodeHandleIds(role, 'source'), target: portNodeHandleIds(role, 'target') })
  const roleOf = (portId: string): PortRole => (inputs.has(portId) ? 'input' : variables.has(portId) ? 'environment' : 'output')
  return new Map(c.portNodes.map((n) => [n.id, end(roleOf(n.portId))] as const))
}
function parseDiagram(v: unknown, path: string, shapes: ReadonlyMap<string, End>, ports: ReadonlyMap<string, End>): DiagramDto {
  const o = asObject(v, path)
  const vp = asObject(o.viewport, `${path}.viewport`)
  const placements = asArray(o.placements, `${path}.placements`).map((p, i) =>
    parsePlacement(p, `${path}.placements[${i}]`, shapes),
  )
  const links = asArray(o.links, `${path}.links`).map((l, i) => parseLink(l, `${path}.links[${i}]`))
  // Link ends are Placement ids, resolved to the shape of the Resource each Placement references, or port ids of the owning component.
  const ends = new Map<string, End>(ports)
  for (const p of placements) {
    if (ends.has(p.id)) throw new PersistenceError(`Duplicate node id ${p.id}`)
    ends.set(p.id, shapes.get(p.resourceId)!)
  }
  for (const link of links) {
    // Both endpoints must be in this same Diagram, matching the domain's addLink rule.
    const source = ends.get(link.sourceId)
    const target = ends.get(link.targetId)
    if (!source || !target) throw new PersistenceError(`Link ${link.id} has an endpoint outside its diagram`)
    // Same rule as the domain's addLink, so a stored Link can never point at a missing port.
    const failure = checkLink(source.source, link.sourcePortId, target.target, link.targetPortId)
    if (failure) throw new PersistenceError(`Link ${link.id}: ${failure.message}`)
  }
  return {
    id: asString(o.id, `${path}.id`),
    viewport: {
      x: asNumber(vp.x, `${path}.viewport.x`),
      y: asNumber(vp.y, `${path}.viewport.y`),
      zoom: asNumber(vp.zoom, `${path}.viewport.zoom`),
    },
    placements,
    links,
  }
}

function parseLink(v: unknown, path: string): LinkDto {
  const o = asObject(v, path)
  return {
    id: asString(o.id, `${path}.id`),
    name: asString(o.name, `${path}.name`),
    sourceId: asString(o.sourceId, `${path}.sourceId`),
    targetId: asString(o.targetId, `${path}.targetId`),
    sourcePortId: asString(o.sourcePortId, `${path}.sourcePortId`),
    targetPortId: asString(o.targetPortId, `${path}.targetPortId`),
    ...(o.waypoints !== undefined && {
      waypoints: asArray(o.waypoints, `${path}.waypoints`).map((w, i) => {
        const p = asObject(w, `${path}.waypoints[${i}]`)
        return { x: asNumber(p.x, `${path}.waypoints[${i}].x`), y: asNumber(p.y, `${path}.waypoints[${i}].y`) }
      }),
    }),
  }
}
