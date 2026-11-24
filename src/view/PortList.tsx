import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NewPort, Port } from '../domain/Port'
import { applyPortName, movePort, portMarks } from './portEdit'

interface PortListProps {
  ports: readonly Port[]
  field: 'inputs' | 'outputs'
  onChange: (ports: NewPort[]) => void
}

export function PortList({ ports, field, onChange }: PortListProps) {
  // Index of the port being edited; one past the end is a port being added.
  const [editing, setEditing] = useState<number | null>(null)
  // Row index a dragged port would land on; null when no drag is in progress.
  const [dropAt, setDropAt] = useState<number | null>(null)

  const commit = (index: number, name: string) => {
    setEditing(null)
    const next = applyPortName(ports, index, name.trim())
    if (next) onChange(next)
  }

  const input = field === 'inputs'
  return (
    <ul className={`component-ports ${input ? 'input' : 'output'}-ports`} aria-label={input ? 'Inputs' : 'Outputs'}>
      {[...ports.map((p) => p.name), ...(editing === ports.length ? [''] : [])].map((name, i) => (
        <li key={ports[i]?.id ?? 'new'} className={dropAt === i ? 'drop-target' : undefined} onDoubleClick={() => setEditing(i)}>
          {/* A port being added has no id yet, so it gets its Handle once it is committed. */}
          {ports[i] && (
            <Handle id={ports[i].id} type={input ? 'target' : 'source'} position={input ? Position.Left : Position.Right} />
          )}
          {editing === i ? <PortInput initial={name} onDone={(value) => commit(i, value)} /> : name + (ports[i] ? portMarks(ports[i]) : '')}
          {ports[i] && editing !== i && ports.length > 1 && (
            <PortGrip
              name={name}
              onMove={(to) => {
                const next = movePort(ports, i, to)
                if (next) onChange(next)
              }}
              index={i}
              onDrag={setDropAt}
            />
          )}
          {/* Stops the press so removing a port is not mistaken for a node drag or selection. */}
          {ports[i] && editing !== i && (
            <button
              type="button"
              className="remove-port nodrag nopan"
              aria-label={`Remove ${name}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onChange(ports.filter((_, j) => j !== i))}
            >
              ×
            </button>
          )}
        </li>
      ))}
      {/* Stops the press so adding a port is not mistaken for a node drag or selection. */}
      <li className="add-port">
        <button
          type="button"
          className="nodrag nopan"
          aria-label={input ? 'Add input' : 'Add output'}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setEditing(ports.length)}
        >
          +
        </button>
      </li>
    </ul>
  )
}

interface PortGripProps {
  name: string
  index: number
  onMove: (to: number) => void
  onDrag: (to: number | null) => void
}
function PortGrip({ name, index, onMove, onDrag }: PortGripProps) {
  const dragging = useRef(false)
  // Rows are measured at event time because their heights vary with the names being edited.
  const rowAt = (e: PointerEvent<HTMLElement>) => {
    const rows = Array.from(e.currentTarget.closest('ul')!.querySelectorAll('li:not(.add-port)'))
    const hit = rows.findIndex((r) => e.clientY < r.getBoundingClientRect().bottom)
    return hit === -1 ? rows.length - 1 : hit
  }
  const end = (e: PointerEvent<HTMLElement>, commit: boolean) => {
    if (!dragging.current) return
    dragging.current = false
    onDrag(null)
    if (commit) onMove(rowAt(e))
  }
  return (
    <button
      type="button"
      className="grip-port nodrag nopan"
      aria-label={`Move ${name}`}
      onPointerDown={(e) => {
        // Keeps the press from starting a node drag or selection.
        e.stopPropagation()
        // Capture keeps move and up events coming here after the pointer leaves the button.
        e.currentTarget.setPointerCapture(e.pointerId)
        dragging.current = true
        onDrag(index)
      }}
      onPointerMove={(e) => dragging.current && onDrag(rowAt(e))}
      onPointerUp={(e) => end(e, true)}
      onPointerCancel={(e) => end(e, false)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp') onMove(index - 1)
        if (e.key === 'ArrowDown') onMove(index + 1)
      }}
    >
      ⋮⋮
    </button>
  )
}
function PortInput({ initial, onDone }: { initial: string; onDone: (value: string) => void }) {
  const [draft, setDraft] = useState(initial)
  const el = useRef<HTMLInputElement>(null)
  // Unmounting a focused input can still deliver a blur; this keeps Escape from committing through it.
  const finished = useRef(false)

  useEffect(() => {
    el.current?.focus()
    el.current?.select()
  }, [])

  const finish = (value: string) => {
    if (finished.current) return
    finished.current = true
    onDone(value)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') finish(draft)
    // Escape reverts; for a port being added that means abandoning it.
    if (e.key === 'Escape') finish(initial)
  }

  return (
    <input
      ref={el}
      type="text"
      className="nodrag nopan"
      aria-label="Port name"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={onKeyDown}
      onBlur={() => finish(draft)}
      // Selecting text inside the input must not restart the edit.
      onDoubleClick={(e) => e.stopPropagation()}
    />
  )
}
