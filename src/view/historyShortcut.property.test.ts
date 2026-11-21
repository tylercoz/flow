import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { shortcutAction } from './historyShortcut'

const target = fc.constantFrom<EventTarget | null>(
  null,
  { tagName: 'DIV' } as unknown as EventTarget,
  { tagName: 'BUTTON' } as unknown as EventTarget,
  { tagName: 'INPUT' } as unknown as EventTarget,
  { tagName: 'TEXTAREA' } as unknown as EventTarget,
  { tagName: 'DIV', isContentEditable: true } as unknown as EventTarget,
)

const key = fc.oneof(fc.constantFrom('z', 'Z', 'y', 'a', 'Enter'), fc.string({ maxLength: 2 }))

const event = fc.record({
  key,
  metaKey: fc.boolean(),
  ctrlKey: fc.boolean(),
  shiftKey: fc.boolean(),
  target,
})

function isTextTarget(t: EventTarget | null): boolean {
  const el = t as { tagName?: string; isContentEditable?: boolean } | null
  return el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.isContentEditable === true
}

describe('Property 9: Shortcut classification', () => {
  /**
   * **Validates: Requirements 5.1, 5.2, 5.3**
   */
  it('returns undo or redo exactly when the key is z, only the primary modifier is held and the target is not a text input', () => {
    fc.assert(
      fc.property(event, fc.boolean(), (e, isMac) => {
        const primary = isMac ? e.metaKey : e.ctrlKey
        const other = isMac ? e.ctrlKey : e.metaKey
        const handled = e.key.toLowerCase() === 'z' && primary && !other && !isTextTarget(e.target)
        const expected = handled ? (e.shiftKey ? 'redo' : 'undo') : null
        expect(shortcutAction(e, isMac)).toBe(expected)
      }),
      { numRuns: 500 },
    )
  })
})
