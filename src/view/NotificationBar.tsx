import { useApp } from './AppProvider'
import { useStore } from './useStore'

export function NotificationBar() {
  const { notifier } = useApp()
  useStore(notifier)

  return (
    <div aria-label="Notifications">
      {notifier.messages.map((message) => (
        // Errors (save/load/link) need to be announced without moving focus.
        <div key={message.key} role="alert">
          <span>{message.text}</span>
          {message.kind === 'transient' && (
            <button type="button" aria-label={`Dismiss: ${message.text}`} onClick={() => notifier.clear(message.key)}>
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
