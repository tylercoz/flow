import type { DataType } from '../domain/DataType'
import type { DetailsDto, Port } from '../domain/Details'
import type { EnvironmentVariable } from '../domain/EnvironmentVariable'
import type { ExceptionType } from '../domain/ExceptionType'
import { checkLink, type EndShape } from '../domain/LinkRules'
import { isResourceKind, RESOURCE_KINDS, type ResourceKind } from '../domain/ResourceKinds'
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
    if (obj.schemaVersion !== 8) {
      throw new PersistenceError(`Unsupported schemaVersion: ${String(obj.schemaVersion)}`)
    }
    const types = asArray(obj.types, 'types').map((t, i) => parseType(t, `types[${i}]`))
    const exceptions = asArray(obj.exceptions, 'exceptions').map((e, i) => parseType(e, `exceptions[${i}]`))
    const environmentVariables = asArray(obj.environmentVariables, 'environmentVariables').map((v, i) =>
      parseType(v, `environmentVariables[${i}]`),
    )
    const typeIds = new Set(types.map((t) => t.id))
    const resources = asArray(obj.resources, 'resources').map((r, i) => parseResource(r, `resources[${i}]`, typeIds))
    const root = parseDiagram(obj.root, 'root', new Map(resources.map((r) => [r.id, r.kind])))
    assertTypesExist(root, typeIds)
    assertExceptionsExist(root, new Set(exceptions.map((e) => e.id)))
    assertEnvironmentVariablesExist(root, new Set(environmentVariables.map((v) => v.id)))
    return { schemaVersion: 8, types, exceptions, environmentVariables, resources, root }
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
function assertTypesExist(d: DiagramDto, typeIds: ReadonlySet<string>): void {
  const check = ({ details }: { details: DetailsDto }) => {
    for (const p of [...details.inputs, ...details.outputs]) {
      if (p.typeId !== null && !typeIds.has(p.typeId)) throw new PersistenceError(`Port uses unknown type ${p.typeId}`)
    }
  }
  d.links.forEach(check)
  d.components.forEach((c) => {
    check(c)
    assertTypesExist(c.diagram, typeIds)
  })
}
// Same reasoning as for types: a dangling exception id could never be shown or fixed.
function assertExceptionsExist(d: DiagramDto, exceptionIds: ReadonlySet<string>): void {
  d.components.forEach((c) => {
    const missing = c.exceptionIds.find((id) => !exceptionIds.has(id))
    if (missing !== undefined) throw new PersistenceError(`Component uses unknown exception ${missing}`)
    assertExceptionsExist(c.diagram, exceptionIds)
  })
}
// Same reasoning again: a dangling environment variable id could never be shown or fixed.
function assertEnvironmentVariablesExist(d: DiagramDto, variableIds: ReadonlySet<string>): void {
  d.components.forEach((c) => {
    const missing = c.environmentVariableIds.find((id) => !variableIds.has(id))
    if (missing !== undefined) throw new PersistenceError(`Component uses unknown environment variable ${missing}`)
    assertEnvironmentVariablesExist(c.diagram, variableIds)
  })
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

function parseResource(v: unknown, path: string, typeIds: ReadonlySet<string>): ResourceDto {
  const o = asObject(v, path)
  const kind = o.kind
  if (!isResourceKind(kind)) throw malformed(`${path}.kind`)
  const typeId = o.typeId === null ? null : asString(o.typeId, `${path}.typeId`)
  // Same rule as the Resource constructor: only typed kinds carry a Data Type.
  if (RESOURCE_KINDS[kind].typed !== (typeId !== null)) throw new PersistenceError(`Resource ${String(o.id)} has an invalid type for kind ${kind}`)
  if (typeId !== null && !typeIds.has(typeId)) throw new PersistenceError(`Resource uses unknown type ${typeId}`)
  return { id: asString(o.id, `${path}.id`), kind, name: asString(o.name, `${path}.name`), typeId }
}

function parsePlacement(v: unknown, path: string, resources: ReadonlyMap<string, ResourceKind>): PlacementDto {
  const o = asObject(v, path)
  const pos = asObject(o.position, `${path}.position`)
  const size = o.size === undefined ? undefined : asObject(o.size, `${path}.size`)
  const resourceId = asString(o.resourceId, `${path}.resourceId`)
  if (!resources.has(resourceId)) throw new PersistenceError(`Placement uses unknown resource ${resourceId}`)
  return {
    id: asString(o.id, `${path}.id`),
    resourceId,
    position: { x: asNumber(pos.x, `${path}.position.x`), y: asNumber(pos.y, `${path}.position.y`) },
    ...(size && { size: { width: asNumber(size.width, `${path}.size.width`), height: asNumber(size.height, `${path}.size.height`) } }),
  }
}

function parseDiagram(v: unknown, path: string, resources: ReadonlyMap<string, ResourceKind>): DiagramDto {
  const o = asObject(v, path)
  const vp = asObject(o.viewport, `${path}.viewport`)
  const components = asArray(o.components, `${path}.components`).map((c, i) =>
    parseComponent(c, `${path}.components[${i}]`, resources),
  )
  const placements = asArray(o.placements, `${path}.placements`).map((p, i) =>
    parsePlacement(p, `${path}.placements[${i}]`, resources),
  )
  const links = asArray(o.links, `${path}.links`).map((l, i) => parseLink(l, `${path}.links[${i}]`))
  // Components and Placements share one id namespace per Diagram, so Link ends can name either.
  const ends = new Map<string, EndShape>()
  for (const c of components) {
    ends.set(c.id, { kind: 'component', inputIds: c.details.inputs.map((p) => p.id), outputIds: c.details.outputs.map((p) => p.id) })
  }
  for (const p of placements) {
    if (ends.has(p.id)) throw new PersistenceError(`Duplicate node id ${p.id}`)
    ends.set(p.id, { kind: 'placement', resource: resources.get(p.resourceId)! })
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
    components,
    placements,
    links,
  }
}

function parseComponent(v: unknown, path: string, resources: ReadonlyMap<string, ResourceKind>): ComponentDto {
  const o = asObject(v, path)
  const pos = asObject(o.position, `${path}.position`)
  const size = o.size === undefined ? undefined : asObject(o.size, `${path}.size`)
  return {
    id: asString(o.id, `${path}.id`),
    details: parseDetails(o.details, `${path}.details`),
    position: { x: asNumber(pos.x, `${path}.position.x`), y: asNumber(pos.y, `${path}.position.y`) },
    ...(size && { size: { width: asNumber(size.width, `${path}.size.width`), height: asNumber(size.height, `${path}.size.height`) } }),
    exceptionIds: asArray(o.exceptionIds, `${path}.exceptionIds`).map((id, i) => asString(id, `${path}.exceptionIds[${i}]`)),
    environmentVariableIds: asArray(o.environmentVariableIds, `${path}.environmentVariableIds`).map((id, i) =>
      asString(id, `${path}.environmentVariableIds[${i}]`),
    ),
    diagram: parseDiagram(o.diagram, `${path}.diagram`, resources),
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
