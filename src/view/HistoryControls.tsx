import { useEffect } from 'react'
import { useApp } from './AppProvider'
import { shortcutAction } from './historyShortcut'
import { useStore } from './useStore'

const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent)

const ARROW = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true } as const

export function HistoryControls() {
  const { history } = useApp()
  useStore(history)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Dialogs hold Diagram objects that a restore would detach.
      if (document.querySelector('[aria-modal="true"]')) return
      const action = shortcutAction(e, isMac)
      if (!action) return
      e.preventDefault()
      history[action]()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [history])

  return (
    <div className="header-action history-controls">
      <button type="button" aria-label="Undo" title={`Undo (${isMac ? '⌘' : 'Ctrl+'}Z)`} disabled={!history.canUndo} onClick={() => history.undo()}>
        <svg {...ARROW}>
          <path d="M12.5 8c-2.65 0-5.05 1-6.9 2.6L2 7v9h9l-3.62-3.62A8 8 0 0 1 20 15.4l2.37-.78C21.1 10.8 17.1 8 12.5 8z" />
        </svg>
      </button>
      <button type="button" aria-label="Redo" title={`Redo (${isMac ? '⌘⇧' : 'Ctrl+Shift+'}Z)`} disabled={!history.canRedo} onClick={() => history.redo()}>
        <svg {...ARROW}>
          <path d="M18.4 10.6A11.9 11.9 0 0 0 11.5 8c-4.6 0-8.6 2.8-9.87 6.62l2.37.78A8 8 0 0 1 16.62 12.4L13 16h9V7l-3.6 3.6z" />
        </svg>
      </button>
    </div>
  )
}
