import type { Describable } from '../domain/Describable'
import type { Diagram } from '../domain/Diagram'
import { useApp } from './AppProvider'
import type { DeleteFlow } from './DeleteFlow'
import { useStore } from './useStore'

export interface InspectorProps {
  /** The selected Component or Link. App renders no Inspector when nothing is selected. */
  item: Describable
  /** What `item` is, so DeleteFlow can pick confirm-first (component) or direct (link) deletion. */
  kind: 'component' | 'link'
  /** The Diagram that contains `item`; DeleteFlow removes it from here. */
  diagram: Diagram
  deleteFlow: DeleteFlow
}

type Field = 'name' | 'description' | 'notes'

export function Inspector({ item, kind, diagram, deleteFlow }: InspectorProps) {
  // Re-render on every model change so the inputs always show the live values.
  useStore(useApp().workspace)
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

  return (
    <aside aria-label={kind === 'component' ? 'Component details' : 'Link details'}>
      {input('name', 'Name', false)}
      {input('description', 'Description', true)}
      {input('notes', 'Notes', true)}
      <button type="button" onClick={() => deleteFlow.request(diagram, { kind, id: item.id })}>
        Delete {kind}
      </button>
    </aside>
  )
}
