import type { Position } from '../domain/Component'
import { useApp } from './AppProvider'

export interface ToolbarProps {
  // Canvas center in flow coordinates. Supplied by App because only the
  // ReactFlow instance knows the current viewport and pane size.
  getCenter: () => Position
}

export function Toolbar({ getCenter }: ToolbarProps) {
  const { navigator } = useApp()

  return (
    <div role="toolbar" aria-label="Diagram tools">
      <button type="button" onClick={() => navigator.current.addComponent(getCenter())}>
        Add component
      </button>
    </div>
  )
}
