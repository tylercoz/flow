import type { Diagram } from './Diagram'
import type { Workspace } from './Workspace'

// Where a Placement can be seen: the top-level Diagram to open and the component Placement ids to descend through.
export type PlacementLocation = { rootId: string; path: readonly string[]; placementId: string }

// Components share their child Diagram, so one Placement inside it is reachable by several paths.
// Each Diagram is walked once, which lists such a Placement once, by the first path found.
export function locatePlacements(workspace: Pick<Workspace, 'diagrams' | 'resources'>, resourceId: string): PlacementLocation[] {
  const found: PlacementLocation[] = []
  const seen = new Set<string>()
  const walk = (diagram: Diagram, rootId: string, path: readonly string[]) => {
    if (seen.has(diagram.id)) return
    seen.add(diagram.id)
    for (const p of diagram.placements) {
      if (p.resourceId === resourceId) found.push({ rootId, path, placementId: p.id })
    }
    for (const p of diagram.placements) {
      const child = workspace.resources.get(p.resourceId)?.definition?.diagram
      if (child) walk(child, rootId, [...path, p.id])
    }
  }
  for (const { diagram } of workspace.diagrams) walk(diagram, diagram.id, [])
  return found
}
