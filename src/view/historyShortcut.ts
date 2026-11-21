export type ShortcutEvent = {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  target: EventTarget | null
}

// Checks structurally instead of `instanceof Element` so it also runs in the DOM-less test environment.
export function isTextInput(target: EventTarget | null): boolean {
  const el = target as { tagName?: string; isContentEditable?: boolean } | null
  return el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.isContentEditable === true
}

export function shortcutAction(e: ShortcutEvent, isMac: boolean): 'undo' | 'redo' | null {
  const primary = isMac ? e.metaKey : e.ctrlKey
  const other = isMac ? e.ctrlKey : e.metaKey
  if (!primary || other || e.key.toLowerCase() !== 'z') return null
  // Text inputs keep the browser's native text undo.
  if (isTextInput(e.target)) return null
  return e.shiftKey ? 'redo' : 'undo'
}
