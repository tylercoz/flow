import { useEffect, type ReactNode } from 'react'
import { useApp } from './AppProvider'
import { isTextInput } from './historyShortcut'

// Scopes one History group to one Text_Input focus session, so per-keystroke writes become one undo step.
export function FocusGroup({ children, className }: { children: ReactNode; className?: string }) {
  const { history } = useApp()

  // React does not fire blur when a focused field unmounts, which would leave the group open.
  useEffect(() => () => history.endGroup(), [history])

  return (
    <div
      className={className}
      onFocus={(e) => {
        if (isTextInput(e.target)) history.beginGroup()
      }}
      onBlur={(e) => {
        if (isTextInput(e.target)) history.endGroup()
      }}
    >
      {children}
    </div>
  )
}
