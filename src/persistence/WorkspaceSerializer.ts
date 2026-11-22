import type { DataType } from '../domain/DataType'
import type { DetailsDto, Port } from '../domain/Details'
import type { EnvironmentVariable } from '../domain/EnvironmentVariable'
import type { ExceptionType } from '../domain/ExceptionType'
import { findCycle } from '../domain/DiagramGraph'
import { checkLink, type EndShape } from '../domain/LinkRules'
import { isResourceKind, RESOURCE_KINDS } from '../domain/ResourceKinds'
import type { Workspace } from '../domain/Workspace'
import type { ComponentDto, DiagramDto, LinkDto, PlacementDto, ResourceDto, WorkspaceSnapshot } from '../domain/WorkspaceSnapshot'
import { PersistenceError } from './PersistenceError'

type Obj = Record<string, unknown>

export class WorkspaceSerializer {
  serialize(workspace: Workspace): WorkspaceSnapshot {
    return workspace.toSnapshot()
  }

  // Validates and copies only known fields, so stored extras never reach the domain.
  deserialize(raw: unknown): WorkspaceSnapshot {
    const obj = asObject(raw, 'workspace')
    // No migrations while in development: data from any other version is rejected and must be cleared.
    if (obj.schemaVersion !== 9) {
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
    const shapes = new Map<string, EndShape>()
    for (const h of headers) {
      if (shapes.has(h.id)) throw new PersistenceError(`Duplicate resource id ${h.id}`)
      shapes.set(h.id, endShape(h))
    }
    const resources: ResourceDto[] = headers.map((h) => ({
      id: h.id,
      kind: h.kind,
      name: h.name,
      typeId: h.typeId,
      component: h.component && {
        details: h.component.details,
        exceptionIds: h.component.exceptionIds,
        environmentVariableIds: h.component.environmentVariableIds,
        diagram: parseDiagram(h.component.rawDiagram, `resources[${h.id}].diagram`, shapes),
      },
    }))
    const root = parseDiagram(obj.root, 'root', shapes)
    assertNoCycle(root, resources)
    const diagrams = [root, ...resources.flatMap((r) => (r.component ? [r.component.diagram] : []))]
    assertTypesExist(resources, diagrams, typeIds)
    assertExceptionsExist(resources, new Set(exceptions.map((e) => e.id)))
    assertEnvironmentVariablesExist(resources, new Set(environmentVariables.map((v) => v.id)))
    return { schemaVersion: 9, types, exceptions, environmentVariables, resources, root }
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
function parsePort(v: unknown, path: string): Port {
  const o = asObject(v, path)
  return { id: asString(o.id, `${path}.id`), name: asString(o.name, `${path}.name`), typeId: o.typeId === null ? null : asString(o.typeId, `${path}.typeId`) }
}
// A port naming a missing type could never be shown or fixed, so reject it at load.
function assertTypesExist(resources: readonly ResourceDto[], diagrams: readonly DiagramDto[], typeIds: ReadonlySet<string>): void {
  const check = ({ details }: { details: DetailsDto }) => {
    for (const p of [...details.inputs, ...details.outputs]) {
      if (p.typeId !== null && !typeIds.has(p.typeId)) throw new PersistenceError(`Port uses unknown type ${p.typeId}`)
    }
  }
  diagrams.forEach((d) => d.links.forEach(check))
  resources.forEach((r) => r.component && check(r.component))
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
function assertNoCycle(root: DiagramDto, resources: readonly ResourceDto[]): void {
  const childOf = new Map<string, string>()
  const ownerOf = new Map<string, string>()
  const diagrams = [root]
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
function parseDetails(v: unknown, path: string) {
  const o = asObject(v, path)
  return {
    name: asString(o.name, `${path}.name`),
    inputs: parsePorts(o, 'inputs', path),
    outputs: parsePorts(o, 'outputs', path),
    notes: asString(o.notes, `${path}.notes`),
  }
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
  // Same rule as the Resource constructor: only typed kinds carry a Data Type.
  if (RESOURCE_KINDS[kind].typed !== (typeId !== null)) throw new PersistenceError(`Resource ${String(o.id)} has an invalid type for kind ${kind}`)
  if (typeId !== null && !typeIds.has(typeId)) throw new PersistenceError(`Resource uses unknown type ${typeId}`)
  const id = asString(o.id, `${path}.id`)
  // Same rule as the Resource constructor: a definition exists exactly for the component kind.
  if ((kind === 'component') !== (o.component !== null)) throw new PersistenceError(`Resource ${id} has an invalid component for kind ${kind}`)
  let component: ResourceHeader['component'] = null
  if (o.component !== null) {
    const c = asObject(o.component, `${path}.component`)
    component = {
      details: parseDetails(c.details, `${path}.component.details`),
      exceptionIds: asArray(c.exceptionIds, `${path}.component.exceptionIds`).map((e, i) => asString(e, `${path}.component.exceptionIds[${i}]`)),
      environmentVariableIds: asArray(c.environmentVariableIds, `${path}.component.environmentVariableIds`).map((e, i) =>
        asString(e, `${path}.component.environmentVariableIds[${i}]`),
      ),
      rawDiagram: c.diagram,
    }
  }
  // A component's name lives in its details, so the two cannot disagree.
  const name = component ? component.details.name : asString(o.name, `${path}.name`)
  return { id, kind, name, typeId, component }
}

function endShape(h: ResourceHeader): EndShape {
  if (!h.component) return { kind: 'placement', resource: h.kind }
  return {
    kind: 'component',
    inputIds: h.component.details.inputs.map((p) => p.id),
    outputIds: h.component.details.outputs.map((p) => p.id),
  }
}

function parsePlacement(v: unknown, path: string, shapes: ReadonlyMap<string, EndShape>): PlacementDto {
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

function parseDiagram(v: unknown, path: string, shapes: ReadonlyMap<string, EndShape>): DiagramDto {
  const o = asObject(v, path)
  const vp = asObject(o.viewport, `${path}.viewport`)
  const placements = asArray(o.placements, `${path}.placements`).map((p, i) =>
    parsePlacement(p, `${path}.placements[${i}]`, shapes),
  )
  const links = asArray(o.links, `${path}.links`).map((l, i) => parseLink(l, `${path}.links[${i}]`))
  // Link ends are Placement ids, resolved to the shape of the Resource each Placement references.
  const ends = new Map<string, EndShape>()
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
    const failure = checkLink(source, link.sourcePortId, target, link.targetPortId)
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
    details: parseDetails(o.details, `${path}.details`),
    sourceId: asString(o.sourceId, `${path}.sourceId`),
    targetId: asString(o.targetId, `${path}.targetId`),
    sourcePortId: asString(o.sourcePortId, `${path}.sourcePortId`),
    targetPortId: asString(o.targetPortId, `${path}.targetPortId`),
  }
}
