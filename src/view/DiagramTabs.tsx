import { useState, type KeyboardEvent } from 'react'
import { useApp } from './AppProvider'
import { useStore } from './useStore'

export function DiagramTabs() {
  const { workspace, navigator } = useApp()
  useStore(workspace)
  useStore(navigator)
  const [editingId, setEditingId] = useState<string | null>(null)
  const viewing = navigator.root
  const onlyOne = workspace.diagrams.length === 1

  const add = () => {
    const diagram = workspace.addDiagram(`Diagram ${workspace.diagrams.length + 1}`)
    navigator.openDiagram(diagram.id)
  }

  const remove = (id: string) => {
    const { nodes } = workspace.diagramImpact(id)
    // Resources placed only here are deleted too, so a non-empty diagram needs a confirmation.
    if (nodes > 0 && !window.confirm(`Delete this diagram and its ${nodes} item${nodes === 1 ? '' : 's'}? Resources used nowhere else are deleted too.`)) return
    // Leave the diagram first, so the Navigator never points at a diagram that no longer exists.
    if (viewing.id === id) navigator.openDiagram(workspace.diagrams.find((d) => d.diagram.id !== id)!.diagram.id)
    workspace.removeDiagram(id)
  }

  return (
    <div className="tab-list diagram-tabs" role="tablist" aria-label="Diagrams">
      {workspace.diagrams.map(({ name, diagram }) => {
        const selected = diagram.id === viewing.id
        return editingId === diagram.id ? (
          <NameInput key={diagram.id} name={name} onDone={(value) => { if (value !== null) workspace.renameDiagram(diagram.id, value); setEditingId(null) }} />
        ) : (
          <span key={diagram.id} className="diagram-tab">
            <button
              type="button"
              role="tab"
              className="tab"
              aria-selected={selected}
              title="Double-click to rename"
              onClick={() => navigator.openDiagram(diagram.id)}
              onDoubleClick={() => setEditingId(diagram.id)}
            >
              {name || 'Untitled'}
            </button>
            {selected && !onlyOne && (
              <button type="button" aria-label={`Delete diagram ${name || 'Untitled'}`} onClick={() => remove(diagram.id)}>
                ×
              </button>
            )}
          </span>
        )
      })}
      <button type="button" aria-label="Add diagram" onClick={add}>
        +
      </button>
    </div>
  )
}

// Enter or blur keeps the text, Escape discards it.
function NameInput({ name, onDone }: { name: string; onDone: (value: string | null) => void }) {
  const [draft, setDraft] = useState(name)
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') onDone(draft)
    if (e.key === 'Escape') onDone(null)
  }
  return (
    <input
      type="text"
      aria-label="Diagram name"
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={onKeyDown}
      onBlur={() => onDone(draft)}
    />
  )
}
