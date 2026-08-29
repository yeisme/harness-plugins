import { Context } from '@deepseek-ai/cordis'
import TypertGatewayService from '@deepseek-ai/dsh-api-gateway'
import TypertRegistry from '@deepseek-ai/dsh-typert-registry'
import { afterEach, describe, expect, it } from 'vitest'
import { apply } from '../src/plugin.ts'

type ClaimsEndpoint = (endpoint: string) => boolean
type DispatchEndpoint = (endpoint: string, payload: unknown, signal: AbortSignal) => Promise<unknown>

describe('toolHub Gateway registration', () => {
  const disposers: Array<() => void | Promise<void>> = []

  afterEach(async () => {
    while (disposers.length > 0) await disposers.pop()?.()
  })

  it('claims and dispatches toolHub/list through the shared /api interceptor', async () => {
    const root = new Context()
    const typert = await root.plugin(TypertRegistry)
    disposers.push(() => typert.dispose())

    let claims: ClaimsEndpoint | undefined
    let dispatch: DispatchEndpoint | undefined
    const removeConnection = root.provide('connection' as never, {
      rpc: {
        intercept(prefix: string, nextClaims: ClaimsEndpoint, nextDispatch: DispatchEndpoint) {
          expect(prefix).toBe('/api')
          claims = nextClaims
          dispatch = nextDispatch
          return () => undefined
        },
      },
    } as never)
    disposers.push(removeConnection)

    const gateway = await root.plugin(TypertGatewayService)
    disposers.push(() => gateway.dispose())
    const toolHub = await root.plugin({ name: 'tool-hub-test', apply })
    disposers.push(() => toolHub.dispose())

    expect(root.typert.local.get('toolHub/list')).toMatchObject({ service: 'toolHub', method: 'list' })
    expect(claims?.('toolHub/list')).toBe(true)
    const result = await dispatch?.('toolHub/list', { args: {} }, new AbortController().signal)
    expect(result).toMatchObject({ ok: true, value: { ok: true, specVersion: '1.0' } })
  })
})
