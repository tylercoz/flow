import type { DataType } from '../domain/DataType'
import type { DetailsDto, Port } from '../domain/Details'
import type { ExceptionType } from '../domain/ExceptionType'
import type { Workspace } from '../domain/Workspace'
import type { ComponentDto, DiagramDto, LinkDto, WorkspaceSnapshot } from '../domain/WorkspaceSnapshot'
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
    if (obj.schemaVersion !== 6) {
      throw new PersistenceError(`Unsupported schemaVersion: ${String(obj.schemaVersion)}`)
    }
    const types = asArray(obj.types, 'types').map((t, i) => parseType(t, `types[${i}]`))
    const exceptions = asArray(obj.exceptions, 'exceptions').map((e, i) => parseType(e, `exceptions[${i}]`))
    const root = parseDiagram(obj.root, 'root')
    assertTypesExist(root, new Set(types.map((t) => t.id)))
    assertExceptionsExist(root, new Set(exceptions.map((e) => e.id)))
    return { schemaVersion: 6, types, exceptions, root }
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

// DataType and ExceptionType have the same shape.
function parseType(v: unknown, path: string): DataType & ExceptionType {
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

function parseDiagram(v: unknown, path: string): DiagramDto {
  const o = asObject(v, path)
  const vp = asObject(o.viewport, `${path}.viewport`)
  const components = asArray(o.components, `${path}.components`).map((c, i) =>
    parseComponent(c, `${path}.components[${i}]`),
  )
  const componentIds = new Set(components.map((c) => c.id))
  const links = asArray(o.links, `${path}.links`).map((l, i) => parseLink(l, `${path}.links[${i}]`))
  for (const link of links) {
    // Both endpoints must be in this same Diagram, matching the domain's addLink rule.
    if (!componentIds.has(link.sourceId) || !componentIds.has(link.targetId)) {
      throw new PersistenceError(`Link ${link.id} has an endpoint outside its diagram`)
    }
    // Matches the domain's addLink rule, so a stored Link can never point at a missing port.
    const source = components.find((c) => c.id === link.sourceId)
    const target = components.find((c) => c.id === link.targetId)
    if (!source?.details.outputs.some((p) => p.id === link.sourcePortId) || !target?.details.inputs.some((p) => p.id === link.targetPortId)) {
      throw new PersistenceError(`Link ${link.id} has an endpoint that is not an output and an input`)
    }
  }
  return {
    id: asString(o.id, `${path}.id`),
    viewport: {
      x: asNumber(vp.x, `${path}.viewport.x`),
      y: asNumber(vp.y, `${path}.viewport.y`),
      zoom: asNumber(vp.zoom, `${path}.viewport.zoom`),
    },
    components,
    links,
  }
}

function parseComponent(v: unknown, path: string): ComponentDto {
  const o = asObject(v, path)
  const pos = asObject(o.position, `${path}.position`)
  const size = o.size === undefined ? undefined : asObject(o.size, `${path}.size`)
  return {
    id: asString(o.id, `${path}.id`),
    details: parseDetails(o.details, `${path}.details`),
    position: { x: asNumber(pos.x, `${path}.position.x`), y: asNumber(pos.y, `${path}.position.y`) },
    ...(size && { size: { width: asNumber(size.width, `${path}.size.width`), height: asNumber(size.height, `${path}.size.height`) } }),
    exceptionIds: asArray(o.exceptionIds, `${path}.exceptionIds`).map((id, i) => asString(id, `${path}.exceptionIds[${i}]`)),
    diagram: parseDiagram(o.diagram, `${path}.diagram`),
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
