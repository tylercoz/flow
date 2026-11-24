import type { KeyboardEvent } from 'react'
import type { Resource } from '../domain/Resource'
import { ResourceIcon } from './resourceIcons'

type Props = {
  resource: Resource
  /** Zero-based position of the focused Placement among `count`. */
  index: number
  count: number
  onStep: (delta: 1 | -1) => void
  onClose: () => void
}

// A Find-style bar over the canvas that steps through every Placement of one Resource.
export function PlacementFinder({ resource, index, count, onStep, onClose }: Props) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') onClose()
    // Enter on a focused button would otherwise click it, so Close keeps its own Enter.
    if (e.key === 'Enter' && !(e.target as HTMLElement).closest('[data-close]')) {
      e.preventDefault()
      onStep(e.shiftKey ? -1 : 1)
    }
  }
  return (
    <div className="find-bar" role="search" aria-label="Find placements" onKeyDown={onKeyDown}>
      <ResourceIcon kind={resource.kind} />
      <span className="find-name">{resource.name || 'Unnamed'}</span>
      <span className="find-count" aria-live="polite">
        {index + 1} of {count}
      </span>
      <button type="button" aria-label="Previous placement" title="Previous (Shift+Enter)" onClick={() => onStep(-1)}>
        ↑
      </button>
      <button type="button" aria-label="Next placement" title="Next (Enter)" autoFocus onClick={() => onStep(1)}>
        ↓
      </button>
      <button type="button" data-close aria-label="Close find" title="Close (Esc)" onClick={onClose}>
        ×
      </button>
    </div>
  )
}
