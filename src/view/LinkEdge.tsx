import { useEffect, useState, type PointerEvent } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow, type EdgeProps } from '@xyflow/react'
import type { Position } from '../domain/NodeBounds'
import { useApp } from './AppProvider'
import { labelPoint, midpoint, roundedPath } from './linkPath'
import { RenameInput, useRenameController } from './RenameInput'
import { useStore } from './useStore'

// Pointer travel (px) before a press on a segment handle counts as a drag, so a plain click adds no bend.
const DRAG_THRESHOLD = 3

const at = (p: Position) => ({ transform: `translate(-50%, -50%) translate(${p.x}px, ${p.y}px)` })

// Replaces React Flow's built-in label so the text can turn into an editor in place.
export function LinkEdge({ id, markerEnd, selected, sourceX, sourceY, targetX, targetY, ...geometry }: EdgeProps) {
  const { navigator, workspace } = useApp()
  useStore(workspace)
  const controller = useRenameController()
  useStore(controller)
  const { screenToFlowPosition } = useReactFlow()
  // The bend points while one is being dragged. The model is written once on release, so a drag is one undo step.
  const [preview, setPreview] = useState<Position[] | null>(null)
  // `base` is the list the drag starts from, already holding a new bend when one is being dragged out of a segment.
  // `index` is the bend that follows the pointer.
  const [drag, setDrag] = useState<{ base: Position[]; index: number; origin: Position } | null>(null)
  const link = navigator.current.links.find((l) => l.id === id)

  // Window listeners instead of pointer capture: a new bend replaces the segment handle that received the press.
  // Being an effect, the listeners are also removed if the edge unmounts mid-drag (Level change, undo).
  useEffect(() => {
    if (!drag || !link) return
    const { base, index, origin } = drag
    let moved = false
    let latest = base
    const move = (ev: globalThis.PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - origin.x, ev.clientY - origin.y) < DRAG_THRESHOLD) return
      moved = true
      const p = screenToFlowPosition({ x: ev.clientX, y: ev.clientY })
      latest = base.map((w, i) => (i === index ? p : w))
      setPreview(latest)
    }
    const end = () => {
      if (moved) link.setWaypoints(latest)
      setPreview(null)
      setDrag(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
    }
  }, [drag, link, screenToFlowPosition])
  const waypoints = preview ?? link?.waypoints ?? []
  const points = [{ x: sourceX, y: sourceY }, ...waypoints, { x: targetX, y: targetY }]
  // Without bends the automatic curve is kept, so existing diagrams look the same.
  const [bezier, bezierX, bezierY] = getBezierPath({ sourceX, sourceY, targetX, targetY, ...geometry })
  const path = waypoints.length ? roundedPath(points) : bezier
  const label = waypoints.length ? labelPoint(points) : { x: bezierX, y: bezierY }
  const editing = !!link && controller.editingId === id

  const startDrag = (e: PointerEvent, base: Position[], index: number) => {
    e.stopPropagation()
    setDrag({ base, index, origin: { x: e.clientX, y: e.clientY } })
  }

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} interactionWidth={20} />
      {link && (editing || link.name) && (
        <EdgeLabelRenderer>
          <div
            // EdgeLabelRenderer sits outside the edge's pointer-events, so the label opts back in to be editable.
            className={`link-label nodrag nopan${selected ? ' selected' : ''}`}
            style={at(label)}
            onDoubleClick={() => controller.start(id)}
          >
            {editing ? <RenameInput target={link} controller={controller} /> : link.name}
          </div>
        </EdgeLabelRenderer>
      )}
      {link && selected && !editing && (
        <EdgeLabelRenderer>
          {waypoints.map((p, i) => (
            <div
              key={`bend-${i}`}
              className="link-bend nodrag nopan"
              style={at(p)}
              onPointerDown={(e) => startDrag(e, [...waypoints], i)}
              // A double-click on a bend removes it; it must not also start a Rename.
              onDoubleClick={(e) => {
                e.stopPropagation()
                link.setWaypoints(waypoints.filter((_, j) => j !== i))
              }}
            />
          ))}
          {!preview &&
            points.slice(1).map((end, i) => (
              <div
                key={`add-${i}`}
                className="link-bend link-bend-new nodrag nopan"
                style={at(midpoint(points[i], end))}
                // Segment i runs between points i and i+1, so a bend dragged out of it becomes waypoint i.
                onPointerDown={(e) => {
                  const base = [...waypoints.slice(0, i), midpoint(points[i], end), ...waypoints.slice(i)]
                  startDrag(e, base, i)
                }}
              />
            ))}
        </EdgeLabelRenderer>
      )}
    </>
  )
}
