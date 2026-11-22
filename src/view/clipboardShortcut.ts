import { isTextInput } from './historyShortcut'

type ShortcutEvent = {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
  target: EventTarget | null
}

export function clipboardAction(e: ShortcutEvent, isMac: boolean): 'copy' | 'paste' | 'duplicate' | null {
  const primary = isMac ? e.metaKey : e.ctrlKey
  const other = isMac ? e.ctrlKey : e.metaKey
  if (!primary || other || e.shiftKey || e.altKey) return null
  // Text inputs keep the browser's native copy and paste.
  if (isTextInput(e.target)) return null
  const key = e.key.toLowerCase()
  return key === 'c' ? 'copy' : key === 'v' ? 'paste' : key === 'd' ? 'duplicate' : null
}

// A duplicate is a paste next to the original, so it doesn't land exactly on top of it.
export const DUPLICATE_OFFSET = 24
