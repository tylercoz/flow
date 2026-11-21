import { createContext, useContext, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import { Handle, NodeResizer, Position, type NodeProps, type ResizeParams } from '@xyflow/react'
import type { Details } from '../domain/Details'
import type { Side } from '../domain/Link'
import { useApp } from './AppProvider'
import { NODE_SIZE } from './createAtPoint'
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

// Ids match domain Side values. All Handles are `source` and CanvasView uses loose connection mode,
// so a Link can start or end on any side.
const SIDE_HANDLES: [Side, Position][] = [
  ['top', Position.Top],
  ['right', Position.Right],
  ['bottom', Position.Bottom],
  ['left', Position.Left],
]

export function ComponentNode({ id, selected }: NodeProps) {
  const { navigator, workspace } = useApp()
  useStore(workspace)
  const controller = useRenameController()
  useStore(controller)
  const details = navigator.current.component(id)?.details

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

  const onResizeEnd = (_: unknown, { x, y, width, height }: ResizeParams) =>
    navigator.current.component(id)?.setBounds({ x, y }, { width, height })
  return (
    <>
      {/* Outside the clickable div so a resize drag is never mistaken for a click that starts a Rename. */}
      <NodeResizer
        isVisible={selected}
        minWidth={NODE_SIZE.width}
        minHeight={NODE_SIZE.height}
        onResizeEnd={onResizeEnd}
      />
      <div
        style={{ minWidth: NODE_SIZE.width, minHeight: NODE_SIZE.height }}
        onPointerDown={onPointerDown}
        onClick={onClick}
        onDoubleClick={() => controller.start(id)}
        className="component-node"
      >
        {SIDE_HANDLES.map(([id, position]) => (
          <Handle key={id} id={id} type="source" position={position} />
        ))}
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
    </>
  )
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
