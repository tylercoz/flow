import type { Diagram } from '../domain/Diagram'
import type { Workspace } from '../domain/Workspace'
import type { ComponentDto, DiagramDto, LinkDto, WorkspaceSnapshot } from '../domain/WorkspaceSnapshot'
import { PersistenceError } from './PersistenceError'

type Obj = Record<string, unknown>

export class WorkspaceSerializer {
  serialize(workspace: Workspace): WorkspaceSnapshot {
    return { schemaVersion: 1, root: diagramToDto(workspace.root) }
  }

  // Validates and copies only known fields, so stored extras never reach the domain.
  deserialize(raw: unknown): WorkspaceSnapshot {
    const obj = asObject(raw, 'workspace')
    if (obj.schemaVersion !== 1) {
      throw new PersistenceError(`Unsupported schemaVersion: ${String(obj.schemaVersion)}`)
    }
    return { schemaVersion: 1, root: parseDiagram(obj.root, 'root') }
  }
}

function diagramToDto(d: Diagram): DiagramDto {
  return {
    id: d.id,
    viewport: { x: d.viewport.x, y: d.viewport.y, zoom: d.viewport.zoom },
    components: d.components.map((c) => ({
      id: c.id,
      details: c.details.toJSON(),
      position: { x: c.position.x, y: c.position.y },
      diagram: diagramToDto(c.diagram),
    })),
    links: d.links.map((l) => ({
      id: l.id,
      details: l.details.toJSON(),
      sourceId: l.sourceId,
      targetId: l.targetId,
    })),
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

function parseDetails(v: unknown, path: string) {
  const o = asObject(v, path)
  return {
    name: asString(o.name, `${path}.name`),
    description: asString(o.description, `${path}.description`),
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
  return {
    id: asString(o.id, `${path}.id`),
    details: parseDetails(o.details, `${path}.details`),
    position: { x: asNumber(pos.x, `${path}.position.x`), y: asNumber(pos.y, `${path}.position.y`) },
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
  }
}
