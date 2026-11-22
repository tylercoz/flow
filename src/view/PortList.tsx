import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NewPort, Port } from '../domain/Port'
import { applyPortName } from './portEdit'

interface PortListProps {
  ports: readonly Port[]
  field: 'inputs' | 'outputs'
  onChange: (ports: NewPort[]) => void
}

export function PortList({ ports, field, onChange }: PortListProps) {
  // Index of the port being edited; one past the end is a port being added.
  const [editing, setEditing] = useState<number | null>(null)

  const commit = (index: number, name: string) => {
    setEditing(null)
    const next = applyPortName(ports, index, name.trim())
    if (next) onChange(next)
  }

  const input = field === 'inputs'
  return (
    <ul className={`component-ports ${input ? 'input' : 'output'}-ports`} aria-label={input ? 'Inputs' : 'Outputs'}>
      {[...ports.map((p) => p.name), ...(editing === ports.length ? [''] : [])].map((name, i) => (
        <li key={ports[i]?.id ?? 'new'} onDoubleClick={() => setEditing(i)}>
          {/* A port being added has no id yet, so it gets its Handle once it is committed. */}
          {ports[i] && (
            <Handle id={ports[i].id} type={input ? 'target' : 'source'} position={input ? Position.Left : Position.Right} />
          )}
          {editing === i ? <PortInput initial={name} onDone={(value) => commit(i, value)} /> : name}
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
