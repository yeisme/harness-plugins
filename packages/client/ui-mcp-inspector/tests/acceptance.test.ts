import { mkdtemp, mkdir, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { recordAcceptanceRun, REQUIRED_SCREENSHOTS, verifyAcceptanceRun } from '../scripts/ui-acceptance.ts'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function preparedRun(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-tools-acceptance-'))
  roots.push(root)
  await mkdir(join(root, 'artifacts'))
  for (const name of REQUIRED_SCREENSHOTS) await writeFile(join(root, 'artifacts', name), `image:${name}`)
  await writeFile(join(root, 'summary.json'), JSON.stringify({ status: 'passed', exit_code: 0 }))
  await writeFile(join(root, 'env.json'), JSON.stringify({ source_digest: 'sha256:source' }))
  return root
}

describe('Tools human acceptance gate', () => {
  it('accepts only a matching accept receipt', async () => {
    const root = await preparedRun()
    await recordAcceptanceRun(root, { change: 'dsh-tools-center-observability-v1', runId: 'run-1', decision: 'accept', reviewerRole: 'product-owner', commit: 'abc', sourceDigest: 'sha256:source' })
    await expect(verifyAcceptanceRun(root, 'abc', 'sha256:source')).resolves.toBeUndefined()
  })

  it('rejects human rejection and stale commits', async () => {
    const root = await preparedRun()
    await recordAcceptanceRun(root, { change: 'dsh-tools-center-observability-v1', runId: 'run-2', decision: 'reject', reviewerRole: 'product-owner', commit: 'abc', sourceDigest: 'sha256:source' })
    await expect(verifyAcceptanceRun(root, 'abc', 'sha256:source')).rejects.toThrow(/not accept/)
    await recordAcceptanceRun(root, { change: 'dsh-tools-center-observability-v1', runId: 'run-2', decision: 'accept', reviewerRole: 'product-owner', commit: 'abc', sourceDigest: 'sha256:source' })
    await expect(verifyAcceptanceRun(root, 'def', 'sha256:source')).rejects.toThrow(/stale/)
    await expect(verifyAcceptanceRun(root, 'abc', 'sha256:changed')).rejects.toThrow(/source state is stale/)
  })

  it('rejects missing or changed screenshots', async () => {
    const root = await preparedRun()
    await recordAcceptanceRun(root, { change: 'dsh-tools-center-observability-v1', runId: 'run-3', decision: 'accept', reviewerRole: 'product-owner', commit: 'abc', sourceDigest: 'sha256:source' })
    await writeFile(join(root, 'artifacts', REQUIRED_SCREENSHOTS[0]), 'changed')
    await expect(verifyAcceptanceRun(root, 'abc', 'sha256:source')).rejects.toThrow(/digest mismatch/)
    await unlink(join(root, 'artifacts', REQUIRED_SCREENSHOTS[1]))
    await expect(verifyAcceptanceRun(root, 'abc', 'sha256:source')).rejects.toThrow()
  })

  it('rejects recording against a changed source state', async () => {
    const root = await preparedRun()
    await expect(recordAcceptanceRun(root, { change: 'dsh-tools-center-observability-v1', runId: 'run-4', decision: 'accept', reviewerRole: 'product-owner', commit: 'abc', sourceDigest: 'sha256:changed' })).rejects.toThrow(/prepare again/)
  })
})
