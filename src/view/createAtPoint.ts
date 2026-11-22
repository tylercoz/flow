import type { Position } from '../domain/NodeBounds'
import type { Diagram } from '../domain/Diagram'
import type { Placement } from '../domain/Placement'
import type { Workspace } from '../domain/Workspace'
import type { RenameController } from './RenameController'

// A new component Placement's size and also its minimum size. An empty name's content is smaller than this,
// so the minimum alone sizes a new node; React Flow positions nodes by top-left before it measures them.
export const NODE_SIZE = { width: 200, height: 100 }

// The pane is the only element that means "empty canvas"; nodes, edges, controls and inputs are other elements.
// Checks classList structurally instead of `instanceof Element` so it also runs in the DOM-less test environment.
export function isEmptyCanvas(target: EventTarget | null): boolean {
  const classList = (target as { classList?: DOMTokenList } | null)?.classList
  return classList?.contains('react-flow__pane') ?? false
}

export function createComponentAt(
  workspace: Workspace,
  diagram: Diagram,
  point: Position,
  rename: RenameController,
): Placement {
  const placement = workspace.createPlacedResource(
    diagram,
    { kind: 'component', name: '' },
    { x: point.x - NODE_SIZE.width / 2, y: point.y - NODE_SIZE.height / 2 },
  )
  rename.start(placement.id)
  return placement
}
