import { expect, test } from 'vitest'
import { createScopedMarketToolConnection } from '../src/market-tool-runtime.js'

test('tool runtime connection keeps discovery and guarded execution in the supplied agent scope', async () => {
  const agent = { id: 'agent-a' }
  const executions: unknown[] = []
  let enabled = true
  const runtime = {
    schemas(scope: object) {
      expect(scope).toBe(agent)
      return enabled ? [{ name: 'discovered-name', parameters: { properties: { view: { enum: ['market_capabilities', 'market_reader', 'market_brief'] } } } }] : []
    },
    async execute(input: unknown) {
      executions.push(input)
      return { isError: false, value: { content: [{ type: 'text', text: '{"spec":"radar.market_reader.v1"}' }] } }
    },
  }
  const connection = createScopedMarketToolConnection(runtime, agent, 'discovered-name')
  const controller = new AbortController()
  await connection.readResource({ uri: 'radar://market/reader' }, { signal: controller.signal })
  expect(executions[0]).toMatchObject({ agent, signal: controller.signal, name: 'discovered-name', arguments: { view: 'market_reader' } })
  enabled = false
  expect(() => connection.readResource({ uri: 'radar://market/reader' })).toThrow('market_tool_unavailable')
  expect(executions).toHaveLength(1)
})
test('guard failures never turn rendered content into a successful market response', async () => {
  const connection = createScopedMarketToolConnection({
    schemas: () => [{ name: 'radar-search', parameters: { properties: { view: { enum: ['market_capabilities', 'market_reader', 'market_brief'] } } } }],
    execute: async () => ({ isError: true, value: { content: [{ type: 'text', text: 'private' }] } }),
  }, {}, 'radar-search')
  await expect(connection.readResource({ uri: 'radar://market/reader' })).rejects.toThrow('market_tool_execution_denied')
})
