import fc from 'fast-check'
import type { Component } from '../Component'
import type { DetailsDto } from '../Details'
import type { Diagram } from '../Diagram'
import type { IdGenerator } from '../IdGenerator'
import { SIDES, type Side } from '../Link'
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
const portArb = fc.record({ name: fc.string(), typeId: fc.constant(null) })
export const detailsPatchArb: fc.Arbitrary<Partial<DetailsDto>> = fc.record(
  { name: fc.string(), inputs: fc.array(portArb), outputs: fc.array(portArb), notes: fc.string() },
  { requiredKeys: [] },
)

// Picks are raw numbers resolved modulo the live tree, so every command is valid for any workspace shape
// and shrinking a sequence never invalidates the remaining commands.
const pick = fc.nat({ max: 1000 })
const sideArb = fc.constantFrom(...SIDES)

export type Command =
  | { kind: 'addComponent'; diagram: number; position: { x: number; y: number } }
  | { kind: 'addLink'; diagram: number; source: number; target: number; sourceSide: Side; targetSide: Side }
  | { kind: 'removeComponent'; diagram: number; component: number }
  | { kind: 'removeLink'; diagram: number; link: number }
  | { kind: 'patchComponent'; diagram: number; component: number; patch: Partial<DetailsDto> }
  | { kind: 'patchLink'; diagram: number; link: number; patch: Partial<DetailsDto> }
  | { kind: 'setViewport'; diagram: number; viewport: Viewport }

// Weighted toward additions so sequences build nested, non-trivial trees.
export const commandArb: fc.Arbitrary<Command> = fc.oneof(
  { arbitrary: fc.record({ kind: fc.constant('addComponent' as const), diagram: pick, position: positionArb }), weight: 5 },
  { arbitrary: fc.record({ kind: fc.constant('addLink' as const), diagram: pick, source: pick, target: pick, sourceSide: sideArb, targetSide: sideArb }), weight: 3 },
  { arbitrary: fc.record({ kind: fc.constant('removeComponent' as const), diagram: pick, component: pick }), weight: 1 },
  { arbitrary: fc.record({ kind: fc.constant('removeLink' as const), diagram: pick, link: pick }), weight: 1 },
  { arbitrary: fc.record({ kind: fc.constant('patchComponent' as const), diagram: pick, component: pick, patch: detailsPatchArb }), weight: 2 },
  { arbitrary: fc.record({ kind: fc.constant('patchLink' as const), diagram: pick, link: pick, patch: detailsPatchArb }), weight: 1 },
  { arbitrary: fc.record({ kind: fc.constant('setViewport' as const), diagram: pick, viewport: viewportArb }), weight: 2 },
)

export const commandsArb = fc.array(commandArb, { maxLength: 40 })

// Depth-first, root first.
export function allDiagrams(workspace: Workspace): Diagram[] {
  const out: Diagram[] = []
  const visit = (d: Diagram): void => {
    out.push(d)
    d.components.forEach((c) => visit(c.diagram))
  }
  visit(workspace.root)
  return out
}

export function allComponents(workspace: Workspace): Component[] {
  return allDiagrams(workspace).flatMap((d) => [...d.components])
}

const at = <T>(items: readonly T[], i: number): T | undefined => (items.length ? items[i % items.length] : undefined)

// Commands that have no valid target (empty diagram, self-link pick) are skipped, not errors.
export function applyCommand(workspace: Workspace, cmd: Command): void {
  const diagrams = allDiagrams(workspace)
  const d = diagrams[cmd.diagram % diagrams.length]
  switch (cmd.kind) {
    case 'addComponent':
      d.addComponent(cmd.position)
      return
    case 'addLink': {
      const source = at(d.components, cmd.source)
      const target = at(d.components, cmd.target)
      if (source && target && source !== target) d.addLink(source.id, target.id, cmd.sourceSide, cmd.targetSide)
      return
    }
    case 'removeComponent': {
      const c = at(d.components, cmd.component)
      if (c) d.removeComponent(c.id)
      return
    }
    case 'removeLink': {
      const l = at(d.links, cmd.link)
      if (l) d.removeLink(l.id)
      return
    }
    case 'patchComponent':
      at(d.components, cmd.component)?.details.patch(cmd.patch)
      return
    case 'patchLink':
      at(d.links, cmd.link)?.details.patch(cmd.patch)
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
