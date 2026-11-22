import { describe, expect, it } from 'vitest'
import { webUrl } from './webUrl'
describe('webUrl', () => {
  it('accepts http and https', () => {
    expect(webUrl('https://github.com/org/repo')).toBe('https://github.com/org/repo')
    expect(webUrl(' http://example.com ')).toBe('http://example.com/')
  })
  it('rejects other schemes, relative text and empty input', () => {
    for (const v of ['javascript:alert(1)', 'data:text/html,x', 'ftp://example.com', 'github.com/org/repo', 'https://', '']) {
      expect(webUrl(v)).toBeNull()
    }
  })
})
