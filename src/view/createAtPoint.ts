import type { Component, Position } from '../domain/Component'
import type { Diagram } from '../domain/Diagram'
import type { RenameController } from './RenameController'

// Approximate rendered size of a default-named Component; React Flow positions nodes by top-left,
// and the real size is unknown until render.
export const NODE_SIZE = { width: 122, height: 40 }

// The pane is the only element that means "empty canvas"; nodes, edges, controls and inputs are other elements.
// Checks classList structurally instead of `instanceof Element` so it also runs in the DOM-less test environment.
export function isEmptyCanvas(target: EventTarget | null): boolean {
  const classList = (target as { classList?: DOMTokenList } | null)?.classList
  return classList?.contains('react-flow__pane') ?? false
}

export function createComponentAt(diagram: Diagram, point: Position, rename: RenameController): Component {
  const component = diagram.addComponent({
    x: point.x - NODE_SIZE.width / 2,
    y: point.y - NODE_SIZE.height / 2,
  })
  rename.start(component.id)
  return component
}
