import { availableEntries } from './idListEdit'

interface IdListEditorProps {
  label: string
  /** Singular, lower-case: "exception". Builds the aria-labels, select id and placeholder. */
  noun: string
  entries: readonly { id: string; name: string }[]
  chosen: readonly string[]
  /** Prefix that keeps the add select's id unique per Inspector. */
  idPrefix: string
  onChange: (ids: string[]) => void
}

export function IdListEditor({ label, noun, entries, chosen, idPrefix, onChange }: IdListEditorProps) {
  const names = new Map(entries.map((e) => [e.id, e.name]))
  const available = availableEntries(entries, chosen)
  const addId = `${idPrefix}-add-${noun.replace(' ', '-')}`
  return (
    <div>
      <label htmlFor={addId}>{label}</label>
      {chosen.map((id, i) => (
        <div className="field-row" key={id}>
          <span>{names.get(id) || `Unnamed ${noun}`}</span>
          <button type="button" aria-label={`Remove ${noun} ${i + 1}`} onClick={() => onChange(chosen.filter((c) => c !== id))}>
            ×
          </button>
        </div>
      ))}
      {/* Controlled at '' so choosing an entry adds it and the select returns to its prompt. */}
      <select id={addId} value="" disabled={available.length === 0} onChange={(e) => onChange([...chosen, e.target.value])}>
        <option value="">Add {noun}</option>
        {available.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name || `Unnamed ${noun}`}
          </option>
        ))}
      </select>
    </div>
  )
}
