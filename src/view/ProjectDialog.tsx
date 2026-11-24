import { useApp } from './AppProvider'
import { FocusGroup } from './FocusGroup'
import { useStore } from './useStore'

const formatTime = (iso: string) => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString()
}

export function ProjectDialog({ onClose }: { onClose: () => void }) {
  const { workspace } = useApp()
  useStore(workspace)
  const { name, description, createdAt, updatedAt } = workspace.project
  return (
    <div className="dialog-backdrop">
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Project">
        <FocusGroup className="dialog-fields">
          <label className="field-row">
            Name
            <input type="text" value={name} onChange={(e) => workspace.setProjectName(e.target.value)} />
          </label>
          <label className="field-row">
            Description
            <textarea rows={4} value={description} onChange={(e) => workspace.setProjectDescription(e.target.value)} />
          </label>
        </FocusGroup>
        <p>Created {formatTime(createdAt)}</p>
        <p>Last saved to a file {formatTime(updatedAt)}</p>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
