import { describe, expect, it } from 'vitest'
import { clipboardAction } from './clipboardShortcut'

const base = { metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, target: null }

describe('clipboardAction', () => {
  it('maps Cmd+C and Cmd+V on Mac', () => {
    expect(clipboardAction({ ...base, key: 'c', metaKey: true }, true)).toBe('copy')
    expect(clipboardAction({ ...base, key: 'v', metaKey: true }, true)).toBe('paste')
  })
  it('maps Cmd+D to duplicate', () => {
    expect(clipboardAction({ ...base, key: 'd', metaKey: true }, true)).toBe('duplicate')
  })
  it('maps Ctrl+C and Ctrl+V elsewhere, and ignores Cmd there', () => {
    expect(clipboardAction({ ...base, key: 'c', ctrlKey: true }, false)).toBe('copy')
    expect(clipboardAction({ ...base, key: 'c', metaKey: true }, false)).toBeNull()
  })
  it('ignores the keys without the modifier, with extra modifiers, and in text inputs', () => {
    expect(clipboardAction({ ...base, key: 'c' }, true)).toBeNull()
    expect(clipboardAction({ ...base, key: 'c', metaKey: true, shiftKey: true }, true)).toBeNull()
    const input = { tagName: 'INPUT' } as unknown as EventTarget
    expect(clipboardAction({ ...base, key: 'v', metaKey: true, target: input }, true)).toBeNull()
  })
})
