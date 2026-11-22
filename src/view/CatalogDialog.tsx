import { useState } from 'react'
import { FocusGroup } from './FocusGroup'

interface CatalogDialogProps {
  title: string
  /** Singular, lower-case: "environment variable". Builds the aria-labels and button text. */
  noun: string
  entries: readonly { id: string; name: string }[]
  /** How many Components use an entry. Omit when removal needs no confirmation. */
  usage?: (id: string) => number
  onAdd: () => void
  onRename: (id: string, name: string) => void
  onRemove: (id: string) => void
  onClose: () => void
}

export function CatalogDialog({ title, noun, entries, usage, onAdd, onRename, onRemove, onClose }: CatalogDialogProps) {
  // The entry awaiting confirmation, with how many Components lose it.
  const [pending, setPending] = useState<{ id: string; uses: number } | null>(null)
  const label = noun[0].toUpperCase() + noun.slice(1)
  const titleId = `confirm-${noun.replace(' ', '-')}-title`
  // Removing an unused entry loses nothing, so only used ones need a confirmation.
  const remove = (id: string) => {
    const uses = usage?.(id) ?? 0
    if (uses === 0) onRemove(id)
    else setPending({ id, uses })
  }
  const confirm = () => {
    if (pending) onRemove(pending.id)
    setPending(null)
  }
  return (
    <div className="dialog-backdrop">
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title}>
        <FocusGroup className="dialog-fields">
          {entries.map((entry, i) => (
            <div className="field-row" key={entry.id}>
              <input type="text" aria-label={`${label} ${i + 1} name`} value={entry.name} onChange={(e) => onRename(entry.id, e.target.value)} />
              <button type="button" aria-label={`Remove ${noun} ${i + 1}`} onClick={() => remove(entry.id)}>
                ×
              </button>
            </div>
          ))}
        </FocusGroup>
        {pending && (
          <div role="alertdialog" aria-labelledby={titleId}>
            <p id={titleId}>
              Used by {pending.uses} component{pending.uses === 1 ? '' : 's'}. Remove it from {pending.uses === 1 ? 'it' : 'them'} and delete?
            </p>
            <button type="button" onClick={() => setPending(null)}>
              Cancel
            </button>
            <button type="button" className="btn-danger" onClick={confirm}>
              Delete
            </button>
          </div>
        )}
        <button type="button" onClick={onAdd}>
          Add {noun}
        </button>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
