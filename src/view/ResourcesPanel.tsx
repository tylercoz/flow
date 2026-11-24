import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { Resource } from '../domain/Resource'
import { RESOURCE_KINDS, type ResourceKind } from '../domain/ResourceKinds'
import { useApp } from './AppProvider'
import { KIND_LABELS } from './ResourcePicker'
import { ResourceIcon } from './resourceIcons'
import { useStore } from './useStore'
export function ResourcesPanel({ onFind }: { onFind: (resourceId: string) => void }) {
  const { workspace } = useApp()
  useStore(workspace)
  const [editingId, setEditingId] = useState<string | null>(null)
  const resources = workspace.resources.all
  if (resources.length === 0) return <p className="inspector-empty">No resources yet.</p>
  return (
    <>
      {(Object.keys(RESOURCE_KINDS) as ResourceKind[]).map((kind) => {
        const ofKind = workspace.resources.byKind(kind)
        if (ofKind.length === 0) return null
        return (
          <section key={kind} aria-label={KIND_LABELS[kind]}>
            <h3 className="resource-section-title">
              {KIND_LABELS[kind]} ({ofKind.length})
            </h3>
            <ul className="resource-list">
              {ofKind.map((resource) => (
                <li key={resource.id} className="resource-item" onClick={() => onFind(resource.id)} onDoubleClick={() => setEditingId(resource.id)}>
                  <ResourceIcon kind={resource.kind} />{' '}
                  {editingId === resource.id ? (
                    <NameInput resource={resource} onDone={() => setEditingId(null)} />
                  ) : (
                    resource.name || 'Unnamed'
                  )}
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </>
  )
}
function NameInput({ resource, onDone }: { resource: Resource; onDone: () => void }) {
  const [draft, setDraft] = useState(resource.name)
  const input = useRef<HTMLTextAreaElement>(null)
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
    // Shift+Enter falls through to the textarea's default and inserts a newline.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      finish(true)
    }
    if (e.key === 'Escape') finish(false)
  }
  return (
    <textarea
      ref={input}
      rows={draft.split('\n').length}
      aria-label="Resource name"
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={onKeyDown}
      onBlur={() => finish(true)}
    />
  )
}
