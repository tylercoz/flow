import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { Breadcrumb } from './view/Breadcrumb'
import { CanvasView } from './view/CanvasView'
import { ConfirmDialog } from './view/ConfirmDialog'
import { DeleteFlow } from './view/DeleteFlow'
import { HistoryControls } from './view/HistoryControls'
import { Inspector } from './view/Inspector'
import { EnvironmentVariablesDialog } from './view/EnvironmentVariablesDialog'
import { ExceptionsDialog } from './view/ExceptionsDialog'
import { TypesDialog } from './view/TypesDialog'
import { NotificationBar } from './view/NotificationBar'
import { useApp } from './view/AppProvider'
import { useStore } from './view/useStore'

const MIN_WIDTH = 240
const MAX_WIDTH = 720

const clampWidth = (w: number) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, w))

export default function App() {
  return (
    <ReactFlowProvider>
      <Layout />
    </ReactFlowProvider>
  )
}

function Layout() {
  const { workspace, navigator } = useApp()
  useStore(workspace)
  useStore(navigator)
  // One instance: the Delete key, the Inspector and ConfirmDialog must share the pending confirmation.
  const [deleteFlow] = useState(() => new DeleteFlow(workspace))
  const [typesOpen, setTypesOpen] = useState(false)
  const [exceptionsOpen, setExceptionsOpen] = useState(false)
  const [environmentVariablesOpen, setEnvironmentVariablesOpen] = useState(false)
  const [selection, setSelection] = useState<{ diagramId: string; id: string } | null>(null)

  const [sidebarWidth, setSidebarWidth] = useState(300)
  // The sidebar sits on the right, so dragging left (smaller x) widens it.
  const drag = useRef<{ x: number; width: number } | null>(null)
  const startResize = (e: PointerEvent<HTMLDivElement>) => {
    drag.current = { x: e.clientX, width: sidebarWidth }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const moveResize = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current) setSidebarWidth(clampWidth(drag.current.width + drag.current.x - e.clientX))
  }
  const endResize = () => {
    drag.current = null
  }
  const resizeByKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    setSidebarWidth((w) => clampWidth(w + (e.key === 'ArrowLeft' ? 16 : -16)))
  }
  const diagram = navigator.current
  // Resolve the live item every render; a stale id (deleted item, other Level) means no selection.
  const live = selection?.diagramId === diagram.id ? selection : undefined
  const placement = live ? diagram.placement(live.id) : undefined
  if (selection && !placement) setSelection(null)

  return (
    <div className="app">
      <header className="app-header">
        <Breadcrumb />
        <HistoryControls />
        <button type="button" onClick={() => setTypesOpen(true)}>
          Types
        </button>
        <button type="button" onClick={() => setExceptionsOpen(true)}>
          Exceptions
        </button>
        <button type="button" onClick={() => setEnvironmentVariablesOpen(true)}>
          Environment variables
        </button>
      </header>
      <NotificationBar />
      <main className="app-main">
        <div className="app-canvas">
          <CanvasView
            deleteFlow={deleteFlow}
            // Links carry only a label, edited on the canvas, so only Placements get an Inspector.
            onSelectionChange={(s) => setSelection(s?.kind === 'placement' ? { diagramId: navigator.current.id, id: s.id } : null)}
          />
        </div>
        <div
          className="sidebar-handle"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          aria-valuemin={MIN_WIDTH}
          aria-valuemax={MAX_WIDTH}
          aria-valuenow={sidebarWidth}
          tabIndex={0}
          onPointerDown={startResize}
          onPointerMove={moveResize}
          onPointerUp={endResize}
          onPointerCancel={endResize}
          onKeyDown={resizeByKey}
        />
        {placement ? (
          <Inspector key={placement.id} item={placement} diagram={diagram} deleteFlow={deleteFlow} width={sidebarWidth} />
        ) : (
          <aside className="inspector" style={{ width: sidebarWidth }} aria-label="Details">
            <p className="inspector-empty">Select an item to see its details.</p>
          </aside>
        )}
      </main>
      <ConfirmDialog deleteFlow={deleteFlow} />
      {typesOpen && <TypesDialog onClose={() => setTypesOpen(false)} />}
      {exceptionsOpen && <ExceptionsDialog onClose={() => setExceptionsOpen(false)} />}
      {environmentVariablesOpen && <EnvironmentVariablesDialog onClose={() => setEnvironmentVariablesOpen(false)} />}
    </div>
  )
}
