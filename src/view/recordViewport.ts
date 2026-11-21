import type { Diagram } from '../domain/Diagram'
import type { Viewport } from '../domain/Viewport'

// Kept free of React and @xyflow/react so it is testable without a DOM; React Flow's Viewport is structurally identical.
export function recordViewport(diagram: Diagram, viewport: Viewport): void {
  diagram.setViewport(viewport)
}
