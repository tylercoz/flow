import { createContext, useContext, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { RenameController } from './RenameController'

// nodeTypes must be a module-level constant, so Level hands the controller to nodes through context.
export const RenameContext = createContext<RenameController | null>(null)

export function useRenameController(): RenameController {
  const controller = useContext(RenameContext)
  // A missing provider is a wiring bug in Level, not a runtime condition.
  if (!controller) throw new Error('RenameInput users must be rendered inside RenameContext.Provider')
  return controller
}

// Gives React Flow about a sixth of a second to measure a new node before we stop retrying focus.
const MAX_FOCUS_FRAMES = 10

export function RenameInput({ target, controller }: { target: { name: string; setName(name: string): void }; controller: RenameController }) {
  const [draft, setDraft] = useState(target.name)
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
    target.setName(draft)
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
