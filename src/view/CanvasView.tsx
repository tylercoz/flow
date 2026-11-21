import { useEffect, useRef, useState, type MouseEvent } from 'react'
import {
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { Diagram } from '../domain/Diagram'
import { DomainError } from '../domain/DomainError'
import type { Notifier } from '../domain/Notifier'
import { useApp } from './AppProvider'
import type { DeleteFlow, DeleteTarget } from './DeleteFlow'
import { ComponentNode, RenameContext } from './ComponentNode'
import { toEdges, toNodes } from './DiagramProjector'
import { createComponentAt, isEmptyCanvas } from './createAtPoint'
import { RenameController } from './RenameController'
import { selectionKey } from './selectionKey'
import { useStore } from './useStore'

// Must be module-level: a new object per render would make React Flow remount every node.
const nodeTypes = { component: ComponentNode }

/** The single selected Component or Link of the current Level, or null. */
export type CanvasSelection = DeleteTarget | null

export interface CanvasViewProps {
  /** Shared with ConfirmDialog; deletions from the Delete key go through it. */
  deleteFlow: DeleteFlow
  /** Called whenever the selection changes, including when it is cleared (e.g. after a Level change or deletion). */
  onSelectionChange: (selection: CanvasSelection) => void
}

export function CanvasView({ deleteFlow, onSelectionChange }: CanvasViewProps) {
  const { navigator, notifier } = useApp()
  useStore(navigator)
  const diagram = navigator.current
  // Keyed by Diagram id so each Level remounts and applies its own saved defaultViewport.
  return <Level key={diagram.id} diagram={diagram} notifier={notifier} deleteFlow={deleteFlow} onSelectionChange={onSelectionChange} />
}

interface LevelProps extends CanvasViewProps {
  diagram: Diagram
  notifier: Notifier
}

function Level({ diagram, notifier, deleteFlow, onSelectionChange }: LevelProps) {
  const { workspace, navigator, scheduler } = useApp()
  const [rename] = useState(() => new RenameController(scheduler))
  // Level is keyed by Diagram id, so unmounting is a Level change and must drop any pending or active Rename.
  useEffect(
    () => () => {
      rename.cancel()
      rename.end()
    },
    [rename],
  )
  const lastSelection = useRef(selectionKey([], []))
  const version = useStore(workspace).getVersion()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(toNodes(diagram))
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(toEdges(diagram))
  const [syncedVersion, setSyncedVersion] = useState(version)
  const { screenToFlowPosition } = useReactFlow()
  // Id of a Component just created by double-click; selected on the next model sync (state, not a ref, because the sync runs during render).
  const [pendingFocus, setPendingFocus] = useState<string | null>(null)

  // React Flow needs local state to animate drags and selection, so rebuild it from the model
  // whenever the model changes, carrying `selected` over so a rename doesn't drop the selection.
  if (syncedVersion !== version) {
    setSyncedVersion(version)
    // A freshly created Component replaces the previous selection so Focus stays single-element.
    const selected = pendingFocus
      ? new Set([pendingFocus])
      : new Set([...nodes, ...edges].filter((e) => e.selected).map((e) => e.id))
    setPendingFocus(null)
    setNodes(toNodes(diagram).map((n) => ({ ...n, selected: selected.has(n.id) })))
    setEdges(toEdges(diagram).map((e) => ({ ...e, selected: selected.has(e.id) })))
  }

  const onConnect = ({ source, target }: Connection) => {
    try {
      diagram.addLink(source, target)
    } catch (e) {
      if (!(e instanceof DomainError)) throw e
      notifier.post('link', e.message, 'transient')
    }
  }

  // Deletion is routed through DeleteFlow (confirmation, cascade), so React Flow must not delete by itself.
  const onBeforeDelete = async ({ nodes: gone, edges: goneEdges }: { nodes: Node[]; edges: Edge[] }) => {
    const goneIds = new Set(gone.map((n) => n.id))
    gone.forEach((n) => deleteFlow.request(diagram, { kind: 'component', id: n.id }))
    // Edges attached to a deleted node are handled by the cascade, and must survive a pending confirmation.
    goneEdges
      .filter((e) => !goneIds.has(e.source) && !goneIds.has(e.target))
      .forEach((e) => deleteFlow.request(diagram, { kind: 'link', id: e.id }))
    return false
  }

  // React Flow has no pane double-click event; only the pane itself counts as empty canvas.
  const onDoubleClick = (e: MouseEvent) => {
    if (!isEmptyCanvas(e.target)) return
    const point = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    setPendingFocus(createComponentAt(diagram, point, rename).id)
  }

  return (
    <RenameContext.Provider value={rename}>
      <div style={{ width: '100%', height: '100%' }} onDoubleClick={onDoubleClick}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          defaultViewport={{ ...diagram.viewport }}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStart={() => rename.cancel()}
          onNodeDragStop={(_, node) => diagram.component(node.id)?.setPosition(node.position)}
          onMoveEnd={(_, viewport) => diagram.setViewport(viewport)}
          onConnect={onConnect}
          onNodeDoubleClick={(_, node) => navigator.open(node.id)}
          onBeforeDelete={onBeforeDelete}
          onSelectionChange={({ nodes: n, edges: e }) => {
            // React Flow re-reports the selection whenever this inline callback's identity changes (every render),
            // so without this guard any re-render within the Rename Delay cancelled the pending Rename.
            const key = selectionKey(n.map((x) => x.id), e.map((x) => x.id))
            if (key === lastSelection.current) return
            lastSelection.current = key
            rename.cancel()
            if (n.length + e.length !== 1) return onSelectionChange(null)
            onSelectionChange(n.length ? { kind: 'component', id: n[0].id } : { kind: 'link', id: e[0].id })
          }}
          // Double-click opens a Component, so it must not also zoom.
          zoomOnDoubleClick={false}
        />
      </div>
    </RenameContext.Provider>
  )
}
