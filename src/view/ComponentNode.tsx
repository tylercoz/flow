import { createContext, useContext, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { Details } from '../domain/Details'
import { useApp } from './AppProvider'
import type { RenameController } from './RenameController'
import { useStore } from './useStore'

// nodeTypes must be a module-level constant, so Level hands the controller to nodes through context.
export const RenameContext = createContext<RenameController | null>(null)

function useRenameController(): RenameController {
  const controller = useContext(RenameContext)
  // A missing provider is a wiring bug in Level, not a runtime condition.
  if (!controller) throw new Error('ComponentNode must be rendered inside RenameContext.Provider')
  return controller
}

// Pointer travel above this between press and release means the user dragged the node.
const DRAG_THRESHOLD_PX = 4

// Gives React Flow about a sixth of a second to measure a new node before we stop retrying focus.
const MAX_FOCUS_FRAMES = 10

export function ComponentNode({ id, selected }: NodeProps) {
  const { navigator, workspace } = useApp()
  useStore(workspace)
  const controller = useRenameController()
  useStore(controller)
  const details = navigator.current.component(id)?.details

  // React Flow selects on pointerdown, before click, so only here is the previous Focus still visible.
  const press = useRef({ wasFocused: false, x: 0, y: 0 })
  const onPointerDown = (e: PointerEvent) => {
    press.current = { wasFocused: !!selected, x: e.clientX, y: e.clientY }
  }
  const onClick = (e: { detail: number; clientX: number; clientY: number }) => {
    const { wasFocused, x, y } = press.current
    const dragged = Math.hypot(e.clientX - x, e.clientY - y) > DRAG_THRESHOLD_PX
    // detail > 1 belongs to a double-click.
    if (e.detail === 1 && wasFocused && !dragged) controller.schedule(id)
  }

  return (
    <div
      onPointerDown={onPointerDown}
      onClick={onClick}
      onDoubleClick={() => controller.cancel()}
      style={{ padding: 10, minWidth: 100, textAlign: 'center', background: '#fff', border: '1px solid #1a192b', borderRadius: 3 }}
    >
      <Handle type="target" position={Position.Top} />
      {details && controller.editingId === id ? (
        <RenameInput details={details} controller={controller} />
      ) : (
        details?.name
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

function RenameInput({ details, controller }: { details: Details; controller: RenameController }) {
  const [draft, setDraft] = useState(details.name)
  const input = useRef<HTMLInputElement>(null)
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
    if (e.key === 'Enter') commit()
    if (e.key === 'Escape') {
      finished.current = true
      controller.end()
    }
  }

  return (
    <input
      ref={input}
      className="nodrag nopan"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={onKeyDown}
      onBlur={commit}
      // Selecting text inside the input must not open the Component.
      onDoubleClick={(e) => e.stopPropagation()}
    />
  )
}
