import { describe, expect, test } from 'vitest'
import { mentionSessionId, parseSessionLocation, sessionUrl } from '../src/codec.ts'

describe('parseSessionLocation（path 优于 query）', () => {
  test.each([
    ['canonical path', { pathname: '/s/abc123', search: '' }, 'abc123', 'path'],
    ['query alias', { pathname: '/', search: '?s=abc123' }, 'abc123', 'query'],
    ['query among other params', { pathname: '/', search: '?tab=x&s=abc123&ui=dark' }, 'abc123', 'query'],
    ['path and query agree', { pathname: '/s/abc123', search: '?s=abc123' }, 'abc123', 'path'],
    ['path and query disagree → path wins, query ignored', { pathname: '/s/abc123', search: '?s=other9' }, 'abc123', 'path'],
    ['invalid path id does not fall back to query', { pathname: '/s/bad id!', search: '?s=abc123' }, null, null],
    ['empty path segment', { pathname: '/s/' }, null, null],
    ['trailing slash is not canonical', { pathname: '/s/abc123/' }, null, null],
    ['extra segments are invalid', { pathname: '/s/abc123/extra' }, null, null],
    ['unrelated path', { pathname: '/settings/sessions' }, null, null],
    ['root without query', { pathname: '/', search: '' }, null, null],
    ['empty s value', { pathname: '/', search: '?s=' }, null, null],
    ['invalid s value', { pathname: '/', search: '?s=%2Fetc%2Fpasswd' }, null, null],
    ['oversized id', { pathname: '/', search: `?s=${'a'.repeat(200)}` }, null, null],
    ['percent-encoded id decodes once', { pathname: '/s/abc%2D123' }, 'abc-123', 'path'],
    ['query without leading ?', { pathname: '/', search: 's=abc123' }, 'abc123', 'query'],
    ['missing fields', {}, null, null],
  ])('%s', (_name, location, sessionId, source) => {
    expect(parseSessionLocation(location as never)).toEqual({ sessionId, source })
  })

  test('file:// alias works via query (Electron)', () => {
    const url = new URL('file:///app/index.html?s=abc123')
    expect(parseSessionLocation(url)).toEqual({ sessionId: 'abc123', source: 'query' })
  })

  test('URL instance with reserved hash anchor still resolves the session', () => {
    const url = new URL('http://127.0.0.1:3080/s/abc123#msg-42')
    expect(parseSessionLocation(url)).toEqual({ sessionId: 'abc123', source: 'path' })
  })
})

describe('sessionUrl（生成 URL 无 secret）', () => {
  test.each([
    ['canonical by default', { origin: 'http://127.0.0.1:3080', sessionId: 'abc123' }, 'http://127.0.0.1:3080/s/abc123'],
    ['alias form', { origin: 'http://127.0.0.1:3080', sessionId: 'abc123', form: 'alias' }, 'http://127.0.0.1:3080/?s=abc123'],
    ['trailing slash collapsed', { origin: 'http://localhost:40869/', sessionId: 'abc123' }, 'http://localhost:40869/s/abc123'],
    ['file origin canonical', { origin: 'file://', sessionId: 'abc123' }, 'file:///s/abc123'],
  ])('%s', (_name, input, expected) => {
    expect(sessionUrl(input as never)).toBe(expected)
  })

  test.each([
    ['userinfo in origin', { origin: 'http://user:pass@127.0.0.1:3080', sessionId: 'abc123' }],
    ['invalid session id', { origin: 'http://127.0.0.1:3080', sessionId: 'bad id!' }],
    ['empty session id', { origin: 'http://127.0.0.1:3080', sessionId: '' }],
    ['empty origin', { origin: '', sessionId: 'abc123' }],
  ])('%s throws', (_name, input) => {
    expect(() => sessionUrl(input as never)).toThrow(TypeError)
  })
})

describe('mentionSessionId', () => {
  test.each([
    ['canonical mention', 'dsh-session:abc123', 'abc123'],
    ['mention with dashes and dots', 'dsh-session:sess.1-2_3', 'sess.1-2_3'],
    ['percent-encoded mention', 'dsh-session:abc%2D123', 'abc-123'],
    ['missing id', 'dsh-session:', null],
    ['invalid id', 'dsh-session:/etc/passwd', null],
    ['not a session mention', 'dsh-skills:writer', null],
  ])('%s', (_name, uri, expected) => {
    expect(mentionSessionId(uri)).toBe(expected)
  })
})

describe('query-alias-without-friority fixtures (§3.5 P1 兼容硬门槛)', () => {
  test('query-alias-without-fallback: only query, no path route, no fallback needed', () => {
    // 纯上游 location 形状（普通对象，无 URL 实例、无 patch）：?s= 仍然工作。
    expect(parseSessionLocation({ protocol: 'http:', pathname: '/', search: '?s=sess-a' })).toEqual({ sessionId: 'sess-a', source: 'query' })
    expect(parseSessionLocation({ protocol: 'https:', pathname: '/index.html', search: '?other=1&s=sess-b' })).toEqual({ sessionId: 'sess-b', source: 'query' })
  })

  test('query-alias-without-fallback: electron file:// origin parses without http', () => {
    expect(parseSessionLocation({ protocol: 'file:', pathname: '/app/index.html', search: '?s=sess-a' })).toEqual({ sessionId: 'sess-a', source: 'query' })
    expect(sessionUrl({ origin: 'file://', sessionId: 'sess-a', form: 'alias' })).toBe('file:/// ?s=sess-a'.replace(' ', ''))
  })

  test('query-alias-without-fallback: bare upstream root leaves sessions unspecified', () => {
    expect(parseSessionLocation({ protocol: 'http:', pathname: '/', search: '' })).toEqual({ sessionId: null, source: null })
    expect(parseSessionLocation({ protocol: 'http:', pathname: '/assets/app.js', search: '?v=3' })).toEqual({ sessionId: null, source: null })
  })
})
