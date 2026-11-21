import { useState } from 'react'
import {
  ReactFlow,
  useEdgesState,
  useNodesState,
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
import { toEdges, toNodes } from './DiagramProjector'
import { recordViewport } from './recordViewport'
import { useStore } from './useStore'

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
  const { workspace, navigator } = useApp()
  const version = useStore(workspace).getVersion()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(toNodes(diagram))
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(toEdges(diagram))
  const [syncedVersion, setSyncedVersion] = useState(version)

  // React Flow needs local state to animate drags and selection, so rebuild it from the model
  // whenever the model changes, carrying `selected` over so a rename doesn't drop the selection.
  if (syncedVersion !== version) {
    setSyncedVersion(version)
    const selected = new Set([...nodes, ...edges].filter((e) => e.selected).map((e) => e.id))
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

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      defaultViewport={{ ...diagram.viewport }}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeDragStop={(_, node) => diagram.component(node.id)?.setPosition(node.position)}
      onMoveEnd={(_, viewport) => recordViewport(diagram, viewport)}
      onConnect={onConnect}
      onNodeDoubleClick={(_, node) => navigator.open(node.id)}
      onBeforeDelete={onBeforeDelete}
      onSelectionChange={({ nodes: n, edges: e }) => {
        if (n.length + e.length !== 1) return onSelectionChange(null)
        onSelectionChange(n.length ? { kind: 'component', id: n[0].id } : { kind: 'link', id: e[0].id })
      }}
      // Double-click opens a Component, so it must not also zoom.
      zoomOnDoubleClick={false}
    />
  )
}
