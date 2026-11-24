import { useState } from 'react'
import type { Diagram } from '../domain/Diagram'
import type { Placement } from '../domain/Placement'
import type { DeleteFlow } from './DeleteFlow'
import { Inspector } from './Inspector'
import { ResourcesPanel } from './ResourcesPanel'
const TABS = [
  { id: 'details', label: 'Details' },
  { id: 'resources', label: 'Resources' },
] as const
type TabId = (typeof TABS)[number]['id']
type Props = {
  /** The selected Placement, if any. */
  item: Placement | undefined
  diagram: Diagram
  deleteFlow: DeleteFlow
  /** Width in px; owned by App so it survives selection changes. */
  width: number
  /** Starts finding the Placements of a Resource. */
  onFind: (resourceId: string) => void
}
export function Sidebar({ item, diagram, deleteFlow, width, onFind }: Props) {
  const [tab, setTab] = useState<TabId>('details')
  return (
    <aside className="inspector" style={{ width }} aria-label="Sidebar">
      <div className="tab-list" role="tablist">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`sidebar-tab-${id}`}
            aria-selected={tab === id}
            aria-controls="sidebar-panel"
            className="tab"
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="sidebar-panel" role="tabpanel" id="sidebar-panel" aria-labelledby={`sidebar-tab-${tab}`}>
        {tab === 'resources' ? (
          <ResourcesPanel onFind={onFind} />
        ) : item ? (
          <Inspector key={item.id} item={item} diagram={diagram} deleteFlow={deleteFlow} />
        ) : (
          <p className="inspector-empty">Select an item to see its details.</p>
        )}
      </div>
    </aside>
  )
}
