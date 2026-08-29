import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { name, inject, apply } from '../src/index.ts'
// The client face is read through the banner-free root entry: importing
// `../src/client` would pull the ModuleLoader-wrapped lib/client.js, which
// only executes inside a loader.
import { apply as clientApply, inject as clientInject, tokenUsageRemoteContribution } from '@yeisme/dsh-client-ui-token-usage'

const root = new URL('..', import.meta.url)
const manifest = JSON.parse(readFileSync(fileURLToPath(new URL('package.json', root)), 'utf8')) as {
  readonly name: string
  readonly dsh?: { readonly bundle?: { readonly patch?: string }; readonly client?: { readonly platform?: string } }
  readonly dependencies?: Readonly<Record<string, string>>
}
const patch = readFileSync(fileURLToPath(new URL('cordis.patch.yml', root)), 'utf8')

describe('dsh-token-usage bundle contract', () => {
  it('declares one additive patch with a single bundle row', () => {
    expect(manifest.dsh?.bundle?.patch).toBe('./cordis.patch.yml')
    expect(manifest.dsh?.client?.platform).toBe('web')
    expect(patch).toMatch(/^\s*-\s*insert:\s*$/mu)
    expect(patch.split('- id: dsh-token-usage').length - 1, patch).toBe(1)
    expect(patch.split("'@yeisme/dsh-token-usage'\n").length - 1, patch).toBe(1)
  })

  it('depends on the host and client packages directly', () => {
    expect(manifest.dependencies?.['@yeisme/dsh-token-usage-host']).toBe('workspace:*')
    expect(manifest.dependencies?.['@yeisme/dsh-client-ui-token-usage']).toBe('workspace:*')
  })

  it('re-exports the host plugin face', async () => {
    expect(name).toBe('dsh-token-usage')
    expect(inject).toEqual(['typert', 'sessionProjections'])
    expect(typeof apply).toBe('function')
    // Missing seams fail closed: apply on an empty context is a no-op.
    expect(() => apply({ get: () => undefined } as never)).not.toThrow()
  })

  it('re-exports the client face with the tokenUsage contribution', () => {
    expect(typeof clientApply).toBe('function')
    expect(clientInject).toEqual(['slots', 'locale'])
    expect(tokenUsageRemoteContribution.package).toBe('@yeisme/dsh-token-usage-host')
    expect(tokenUsageRemoteContribution.descriptors.map(d => d.method).sort()).toEqual(['refreshBalance', 'snapshot'])
    for (const descriptor of tokenUsageRemoteContribution.descriptors) {
      expect(descriptor.namespace).toBe('tokenUsage')
      expect(descriptor.invocation).toEqual({ kind: 'direct' })
    }
  })

  it('ships a client bundle registered under the ModuleLoader banner', () => {
    const source = readFileSync(fileURLToPath(new URL('../lib/client.js', import.meta.url)), 'utf8')
    expect(source.startsWith('window.__ModuleLoader__.load({')).toBe(true)
    expect(source).toContain(`id: "${manifest.name}"`)
    expect(source).toContain('factory: (require)')
    expect(source).not.toMatch(/require\("@yeisme\//u)
  })
})

describe('host/client wire mirror sync', () => {
  it('pins specVersion, schema versions, and the service key on the host', async () => {
    const host = await import('@yeisme/dsh-token-usage-host')
    expect(host.TOKEN_USAGE_SPEC_VERSION).toBe('1.0')
    expect(host.TOKEN_USAGE_REMOTE_SERVICE_KEY).toBe('tokenUsage')
    expect(host.TOKEN_USAGE_SCHEMA_VERSION).toBe('token.usage.snapshot.v1alpha1')
    expect(host.TOKEN_BALANCE_SCHEMA_VERSION).toBe('token.balance.snapshot.v1alpha1')
  })

  it('accepts the official documentation balance example on both sides', async () => {
    const host = await import('@yeisme/dsh-token-usage-host')
    const mapped = host.mapBalanceResponse({
      is_available: true,
      balance_infos: [
        { currency: 'CNY', total_balance: '110.00', granted_balance: '10.00', topped_up_balance: '100.00' },
      ],
    })
    expect(mapped).not.toBeNull()
    const { TokenUsageService } = host
    const service = new TokenUsageService({ credentials: { resolveApiKey: () => undefined } })
    const parts = service.snapshot()
    expect(() => host.parseBalanceSnapshot(parts.balance)).not.toThrow()
    expect(() => host.parseUsageSnapshot(parts.usage)).not.toThrow()
  })

  it('never leaks credential shapes into projections', async () => {
    const host = await import('@yeisme/dsh-token-usage-host')
    const { TokenUsageService, TokenLedger } = host
    const ledger = new TokenLedger()
    ledger.observeProvider('session-a', 'deepseek-official')
    ledger.observeTokenUsage('session-a', { uncachedInputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0 }, Date.now())
    const service = new TokenUsageService({ ledger, credentials: { resolveApiKey: () => 'sk-bundle-sync' } })
    const serialized = JSON.stringify(service.snapshot())
    expect(serialized).not.toMatch(/sk-bundle-sync|bearer|authorization|api\.deepseek\.com/iu)
  })
})
