import type { Component } from '../domain/Component'
import type { NewPort, Port } from '../domain/Details'
import type { Diagram } from '../domain/Diagram'
import { useApp } from './AppProvider'
import type { DeleteFlow } from './DeleteFlow'
import { availableEnvironmentVariables } from './environmentVariableEdit'
import { availableExceptions } from './exceptionEdit'
import { FocusGroup } from './FocusGroup'
import { useStore } from './useStore'

interface InspectorProps {
  /** The selected Component. App renders no Inspector when nothing is selected. */
  item: Component
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

  // Edits replace the whole list; Diagram.setPorts also drops the Links of removed ports.
  const list = (field: ListField, label: string, noun: string) => {
    const ports = details[field]
    const set = (next: NewPort[]) => diagram.setPorts(item.id, field, next)
    const update = (i: number, change: Partial<Port>) => set(ports.map((p, j) => (j === i ? { ...p, ...change } : p)))
    return (
      <div>
        <label>{label}</label>
        {ports.map((port, i) => (
          <div className="field-row" key={port.id}>
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
  const exceptions = () => {
    const names = new Map(workspace.exceptions.map((e) => [e.id, e.name]))
    const available = availableExceptions(workspace.exceptions, item.exceptionIds)
    return (
      <div>
        <label htmlFor={`${idPrefix}-add-exception`}>Exceptions</label>
        {item.exceptionIds.map((id, i) => (
          <div className="field-row" key={id}>
            <span>{names.get(id) || 'Unnamed exception'}</span>
            <button
              type="button"
              aria-label={`Remove exception ${i + 1}`}
              onClick={() => item.setExceptions(item.exceptionIds.filter((e) => e !== id))}
            >
              ×
            </button>
          </div>
        ))}
        {/* Controlled at '' so choosing an entry adds it and the select returns to its prompt. */}
        <select
          id={`${idPrefix}-add-exception`}
          value=""
          disabled={available.length === 0}
          onChange={(e) => item.setExceptions([...item.exceptionIds, e.target.value])}
        >
          <option value="">Add exception</option>
          {available.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name || 'Unnamed exception'}
            </option>
          ))}
        </select>
      </div>
    )
  }
  const environmentVariables = () => {
    const names = new Map(workspace.environmentVariables.map((v) => [v.id, v.name]))
    const available = availableEnvironmentVariables(workspace.environmentVariables, item.environmentVariableIds)
    return (
      <div>
        <label htmlFor={`${idPrefix}-add-environment-variable`}>Environment variables</label>
        {item.environmentVariableIds.map((id, i) => (
          <div className="field-row" key={id}>
            <span>{names.get(id) || 'Unnamed environment variable'}</span>
            <button
              type="button"
              aria-label={`Remove environment variable ${i + 1}`}
              onClick={() => item.setEnvironmentVariables(item.environmentVariableIds.filter((v) => v !== id))}
            >
              ×
            </button>
          </div>
        ))}
        {/* Controlled at '' so choosing an entry adds it and the select returns to its prompt. */}
        <select
          id={`${idPrefix}-add-environment-variable`}
          value=""
          disabled={available.length === 0}
          onChange={(e) => item.setEnvironmentVariables([...item.environmentVariableIds, e.target.value])}
        >
          <option value="">Add environment variable</option>
          {available.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name || 'Unnamed environment variable'}
            </option>
          ))}
        </select>
      </div>
    )
  }
  return (
    <aside className="inspector" style={{ width }} aria-label="Component details">
      <FocusGroup className="inspector-fields">
        {input('name', 'Name', false)}
        {list('inputs', 'Inputs', 'input')}
        {list('outputs', 'Outputs', 'output')}
        {exceptions()}
        {environmentVariables()}
        {input('notes', 'Notes', true)}
      </FocusGroup>
      <button type="button" className="btn-danger" onClick={() => deleteFlow.request(diagram, { kind: 'component', id: item.id })}>
        Delete component
      </button>
    </aside>
  )
}
