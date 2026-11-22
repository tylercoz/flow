import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { Resource } from '../domain/Resource'
import { useApp } from './AppProvider'
import { ResourceIcon } from './resourceIcons'
import { useStore } from './useStore'
export function ResourcesPanel() {
  const { workspace } = useApp()
  useStore(workspace)
  const [editingId, setEditingId] = useState<string | null>(null)
  const resources = workspace.resources.all
  if (resources.length === 0) return <p className="inspector-empty">No resources yet.</p>
  return (
    <ul className="resource-list">
      {resources.map((resource) => (
        <li key={resource.id} onDoubleClick={() => setEditingId(resource.id)}>
          <ResourceIcon kind={resource.kind} />{' '}
          {editingId === resource.id ? (
            <NameInput resource={resource} onDone={() => setEditingId(null)} />
          ) : (
            resource.name || 'Unnamed'
          )}
        </li>
      ))}
    </ul>
  )
}
function NameInput({ resource, onDone }: { resource: Resource; onDone: () => void }) {
  const [draft, setDraft] = useState(resource.name)
  const input = useRef<HTMLInputElement>(null)
  // Unmounting a focused input can still deliver a blur; this keeps Escape from committing through it.
  const finished = useRef(false)
  useEffect(() => input.current?.select(), [])
  const finish = (commit: boolean) => {
    if (finished.current) return
    finished.current = true
    // One setName per edit, so Undo reverts the whole rename in one step.
    if (commit) resource.setName(draft)
    onDone()
  }
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') finish(true)
    if (e.key === 'Escape') finish(false)
  }
  return (
    <input
      ref={input}
      type="text"
      aria-label="Resource name"
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={onKeyDown}
      onBlur={() => finish(true)}
    />
  )
}
