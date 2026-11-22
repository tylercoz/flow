import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react'
import { useApp } from './AppProvider'
import { RenameInput, useRenameController } from './RenameInput'
import { useStore } from './useStore'
// Replaces React Flow's built-in label so the text can turn into an editor in place.
export function LinkEdge({ id, markerEnd, selected, ...geometry }: EdgeProps) {
  const { navigator, workspace } = useApp()
  useStore(workspace)
  const controller = useRenameController()
  useStore(controller)
  const link = navigator.current.links.find((l) => l.id === id)
  const [path, labelX, labelY] = getBezierPath(geometry)
  const editing = !!link && controller.editingId === id
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} interactionWidth={20} />
      {link && (editing || link.name) && (
        <EdgeLabelRenderer>
          <div
            // EdgeLabelRenderer sits outside the edge's pointer-events, so the label opts back in to be editable.
            className={`link-label nodrag nopan${selected ? ' selected' : ''}`}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            onDoubleClick={() => controller.start(id)}
          >
            {editing ? <RenameInput target={link} controller={controller} /> : link.name}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
