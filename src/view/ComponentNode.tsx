import { createContext, useContext, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import { NodeResizer, useUpdateNodeInternals, type NodeProps, type ResizeParams } from '@xyflow/react'
import type { Details } from '../domain/Details'
import { useApp } from './AppProvider'
import { NODE_SIZE } from './createAtPoint'
import { PortList } from './PortList'
import type { RenameController } from './RenameController'
import { useStore } from './useStore'

// nodeTypes must be a module-level constant, so Level hands the controller to nodes through context.
export const RenameContext = createContext<RenameController | null>(null)

export function useRenameController(): RenameController {
  const controller = useContext(RenameContext)
  // A missing provider is a wiring bug in Level, not a runtime condition.
  if (!controller) throw new Error('ComponentNode must be rendered inside RenameContext.Provider')
  return controller
}

// Pointer travel above this between press and release means the user dragged the node.
const DRAG_THRESHOLD_PX = 4

// Gives React Flow about a sixth of a second to measure a new node before we stop retrying focus.
const MAX_FOCUS_FRAMES = 10


export function ComponentNode({ id, selected, width, height }: NodeProps) {
  const { navigator, workspace } = useApp()
  useStore(workspace)
  const controller = useRenameController()
  useStore(controller)
  const diagram = navigator.current
  const component = diagram.component(id)
  const details = component?.details
  // The node has a width and height only while NodeResizer drags it (DiagramProjector never sets them), so the
  // box follows the drag and otherwise keeps the stored size as a floor it can grow past when ports are added.
  const floor = {
    minWidth: Math.max(NODE_SIZE.width, width ?? component?.size?.width ?? 0),
    minHeight: Math.max(NODE_SIZE.height, height ?? component?.size?.height ?? 0),
  }
  const inputs = details?.inputs ?? []
  const outputs = details?.outputs ?? []
  const updateNodeInternals = useUpdateNodeInternals()
  const portKey = [...inputs, ...outputs].map((p) => p.id).join()
  // React Flow measures Handles only when told; without this a new or removed port keeps stale connection points.
  useEffect(() => updateNodeInternals(id), [id, portKey, updateNodeInternals])

  // React Flow selects a node on click. Capturing `selected` at pointerdown is still correct because
  // pointerdown precedes click, so the previous Focus is still visible.
  const press = useRef({ wasFocused: false, x: 0, y: 0 })
  const onPointerDown = (e: PointerEvent) => {
    press.current = { wasFocused: !!selected, x: e.clientX, y: e.clientY }
  }
  const onClick = (e: MouseEvent) => {
    const { wasFocused, x, y } = press.current
    const dragged = Math.hypot(e.clientX - x, e.clientY - y) > DRAG_THRESHOLD_PX
    // detail > 1 belongs to a double-click.
    if (e.detail === 1 && wasFocused && !dragged) controller.schedule(id)
  }

  // The smallest box that still fits the ports and name. Measured when a resize starts, because ports and
  // the name change between resizes and a fixed minimum let the user shrink the box past its content.
  const box = useRef<HTMLDivElement>(null)
  const [minSize, setMinSize] = useState(NODE_SIZE)
  const onResizeStart = () => {
    if (box.current) setMinSize(measureMinSize(box.current))
  }
  const onResizeEnd = (_: unknown, { x, y, width, height }: ResizeParams) =>
    navigator.current.component(id)?.setBounds({ x, y }, { width, height })
  return (
    <>
      {/* Outside the clickable div so a resize drag is never mistaken for a click that starts a Rename. */}
      <NodeResizer
        isVisible={selected}
        minWidth={minSize.width}
        minHeight={minSize.height}
        onResizeStart={onResizeStart}
        onResizeEnd={onResizeEnd}
      />
      <div
        ref={box}
        style={floor}
        className="component-node"
      >
        <PortList ports={inputs} field="inputs" onChange={(next) => diagram.setPorts(id, 'inputs', next)} />
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
          {details && controller.editingId === id ? (
            <RenameInput details={details} controller={controller} />
          ) : (
            details?.name
          )}
        </div>
        <PortList ports={outputs} field="outputs" onChange={(next) => diagram.setPorts(id, 'outputs', next)} />
      </div>
    </>
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

export function RenameInput({ details, controller }: { details: Details; controller: RenameController }) {
  const [draft, setDraft] = useState(details.name)
  const input = useRef<HTMLTextAreaElement>(null)
  // Unmounting a focused input can still deliver a blur; this keeps Escape from committing through it.
  const finished = useRef(false)

  // React Flow keeps a new node `visibility: hidden` until it has measured it, and focus() on a hidden
  // input is a no-op, so retry per frame until the focus sticks.
  useEffect(() => {
    let frame = 0
    let attempts = 0
    const tryFocus = () => {
      const el = input.current
      if (!el) return
      el.focus()
      el.select()
      if (document.activeElement !== el && ++attempts < MAX_FOCUS_FRAMES) frame = requestAnimationFrame(tryFocus)
    }
    tryFocus()
    return () => cancelAnimationFrame(frame)
  }, [])

  const commit = () => {
    if (finished.current) return
    finished.current = true
    details.patch({ name: draft })
    controller.end()
  }

  const onKeyDown = (e: KeyboardEvent) => {
    // Shift+Enter falls through to the textarea's default and inserts a newline.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      commit()
    }
    if (e.key === 'Escape') {
      finished.current = true
      controller.end()
    }
  }

  return (
    <textarea
      ref={input}
      className="nodrag nopan"
      // Grows with the text so no scrollbar or hidden line appears.
      rows={draft.split('\n').length}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={onKeyDown}
      onBlur={commit}
      // Selecting text inside the input must not restart the Rename.
      onDoubleClick={(e) => e.stopPropagation()}
    />
  )
}
