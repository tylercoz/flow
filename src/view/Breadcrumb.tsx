import { useApp } from './AppProvider'
import { useStore } from './useStore'

// Subscribes to the Workspace as well as the Navigator: the path holds ids only,
// so a rename changes the Workspace, not the Navigator.
export function Breadcrumb() {
  const { workspace, navigator } = useApp()
  useStore(workspace)
  useStore(navigator)
  const trail = navigator.trail()

  const labels = ['Root', ...trail.map((c) => c.details.name || 'Untitled')]
  return (
    <nav aria-label="Diagram path">
      <ol style={{ display: 'flex', gap: 8, listStyle: 'none', margin: 0, padding: 0 }}>
        {labels.map((label, index) => {
          const isCurrent = index === labels.length - 1
          return (
            <li key={index}>
              {index > 0 && <span aria-hidden="true">/ </span>}
              <button type="button" aria-current={isCurrent ? 'page' : undefined} disabled={isCurrent} onClick={() => navigator.navigateTo(index)}>
                {label}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
