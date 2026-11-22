import { useEffect, useRef, useState, type MouseEvent, type PointerEvent, type RefObject } from 'react'
import { NodeResizer, Handle, Position, useUpdateNodeInternals, type NodeProps, type ResizeParams } from '@xyflow/react'
import type { Resource } from '../domain/Resource'
import { DATABASE_PORTS, SIDE_PORTS } from '../domain/ResourceKinds'
import { useApp } from './AppProvider'
import { NODE_SIZE } from './nodeSize'
import { PortList } from './PortList'
import { RenameInput, useRenameController } from './RenameInput'
import { ResourceIcon } from './resourceIcons'
import { useStore } from './useStore'

// Pointer travel above this between press and release means the user dragged the node.
const DRAG_THRESHOLD_PX = 4

// Smaller than a component's box: a non-component Resource has no port lists to fit.
const MIN_SIZE = { width: 120, height: 48 }

const SIDE_POSITIONS: Record<(typeof SIDE_PORTS)[number], Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
}

export function PlacementNode({ id, selected, width, height }: NodeProps) {
  const { navigator, workspace } = useApp()
  useStore(workspace)
  const diagram = navigator.current
  const placement = diagram.placement(id)
  const resource = diagram.resourceOf(id)
  const isComponent = !!resource?.definition
  const base = isComponent ? NODE_SIZE : MIN_SIZE

  // The node has a width and height only while NodeResizer drags it, so the box follows the drag and
  // otherwise keeps the stored size as a floor it can grow past when ports are added.
  const floor = {
    minWidth: Math.max(base.width, width ?? placement?.size?.width ?? 0),
    minHeight: Math.max(base.height, height ?? placement?.size?.height ?? 0),
  }

  // The smallest box that still fits the ports and name. Measured when a resize starts, because ports and
  // the name change between resizes and a fixed minimum let the user shrink the box past its content.
  const box = useRef<HTMLDivElement>(null)
  const [measured, setMeasured] = useState(NODE_SIZE)
  const minSize = isComponent ? measured : MIN_SIZE
  const onResizeStart = () => {
    if (isComponent && box.current) setMeasured(measureMinSize(box.current))
  }
  const onResizeEnd = (_: unknown, { x, y, width, height }: ResizeParams) =>
    navigator.current.placement(id)?.setBounds({ x, y }, { width, height })

  return (
    <>
      {/* Outside the clickable body so a resize drag is never mistaken for a click that starts a Rename. */}
      <NodeResizer
        isVisible={selected}
        minWidth={minSize.width}
        minHeight={minSize.height}
        onResizeStart={onResizeStart}
        onResizeEnd={onResizeEnd}
      />
      {resource?.definition ? (
        <ComponentBody id={id} selected={!!selected} resource={resource} box={box} style={floor} />
      ) : (
        resource && <ResourceBody resource={resource} style={floor} />
      )}
    </>
  )
}

type BodyStyle = { minWidth: number; minHeight: number }

function ResourceBody({ resource, style }: { resource: Resource; style: BodyStyle }) {
  const { workspace } = useApp()
  const typeName = resource.typeId ? workspace.types.find((t) => t.id === resource.typeId)?.name : undefined
  return (
    <div style={style} className="placement-node">
      <ResourceIcon kind={resource.kind} />
      <div className="placement-text">
        <span className="placement-name">{resource.name}</span>
        {typeName && <span className="placement-type">{typeName}</span>}
      </div>
      {resource.kind === 'database' ? (
        <>
          <Handle id={DATABASE_PORTS.write} type="target" position={Position.Left} />
          <Handle id={DATABASE_PORTS.read} type="source" position={Position.Right} />
        </>
      ) : (
        SIDE_PORTS.map((side) => (
          <span key={side}>
            {/* Same id and side for both roles; loose connection mode lets either start or end a Link. */}
            <Handle id={side} type="source" position={SIDE_POSITIONS[side]} />
            <Handle id={side} type="target" position={SIDE_POSITIONS[side]} />
          </span>
        ))
      )}
    </div>
  )
}

interface ComponentBodyProps {
  id: string
  selected: boolean
  resource: Resource
  box: RefObject<HTMLDivElement | null>
  style: BodyStyle
}

function ComponentBody({ id, selected, resource, box, style }: ComponentBodyProps) {
  const { navigator, workspace } = useApp()
  const controller = useRenameController()
  useStore(controller)
  const inputs = resource.definition?.inputs ?? []
  const outputs = resource.definition?.outputs ?? []
  const updateNodeInternals = useUpdateNodeInternals()
  const portKey = [...inputs, ...outputs].map((p) => p.id).join()
  // React Flow measures Handles only when told; without this a new or removed port keeps stale connection points.
  useEffect(() => updateNodeInternals(id), [id, portKey, updateNodeInternals])

  // React Flow selects a node on click. Capturing `selected` at pointerdown is still correct because
  // pointerdown precedes click, so the previous Focus is still visible.
  const press = useRef({ wasFocused: false, x: 0, y: 0 })
  const onPointerDown = (e: PointerEvent) => {
    press.current = { wasFocused: selected, x: e.clientX, y: e.clientY }
  }
  const onClick = (e: MouseEvent) => {
    const { wasFocused, x, y } = press.current
    const dragged = Math.hypot(e.clientX - x, e.clientY - y) > DRAG_THRESHOLD_PX
    // detail > 1 belongs to a double-click.
    if (e.detail === 1 && wasFocused && !dragged) controller.schedule(id)
  }

  return (
    <div ref={box} style={style} className="component-node">
      <PortList ports={inputs} field="inputs" onChange={(next) => workspace.setPorts(resource.id, 'inputs', next)} />
      {/* Only the name box starts a Rename, so clicking a port name does not. */}
      <div
        className="component-body"
        onPointerDown={onPointerDown}
        onClick={onClick}
        onDoubleClick={() => controller.start(id)}
      >
        {/* Stops the press and click so opening is not mistaken for a drag or a Rename start. */}
        <button
          className="open-button nodrag nopan"
          aria-label="Open component"
          title="Open"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            navigator.open(id)
          }}
          onDoubleClick={(e) => e.stopPropagation()}
        />
        {controller.editingId === id ? <RenameInput target={resource} controller={controller} /> : resource.name}
      </div>
      <PortList ports={outputs} field="outputs" onChange={(next) => workspace.setPorts(resource.id, 'outputs', next)} />
    </div>
  )
}

// Lays the box out at its min-content size, reads it, and restores it in the same task, so nothing is painted.
// offsetWidth/offsetHeight ignore the viewport's zoom transform, so the result is already in flow units.
// The stored-size floor is lifted too, or the result would be the current size rather than the content's.
function measureMinSize(el: HTMLElement): { width: number; height: number } {
  const { flex, width, height, minWidth, minHeight } = el.style
  Object.assign(el.style, { flex: 'none', width: 'min-content', height: 'min-content', minWidth: '0', minHeight: '0' })
  const size = { width: Math.max(NODE_SIZE.width, el.offsetWidth), height: Math.max(NODE_SIZE.height, el.offsetHeight) }
  Object.assign(el.style, { flex, width, height, minWidth, minHeight })
  return size
}
