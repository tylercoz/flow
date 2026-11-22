import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { DomainError } from './DomainError'
import { RESOURCE_KINDS, type ResourceKind } from './ResourceKinds'
import { Workspace } from './Workspace'
import type { WorkspaceSnapshot } from './WorkspaceSnapshot'
import { buildWorkspace, CounterIds, commandsArb, positionArb } from './testing/workspaceArbitrary'

const kindArb = fc.constantFrom<ResourceKind>(...(Object.keys(RESOURCE_KINDS) as ResourceKind[]))

describe('resources properties', () => {
  // Feature: resource-nodes, Property 1: Resource creation respects the type rule
  // **Validates: Requirements 1.2, 3.4, 3.5**
  it('creation succeeds for a typed kind only with a catalog type, and untyped kinds never get one', () => {
    fc.assert(
      fc.property(
        kindArb,
        fc.array(fc.string(), { maxLength: 4 }),
        // null means no type chosen; a number picks from the catalog modulo its size.
        fc.option(fc.nat({ max: 100 }), { nil: null }),
        fc.string(),
        positionArb,
        (kind, typeNames, choice, name, position) => {
          const workspace = Workspace.empty(new CounterIds())
          // Defaults are unused, so they can be removed to reach an empty catalog.
          workspace.types.slice().forEach((t) => workspace.removeType(t.id))
          typeNames.forEach((n) => workspace.addType(n))
          const typeId = choice === null || workspace.types.length === 0 ? undefined : workspace.types[choice % workspace.types.length].id
          const typed = RESOURCE_KINDS[kind].typed
          const before = workspace.capture()
          const versionBefore = workspace.getVersion()

          let created = null
          let error: unknown = null
          try {
            created = workspace.createPlacedResource(workspace.root, { kind, name, typeId }, position)
          } catch (e) {
            error = e
          }

          const expectSuccess = !typed || typeId !== undefined
          if (!expectSuccess) {
            expect(error).toBeInstanceOf(DomainError)
            expect(workspace.capture()).toBe(before)
            expect(workspace.getVersion()).toBe(versionBefore)
            return
          }
          expect(error).toBeNull()
          const resource = workspace.resources.get(created!.resourceId)!
          expect(resource.kind).toBe(kind)
          if (typed) {
            expect(resource.typeId).toBe(typeId)
            expect(workspace.types.some((t) => t.id === resource.typeId)).toBe(true)
          } else {
            expect(resource.typeId).toBeNull()
          }
          expect(workspace.root.placements.map((p) => p.id)).toContain(created!.id)
        },
      ),
      { numRuns: 100 },
    )
  })

  // Feature: resource-nodes, Property 2: Resource edits reach every Placement
  // **Validates: Requirements 1.5, 4.3**
  it('a rename or retype changes only that Resource entry, and Placements still reference it', () => {
    fc.assert(
      fc.property(
        commandsArb,
        fc.nat({ max: 1000 }),
        fc.nat({ max: 1000 }),
        fc.string(),
        fc.boolean(),
        (commands, resourcePick, typePick, newName, retype) => {
          const workspace = buildWorkspace(commands)
          const resources = workspace.resources.all
          if (resources.length === 0) return
          const resource = resources[resourcePick % resources.length]
          const before = JSON.parse(workspace.capture()) as WorkspaceSnapshot

          const expected = before.resources.map((r) => ({ ...r }))
          const entry = expected.find((r) => r.id === resource.id)!
          // Untyped kinds and empty catalogs cannot be retyped, so they fall back to a rename.
          if (retype && RESOURCE_KINDS[resource.kind].typed && workspace.types.length > 0) {
            const type = workspace.types[typePick % workspace.types.length]
            workspace.setResourceType(resource.id, type.id)
            entry.typeId = type.id
          } else {
            resource.setName(newName)
            entry.name = newName
          }

          const after = JSON.parse(workspace.capture()) as WorkspaceSnapshot
          expect(after).toEqual({ ...before, resources: expected })
          const placements = workspace.allDiagrams().flatMap((d) => d.placements.filter((p) => p.resourceId === resource.id))
          placements.forEach((p) => expect(workspace.resources.get(p.resourceId)).toBe(resource))
        },
      ),
      { numRuns: 100 },
    )
  })

  // Feature: components-as-resources, Property 1: Resource edits are visible through every Placement
  // **Validates: Requirements 1.4**
  it('an edit to a component Resource changes only its snapshot entry, and every Placement of it sees the edit', () => {
    const editArb = fc.constantFrom('name', 'notes', 'inputs', 'outputs', 'exception', 'variable')
    fc.assert(
      fc.property(
        commandsArb,
        fc.nat({ max: 1000 }),
        fc.array(fc.nat({ max: 1000 }), { minLength: 1, maxLength: 3 }),
        editArb,
        fc.string(),
        (commands, resourcePick, diagramPicks, edit, text) => {
          const workspace = buildWorkspace(commands)
          const components = workspace.componentResources()
          if (components.length === 0) return
          const resource = components[resourcePick % components.length]
          const definition = resource.definition!

          // Several Placements of one Resource, wherever a cycle would not result.
          // The root is never inside a component, so it always accepts one; the Resource may have been unplaced.
          workspace.root.addPlacement(resource.id, { x: 0, y: 0 })
          const diagrams = workspace.allDiagrams()
          diagramPicks.forEach((pick, i) => {
            const target = diagrams[pick % diagrams.length]
            if (!workspace.wouldCreateCycle(target, resource.id)) target.addPlacement(resource.id, { x: i, y: i })
          })
          // Catalog entries are created before the snapshot so the edit itself is the only change.
          const exception = workspace.addException('e')
          const variable = workspace.addEnvironmentVariable('v')

          const before = JSON.parse(workspace.capture()) as WorkspaceSnapshot
          const portsBefore = { inputs: definition.inputs, outputs: definition.outputs }

          // Ports are only appended, because removal also prunes Links elsewhere (covered by the port-removal property).
          if (edit === 'name') resource.setName(text)
          else if (edit === 'notes') definition.setNotes(text)
          else if (edit === 'inputs' || edit === 'outputs') {
            workspace.setPorts(resource.id, edit, [...portsBefore[edit], { name: text, typeId: null }])
          } else if (edit === 'exception') definition.setExceptions([...definition.exceptionIds, exception.id])
          else definition.setEnvironmentVariables([...definition.environmentVariableIds, variable.id])

          const after = JSON.parse(workspace.capture()) as WorkspaceSnapshot
          const others = (s: WorkspaceSnapshot) => ({ ...s, resources: s.resources.filter((r) => r.id !== resource.id) })
          expect(others(after)).toEqual(others(before))

          const entry = after.resources.find((r) => r.id === resource.id)!.component!
          const entryBefore = before.resources.find((r) => r.id === resource.id)!.component!
          if (edit === 'name') expect(after.resources.find((r) => r.id === resource.id)!.name).toBe(text)
          if (edit === 'notes') expect(entry.notes).toBe(text)
          if (edit === 'inputs' || edit === 'outputs') {
            expect(entry[edit]).toHaveLength(entryBefore[edit].length + 1)
            expect(entry[edit].slice(0, -1)).toEqual(entryBefore[edit])
          }
          if (edit === 'exception') expect(entry.exceptionIds).toEqual([...entryBefore.exceptionIds, exception.id])
          if (edit === 'variable') expect(entry.environmentVariableIds).toEqual([...entryBefore.environmentVariableIds, variable.id])

          // Every Placement resolves to the one live Resource, so the edit is visible through each of them.
          const placed = workspace.allDiagrams().flatMap((d) => d.placements.filter((p) => p.resourceId === resource.id).map((p) => ({ d, p })))
          expect(placed.length).toBeGreaterThan(0)
          placed.forEach(({ d, p }) => {
            const seen = d.resourceOf(p.id)
            expect(seen).toBe(resource)
            const live = seen!.definition!
            expect({ inputs: live.inputs, outputs: live.outputs, notes: live.notes }).toEqual({ inputs: entry.inputs, outputs: entry.outputs, notes: entry.notes })
          })
        },
      ),
      { numRuns: 100 },
    )
  })

  // Feature: resource-nodes, Property 3: Placement bounds are kept
  // **Validates: Requirements 1.4**
  it('setPosition or setBounds changes only that Placement in the snapshot', () => {
    // Quarter steps stay exact through JSON.
    const dimension = fc.integer({ min: 1, max: 4000 }).map((n) => n / 4)
    fc.assert(
      fc.property(
        commandsArb,
        fc.nat({ max: 1000 }),
        positionArb,
        fc.option(fc.record({ width: dimension, height: dimension }), { nil: undefined }),
        (commands, pick, position, size) => {
          const workspace = buildWorkspace(commands)
          const placements = workspace.allDiagrams().flatMap((d) => [...d.placements])
          if (placements.length === 0) return
          const placement = placements[pick % placements.length]
          const before = JSON.parse(workspace.capture()) as WorkspaceSnapshot

          // Without a size only the position moves, and any stored size stays.
          if (size) placement.setBounds(position, size)
          else placement.setPosition(position)

          const expected = structuredClone(before)
          const dtos = [...expected.root.placements, ...expected.resources.flatMap((r) => r.component?.diagram.placements ?? [])]
          const dto = dtos.find((d) => d.id === placement.id)!
          dto.position = position
          if (size) dto.size = size

          expect(JSON.parse(workspace.capture())).toEqual(expected)
          expect(placement.position).toEqual(position)
          if (size) expect(placement.size).toEqual(size)
        },
      ),
      { numRuns: 100 },
    )
  })

  // Feature: resource-nodes, Property 6: Placement deletion keeps the Resource
  // **Validates: Requirements 5.1**
  it('removePlacement drops that Placement and its Links and keeps the Resource and everything else', () => {
    fc.assert(
      fc.property(commandsArb, fc.nat({ max: 1000 }), (commands, pick) => {
        const workspace = buildWorkspace(commands)
        const owned = workspace.allDiagrams().flatMap((d) => d.placements.map((p) => ({ diagram: d, placement: p })))
        if (owned.length === 0) return
        const { diagram, placement } = owned[pick % owned.length]

        const nodeIds = () => workspace.allDiagrams().flatMap((d) => d.placements.map((p) => p.id))
        const linkIds = () => workspace.allDiagrams().flatMap((d) => d.links.map((l) => l.id))
        const resourcesBefore = JSON.stringify(workspace.resources.all.map((r) => [r.id, r.kind, r.name, r.typeId]))
        const nodesBefore = nodeIds()
        const attached = diagram.links.filter((l) => l.sourceId === placement.id || l.targetId === placement.id).map((l) => l.id)
        const linksBefore = linkIds()

        diagram.removePlacement(placement.id)

        expect(workspace.resources.get(placement.resourceId)).toBeDefined()
        expect(JSON.stringify(workspace.resources.all.map((r) => [r.id, r.kind, r.name, r.typeId]))).toBe(resourcesBefore)
        expect(nodeIds()).toEqual(nodesBefore.filter((id) => id !== placement.id))
        expect(linkIds()).toEqual(linksBefore.filter((id) => !attached.includes(id)))
      }),
      { numRuns: 100 },
    )
  })

  // Feature: resource-nodes, Property 8: A Data Type in use cannot be removed
  // **Validates: Requirements 6.1, 6.2**
  it('removeType throws TYPE_IN_USE and keeps the type exactly when a component port or typed Resource references it', () => {
    const usageArb = fc.constantFrom('none', 'componentPort', 'resource')
    fc.assert(
      fc.property(commandsArb, fc.array(fc.tuple(usageArb, fc.nat({ max: 1000 })), { minLength: 1, maxLength: 4 }), (commands, usages) => {
        const workspace = buildWorkspace(commands)
        // The generated content is untyped, so references to fresh types are added here.
        usages.forEach(([usage, pick], i) => {
          const type = workspace.addType(`t${i}`)
          if (usage === 'componentPort') {
            const owners = workspace.componentResources()
            if (owners.length === 0) return
            const owner = owners[pick % owners.length]
            workspace.setPorts(owner.id, 'inputs', [...owner.definition!.inputs, { name: 'typed', typeId: type.id }])
          } else if (usage === 'resource') {
            const typed = workspace.resources.all.filter((r) => RESOURCE_KINDS[r.kind].typed)
            if (typed.length === 0) return
            workspace.setResourceType(typed[pick % typed.length].id, type.id)
          }
        })

        // Computed from the snapshot, independently of Workspace's own scan.
        const snapshot = JSON.parse(workspace.capture()) as WorkspaceSnapshot
        const referenced = new Set<string>()
        const ports = (d: { inputs: { typeId: string | null }[]; outputs: { typeId: string | null }[] }): void =>
          [...d.inputs, ...d.outputs].forEach((p) => p.typeId && referenced.add(p.typeId))
        snapshot.resources.forEach((r) => {
          if (r.typeId) referenced.add(r.typeId)
          if (!r.component) return
          ports(r.component)
        })

        workspace.types.slice().forEach((type) => {
          const versionBefore = workspace.getVersion()
          if (referenced.has(type.id)) {
            expect(() => workspace.removeType(type.id)).toThrow(expect.objectContaining({ code: 'TYPE_IN_USE' }))
            expect(workspace.types.some((t) => t.id === type.id)).toBe(true)
            expect(workspace.getVersion()).toBe(versionBefore)
          } else {
            workspace.removeType(type.id)
            expect(workspace.types.some((t) => t.id === type.id)).toBe(false)
          }
        })
      }),
      { numRuns: 100 },
    )
  })

  // Feature: resource-nodes, Property 9: Copy and paste reuse Resources
  // **Validates: Requirements 7.1, 7.2, 7.3**
  it('copy takes the selected nodes and their inner Links, and paste reuses Resources with fresh ids in one notification', () => {
    fc.assert(
      fc.property(
        commandsArb,
        fc.nat({ max: 1000 }),
        fc.array(fc.boolean(), { minLength: 1, maxLength: 40 }),
        positionArb,
        (commands, pick, mask, offset) => {
          const workspace = buildWorkspace(commands)
          const diagrams = workspace.allDiagrams()
          const diagram = diagrams[pick % diagrams.length]
          const selected = new Set(diagram.placements.filter((_, i) => mask[i % mask.length]).map((n) => n.id))
          const placements = diagram.placements.filter((p) => selected.has(p.id))
          const inner = diagram.links.filter((l) => selected.has(l.sourceId) && selected.has(l.targetId))

          const fragment = workspace.copy(diagram, selected)
          expect(fragment.placements.map((p) => p.id)).toEqual(placements.map((p) => p.id))
          expect(fragment.links.map((l) => l.id)).toEqual(inner.map((l) => l.id))

          const treeIds = () =>
            workspace.allDiagrams().flatMap((d) => [...d.placements.map((p) => p.id), ...d.links.map((l) => l.id)])
          const idsBefore = new Set(treeIds())
          const resourcesBefore = workspace.resources.all.map((r) => [r.id, r.kind, r.name, r.typeId])

          let notifications = 0
          const unsubscribe = workspace.subscribe(() => notifications++)
          const pasted = workspace.paste(diagram, fragment, offset)
          unsubscribe()

          expect(notifications).toBe(1)
          expect(pasted.placements.map((p) => p.resourceId)).toEqual(placements.map((p) => p.resourceId))
          expect(workspace.resources.all.map((r) => [r.id, r.kind, r.name, r.typeId])).toEqual(resourcesBefore)
          // Every id in the tree stays unique, so the pasted ones are all new.
          const idsAfter = treeIds()
          expect(new Set(idsAfter).size).toBe(idsAfter.length)
          const added = [...pasted.placements, ...pasted.links].map((n) => n.id)
          added.forEach((id) => expect(idsBefore.has(id)).toBe(false))

          const renamed = new Map<string, string>(placements.map((p, i) => [p.id, pasted.placements[i].id] as [string, string]))
          expect(pasted.links).toHaveLength(inner.length)
          inner.forEach((original, i) => {
            const copy = pasted.links[i]
            expect(copy.sourcePortId).toBe(original.sourcePortId)
            expect(copy.targetPortId).toBe(original.targetPortId)
            expect(copy.sourceId).toBe(renamed.get(original.sourceId))
            expect(copy.targetId).toBe(renamed.get(original.targetId))
          })
        },
      ),
      { numRuns: 100 },
    )
  })

  // Feature: resource-nodes, Property 13: Paste of a missing Resource is rejected
  // **Validates: Requirements 7.4**
  it('paste throws MISSING_RESOURCE and changes nothing when a Fragment Placement lost its Resource', () => {
    fc.assert(
      fc.property(
        commandsArb,
        fc.nat({ max: 1000 }),
        fc.array(fc.boolean(), { minLength: 1, maxLength: 40 }),
        fc.nat({ max: 1000 }),
        fc.nat({ max: 1000 }),
        positionArb,
        (commands, sourcePick, mask, resourcePick, targetPick, offset) => {
          const workspace = buildWorkspace(commands)
          const source = workspace.allDiagrams()[sourcePick % workspace.allDiagrams().length]
          const selected = new Set(source.placements.filter((_, i) => mask[i % mask.length]).map((n) => n.id))
          const fragment = workspace.copy(source, selected)

          const resourceIds = fragment.placements.map((p) => p.resourceId)
          if (resourceIds.length === 0) return

          workspace.removeResource(resourceIds[resourcePick % resourceIds.length])
          // Chosen after the removal: removing a component also removes its child Diagram.
          const remaining = workspace.allDiagrams()
          const destination = remaining[targetPick % remaining.length]
          const before = workspace.capture()
          const versionBefore = workspace.getVersion()
          let notifications = 0
          const unsubscribe = workspace.subscribe(() => notifications++)

          expect(() => workspace.paste(destination, fragment, offset)).toThrow(expect.objectContaining({ code: 'MISSING_RESOURCE' }))
          unsubscribe()
          expect(workspace.capture()).toBe(before)
          expect(workspace.getVersion()).toBe(versionBefore)
          expect(notifications).toBe(0)
        },
      ),
      { numRuns: 100 },
    )
  })

  // Feature: resource-nodes, Property 7: Cascade Delete matches its warning and is one step
  // **Validates: Requirements 5.2, 5.3**
  it('removeResource removes exactly what resourceImpact reported, with one notification', () => {
    fc.assert(
      fc.property(commandsArb, fc.nat({ max: 1000 }), (commands, pick) => {
        const workspace = buildWorkspace(commands)
        const resources = workspace.resources.all
        if (resources.length === 0) return
        const target = resources[pick % resources.length]

        // A component's child Diagram goes with it, so its contents are not expected to survive.
        const child = target.definition?.diagram
        const survivors = () => workspace.allDiagrams().filter((d) => d !== child)
        const doomed = () =>
          workspace.allDiagrams().flatMap((d) => d.placements.filter((p) => p.resourceId === target.id).map((p) => ({ d, id: p.id })))
        const nodeIds = () => survivors().flatMap((d) => d.placements.map((p) => p.id))
        const linkIds = () => survivors().flatMap((d) => d.links.map((l) => l.id))

        const impact = workspace.resourceImpact(target.id)
        const placementsGone = doomed()
        const doomedIds = new Set(placementsGone.map((x) => x.id))
        const linksGone = survivors().flatMap((d) =>
          d.links.filter((l) => doomedIds.has(l.sourceId) || doomedIds.has(l.targetId)).map((l) => l.id),
        )
        const nodesBefore = nodeIds()
        const linksBefore = linkIds()
        const contents = child ? { nodes: child.placements.length, links: child.links.length } : undefined
        const otherResources = workspace.resources.all.filter((r) => r.id !== target.id).map((r) => r.id)

        let notifications = 0
        const unsubscribe = workspace.subscribe(() => notifications++)
        workspace.removeResource(target.id)
        unsubscribe()

        expect(impact).toEqual({ placements: placementsGone.length, links: linksGone.length, contents })
        expect(nodeIds()).toEqual(nodesBefore.filter((id) => !doomedIds.has(id)))
        expect(linkIds()).toEqual(linksBefore.filter((id) => !linksGone.includes(id)))
        expect(doomed()).toEqual([])
        expect(workspace.resources.get(target.id)).toBeUndefined()
        expect(workspace.resources.all.map((r) => r.id)).toEqual(otherResources)
        expect(notifications).toBe(1)
      }),
      { numRuns: 100 },
    )
  })
})
