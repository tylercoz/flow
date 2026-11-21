import { useRef, useState } from 'react'
import { ReactFlowProvider, useReactFlow } from '@xyflow/react'
import type { Position } from './domain/Component'
import { Breadcrumb } from './view/Breadcrumb'
import { CanvasView, type CanvasSelection } from './view/CanvasView'
import { ConfirmDialog } from './view/ConfirmDialog'
import { DeleteFlow } from './view/DeleteFlow'
import { Inspector } from './view/Inspector'
import { NotificationBar } from './view/NotificationBar'
import { Toolbar } from './view/Toolbar'
import { useApp } from './view/AppProvider'
import { useStore } from './view/useStore'

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
  const { screenToFlowPosition } = useReactFlow()
  const canvasRef = useRef<HTMLDivElement>(null)
  // One instance: the Delete key, the Inspector and ConfirmDialog must share the pending confirmation.
  const [deleteFlow] = useState(() => new DeleteFlow())
  const [selection, setSelection] = useState<{ diagramId: string; target: NonNullable<CanvasSelection> } | null>(null)

  const diagram = navigator.current
  // Resolve the live item every render; a stale id (deleted item, other Level) means no selection.
  const target = selection?.diagramId === diagram.id ? selection.target : null
  const item = target && (target.kind === 'component' ? diagram.component(target.id) : diagram.links.find((l) => l.id === target.id))
  if (selection && !item) setSelection(null)

  const getCenter = (): Position => {
    const rect = canvasRef.current?.getBoundingClientRect()
    return screenToFlowPosition({
      x: rect ? rect.left + rect.width / 2 : 0,
      y: rect ? rect.top + rect.height / 2 : 0,
    })
  }

  return (
    <div className="app">
      <header className="app-header">
        <Toolbar getCenter={getCenter} />
        <Breadcrumb />
      </header>
      <NotificationBar />
      <main className="app-main">
        <div className="app-canvas" ref={canvasRef}>
          <CanvasView
            deleteFlow={deleteFlow}
            onSelectionChange={(s) => setSelection(s && { diagramId: navigator.current.id, target: s })}
          />
        </div>
        {target && item && <Inspector key={item.id} item={item} kind={target.kind} diagram={diagram} deleteFlow={deleteFlow} />}
      </main>
      <ConfirmDialog deleteFlow={deleteFlow} />
    </div>
  )
}
