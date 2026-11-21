import type { Component, Position } from '../domain/Component'
import type { Diagram } from '../domain/Diagram'
import type { RenameController } from './RenameController'

// A new Component's size and also its minimum size. An empty name's content is smaller than this,
// so the minimum alone sizes a new node; React Flow positions nodes by top-left before it measures them.
export const NODE_SIZE = { width: 80, height: 56 }

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
