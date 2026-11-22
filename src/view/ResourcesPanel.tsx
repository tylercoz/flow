import { useApp } from './AppProvider'
import { ResourceIcon } from './resourceIcons'
import { useStore } from './useStore'
export function ResourcesPanel() {
  const { workspace } = useApp()
  useStore(workspace)
  const resources = workspace.resources.all
  if (resources.length === 0) return <p className="inspector-empty">No resources yet.</p>
  return (
    <ul className="resource-list">
      {resources.map((resource) => (
        <li key={resource.id}>
          <ResourceIcon kind={resource.kind} /> {resource.name || 'Unnamed'}
        </li>
      ))}
    </ul>
  )
}
