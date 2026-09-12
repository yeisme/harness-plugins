import { createHash } from 'node:crypto'
import { expect, it, vi } from 'vitest'
import { inspectEikonaMediaAccess, readEikonaMediaBytes } from '../src/eikona-media-access.ts'
const now = Date.parse('2026-09-08T00:00:00Z')
const expected = { artifactRef: 'eikona://artifacts/run/one', contentDigest: 'a'.repeat(64), mediaBaseURL: 'http://127.0.0.1:12345' }
const grant = () => ({ schema_version: 'eikona.artifact_access_grant.v1', artifact_uri: expected.artifactRef, sha256: expected.contentDigest,
  size_bytes: 64, grant_id: `grant_${'b'.repeat(32)}`, expires_at: '2026-09-08T00:15:00Z', url: `${expected.mediaBaseURL}/api/v1/artifact-access/acc_${'c'.repeat(48)}` })
it('accepts only fixed owner content at the configured ephemeral media route', () => {
  expect(inspectEikonaMediaAccess(grant(), expected, now)).toMatchObject({ contentDigest: expected.contentDigest, byteLength: 64 })
})
it('rejects changed content, expired grants, oversized bodies and redirected authority', () => {
  for (const changed of [{ sha256: 'd'.repeat(64) }, { artifact_uri: 'eikona://artifacts/run/two' }, { expires_at: '2026-09-08T00:00:00Z' },
    { expires_at: '2026-09-10T00:00:00Z' }, { size_bytes: 128 * 1024 * 1024 + 1 }, { url: grant().url.replace('127.0.0.1', 'example.com') },
    { url: grant().url + '?token=extra' }, { url: grant().url + '#extra' }, { url: grant().url.replace('/artifact-access/', '/downloads/') }]) {
    expect(inspectEikonaMediaAccess({ ...grant(), ...changed }, expected, now)).toBeUndefined()
  }
})
it('does not silently accept a different canonical URI even when its digest matches', () => {
  expect(inspectEikonaMediaAccess({ ...grant(), artifact_uri: 'eikona://artifact/alias' }, expected, now)).toBeUndefined()
})

it('verifies byte length and content digest without forwarding credentials or retrying', async () => {
  const bytes = new Uint8Array([137, 80, 78, 71])
  const access = { url: grant().url, expiresAt: new Date(Date.now() + 60000).toISOString(), byteLength: bytes.length, contentDigest: createHash('sha256').update(bytes).digest('hex'), grantRef: grant().grant_id }
  const fetcher = vi.fn<typeof fetch>(async () => new Response(bytes, { headers: { 'content-type': 'image/png' } }))
  expect((await readEikonaMediaBytes(access, fetcher))?.bytes).toEqual(bytes)
  expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ credentials: 'omit', redirect: 'error', method: 'GET' })
  expect(fetcher.mock.calls[0]?.[1]?.headers).toBeUndefined()
  expect(await readEikonaMediaBytes({ ...access, contentDigest: 'e'.repeat(64) }, fetcher)).toBeUndefined()
  expect(await readEikonaMediaBytes({ ...access, byteLength: 3 }, fetcher)).toBeUndefined()
  expect(await readEikonaMediaBytes({ ...access, byteLength: 5 }, fetcher)).toBeUndefined()
  expect(fetcher).toHaveBeenCalledTimes(4)
})
