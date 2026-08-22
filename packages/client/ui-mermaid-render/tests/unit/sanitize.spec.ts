// @vitest-environment jsdom
import { sanitizeMermaidSvg } from '../../src/client/sanitize.ts'
import { describe, expect, it } from 'vitest'

describe('sanitizeMermaidSvg', () => {
  it('strips scripts, foreignObject, unknown tags, event attrs and url()', () => {
    const evil = `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script>` +
      `<foreignObject><div onclick="x">hi</div></foreignObject>` +
      `<rect width="10" height="10" fill="url(#x)" onclick="steal()"/>` +
      `<animate attributeName="x" to="100"/><g transform="translate(1,2)">` +
      `<path d="M0 0" fill="red"/></g><style>.a{background:url(http://evil)}</style></svg>`
    const clean = sanitizeMermaidSvg(evil)
    expect(clean).not.toContain('script')
    expect(clean).not.toContain('foreignObject')
    expect(clean).not.toContain('animate')
    expect(clean).not.toContain('onclick')
    expect(clean).not.toContain('url(')
    expect(clean).toContain('<path')
    expect(clean).toContain('translate(1,2)')
    expect(clean).toContain('max-width:100%')
  })

  it('throws when the output is not an svg document', () => {
    expect(() => sanitizeMermaidSvg('<p>not svg</p>')).toThrow()
  })
})
