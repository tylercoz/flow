import type { Describable } from '../domain/Describable'
import type { Port } from '../domain/Details'
import type { Diagram } from '../domain/Diagram'
import { useApp } from './AppProvider'
import type { DeleteFlow } from './DeleteFlow'
import { FocusGroup } from './FocusGroup'
import { useStore } from './useStore'

export interface InspectorProps {
  /** The selected Component. App renders no Inspector when nothing is selected. */
  item: Describable
  /** Sidebar width in px; owned by App so it survives selection changes. */
  width: number
  /** The Diagram that contains `item`; DeleteFlow removes it from here. */
  diagram: Diagram
  deleteFlow: DeleteFlow
}

type Field = 'name' | 'notes'
type ListField = 'inputs' | 'outputs'

export function Inspector({ item, diagram, deleteFlow, width }: InspectorProps) {
  // Re-render on every model change so the inputs always show the live values.
  const { workspace } = useApp()
  useStore(workspace)
  const { details } = item
  const idPrefix = `inspector-${item.id}`

  const input = (field: Field, label: string, multiline: boolean) => {
    const common = {
      id: `${idPrefix}-${field}`,
      value: details[field],
      onChange: (e: { target: { value: string } }) => details.patch({ [field]: e.target.value }),
    }
    return (
      <div>
        <label htmlFor={common.id}>{label}</label>
        {multiline ? <textarea {...common} rows={4} /> : <input type="text" {...common} />}
      </div>
    )
  }

  // Entries are positional, so edits replace the whole list.
  const list = (field: ListField, label: string, noun: string) => {
    const ports = details[field]
    const set = (next: Port[]) => details.patch({ [field]: next })
    const update = (i: number, change: Partial<Port>) => set(ports.map((p, j) => (j === i ? { ...p, ...change } : p)))
    return (
      <div>
        <label>{label}</label>
        {ports.map((port, i) => (
          <div className="field-row" key={i}>
            <input type="text" aria-label={`${noun} ${i + 1} name`} value={port.name} onChange={(e) => update(i, { name: e.target.value })} />
            <select aria-label={`${noun} ${i + 1} type`} value={port.typeId ?? ''} onChange={(e) => update(i, { typeId: e.target.value || null })}>
              <option value="">No type</option>
              {workspace.types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name || 'Unnamed type'}
                </option>
              ))}
            </select>
            <button type="button" aria-label={`Remove ${noun} ${i + 1}`} onClick={() => set(ports.filter((_, j) => j !== i))}>
              ×
            </button>
          </div>
        ))}
        <button type="button" onClick={() => set([...ports, { name: '', typeId: null }])}>
          Add {noun}
        </button>
      </div>
    )
  }
  return (
    <aside className="inspector" style={{ width }} aria-label="Component details">
      <FocusGroup className="inspector-fields">
        {input('name', 'Name', false)}
        {list('inputs', 'Inputs', 'input')}
        {list('outputs', 'Outputs', 'output')}
        {input('notes', 'Notes', true)}
      </FocusGroup>
      <button type="button" className="btn-danger" onClick={() => deleteFlow.request(diagram, { kind: 'component', id: item.id })}>
        Delete component
      </button>
    </aside>
  )
}
