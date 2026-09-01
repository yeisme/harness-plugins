import { afterEach, describe, expect, it } from 'vitest'
import { runBundleContractCheck } from '../src/checkers/bundle-contract.js'
import { bundlePackageJson, cleanupWorkspace, makeWorkspace } from './helpers.js'

const roots: string[] = []
afterEach(() => {
  for (const root of roots) cleanupWorkspace(root)
  roots.length = 0
})

function workspace(files: Record<string, string>): string {
  const root = makeWorkspace(files)
  roots.push(root)
  return root
}

const GOOD_CLIENT = 'window.__ModuleLoader__.load({ id: "@yeisme/dsh-fixture-bundle", factory() {} })\n'

describe('bundle-contract (收编自 scripts/check-bundle-contracts.mjs)', () => {
  it('passes a self-contained client with matching banner id', async () => {
    const root = workspace({
      'packages/bundle/fixture/package.json': bundlePackageJson({}),
      'packages/bundle/fixture/lib/client.js': GOOD_CLIENT,
    })
    const result = await runBundleContractCheck(root)
    expect(result.status).toBe('pass')
    expect(result.checkedCount).toBe(1)
  })

  it('reds on external @yeisme require, relative chunk require and banner mismatch', async () => {
    const root = workspace({
      'packages/bundle/fixture/package.json': bundlePackageJson({}),
      'packages/bundle/fixture/lib/client.js': 'window.__ModuleLoader__.load({ id: "wrong-id", factory() {} })\nrequire("@yeisme/dsh-x")\nrequire("./chunk.js")\n',
    })
    const result = await runBundleContractCheck(root)
    const codes = result.findings.map(finding => finding.code)
    expect(codes).toContain('BUNDLE/EXTERNAL_YEISME_REQUIRE')
    expect(codes).toContain('BUNDLE/RELATIVE_CHUNK_REQUIRE')
    expect(codes).toContain('BUNDLE/BANNER_ID_MISMATCH')
  })

  it('reds when ./client is exported but lib/client.js is missing, skips buildless bundles', async () => {
    const root = workspace({
      'packages/bundle/fixture/package.json': bundlePackageJson({}),
      'packages/bundle/data-only/package.json': JSON.stringify({ name: '@yeisme/dsh-data-only' }),
    })
    const result = await runBundleContractCheck(root)
    expect(result.findings.map(finding => finding.code)).toContain('BUNDLE/CLIENT_NOT_BUILT')
  })

  it('reports internal error when nothing was checked (not a red-light)', async () => {
    const root = workspace({
      'packages/bundle/fixture/package.json': bundlePackageJson({ scripts: {} }),
    })
    const result = await runBundleContractCheck(root)
    expect(result.status).toBe('error')
    expect(result.error).toContain('no bundles found')
  })
})
