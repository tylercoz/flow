import { useEffect, useState } from 'react'
import { useApp } from './AppProvider'
import { ProjectDialog } from './ProjectDialog'
import { useStore } from './useStore'

const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent)
const DISCARD = 'Discard unsaved changes?'

export function ProjectControls() {
  const { workspace, projectFiles } = useApp()
  useStore(workspace)
  useStore(projectFiles)
  const [dialogOpen, setDialogOpen] = useState(false)
  const dirty = projectFiles.isDirty

  useEffect(() => {
    document.title = `${dirty ? '• ' : ''}${workspace.project.name || 'Untitled project'} - Flow`
  })

  useEffect(() => {
    // The browser shows its own generic text; setting returnValue is what triggers the prompt.
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!projectFiles.isDirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 's' || e.shiftKey || e.altKey || (isMac ? !e.metaKey : !e.ctrlKey)) return
      // Replaces the browser's own save-page dialog.
      e.preventDefault()
      projectFiles.save()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [projectFiles])

  const confirmDiscard = () => !projectFiles.isDirty || window.confirm(DISCARD)

  return (
    <div className="project-controls">
      <button type="button" onClick={() => setDialogOpen(true)} title="Project name, description and dates">
        {dirty ? '• ' : ''}
        {workspace.project.name || 'Untitled project'}
      </button>
      <button type="button" onClick={() => confirmDiscard() && projectFiles.newProject()}>
        New
      </button>
      <button type="button" onClick={() => confirmDiscard() && void projectFiles.open()}>
        Open
      </button>
      <button type="button" title={`Save (${isMac ? '⌘' : 'Ctrl+'}S)`} onClick={() => projectFiles.save()}>
        Save
      </button>
      {dialogOpen && <ProjectDialog onClose={() => setDialogOpen(false)} />}
    </div>
  )
}
