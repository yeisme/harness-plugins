import { expect, it } from 'vitest'
import { inspectEikonaAssetPage } from '../src/eikona-asset-page.ts'
const row = { artifact_id: 'one', project_id: 'project:a', handle: 'legacy-handle', uri: 'legacy-display', artifact_uri: 'eikona://artifacts/run/one', run_uri: 'eikona://runs/run', title: 'Image', mime_type: 'image/png' }
const input = () => ({ schema_version: 'eikona.asset_graph.v1', assets: [row], count: 1, pagination: { limit: 50, next_cursor: 'opaque-owner-cursor' } })
const expected = { ownerProjectRef: 'project:a', limit: 50 }
it('preserves missing digest as unverified and never creates an adopted artifact', () => {
  const result = inspectEikonaAssetPage(input(), expected)
  expect(result).toMatchObject({ status: 'ready', nextCursor: 'opaque-owner-cursor', items: [{ ref: row.artifact_uri, versionStatus: 'unverified' }] })
  expect(JSON.stringify(result)).not.toMatch(/legacy-handle|legacy-display|accepted|adopted|contentDigest/)
  const pinned = inspectEikonaAssetPage({ ...input(), assets: [{ ...row, sha256: 'sha256:' + 'a'.repeat(64) }] }, expected)
  expect(pinned).toMatchObject({ items: [{ versionStatus: 'observed_digest', contentDigest: 'a'.repeat(64) }] })
})
it('rejects foreign-project rows instead of filtering a page and fabricating complete coverage', () => {
  expect(inspectEikonaAssetPage({ ...input(), assets: [{ ...row, project_id: 'project:b' }] }, expected)).toEqual({ status: 'permission_denied' })
})
it('rejects duplicate refs, wrong counts, unexpected limit and raw access URLs', () => {
  for (const value of [{ ...input(), assets: [row, row], count: 2 }, { ...input(), count: 2 }, { ...input(), pagination: { limit: 100 } }, { ...input(), assets: [{ ...row, artifact_uri: 'https://example.com/media' }] }]) {
    expect(inspectEikonaAssetPage(value, expected)).toEqual({ status: 'needs_contract' })
  }
})
