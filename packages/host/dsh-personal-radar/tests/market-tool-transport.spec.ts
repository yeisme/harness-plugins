import { expect, test } from 'vitest'
import { createMarketToolTransport } from '../src/market-tool-transport.js'

const tool = { name: 'discovered-radar-search', inputSchema: { properties: { view: { enum: ['market_capabilities', 'market_reader', 'market_brief'] } } } }
test('tools-only transport uses the discovered name and rejects arbitrary resources before calling', async () => {
  const calls: unknown[] = []
  const transport = createMarketToolTransport(tool, async (name, args) => {
    calls.push({ name, args }); return { content: [{ type: 'text', text: '{"spec":"radar.market_reader.v1"}' }] }
  })
  expect(await transport.readResource({ uri: 'radar://market/reader' })).toMatchObject({ contents: [{ uri: 'radar://market/reader' }] })
  expect(calls).toEqual([{ name: tool.name, args: { view: 'market_reader' } }])
  await expect(transport.readResource({ uri: 'https://example.invalid' })).rejects.toThrow('market_resource_unavailable')
  expect(calls).toHaveLength(1)
  expect(() => createMarketToolTransport({ ...tool, inputSchema: {} }, async () => ({}))).toThrow('contract_mismatch')
})
test('tools-only errors preserve safe owner codes without echoing messages', async () => {
  const transport = createMarketToolTransport(tool, async () => ({ isError: true,
    content: [{ type: 'text', text: JSON.stringify({ error: 'brief_not_found', message: 'private diagnostic' }) }] }))
  await expect(transport.readResource({ uri: 'radar://market/briefs/latest' })).rejects.toEqual({ data: { code: 'brief_not_found' } })
})

test('catch-up forwards an opaque cursor without decoding or accepting arbitrary parameters', async () => {
  const args: unknown[] = []
  const transport = createMarketToolTransport({ ...tool, inputSchema: { properties: { view: {
    enum: [...tool.inputSchema.properties.view.enum, 'market_catchup'],
  } } } }, async (_name, input) => { args.push(input); return { content: [{ type: 'text', text: '{}' }] } })
  await transport.readResource({ uri: 'radar://market/catchup?cursor=opaque_cursor-1' })
  expect(args).toEqual([{ view: 'market_catchup', cursor: 'opaque_cursor-1' }])
  await expect(transport.readResource({ uri: 'radar://market/catchup?command=write' })).rejects.toThrow()
  expect(args).toHaveLength(1)
})

test('detail tool reads preserve exact signal revisions and attached evidence selections', async () => {
  const calls: unknown[] = []
  const transport = createMarketToolTransport({ ...tool, inputSchema: { properties: { view: {
    enum: [...tool.inputSchema.properties.view.enum, 'market_signal', 'market_evidence'],
  } } } }, async (_name, args) => { calls.push(args); return { content: [{ type: 'text', text: '{}' }] } })
  await transport.readResource({ uri: 'radar://market/signals/signal-a/revisions/2' })
  await transport.readResource({ uri: 'radar://market/signals/signal-a/revisions/1/evidence/evidence-a' })
  expect(calls).toEqual([{ view: 'market_signal', signal: 'signal-a', revision: 2 },
    { view: 'market_evidence', signal: 'signal-a', revision: 1, evidence: 'evidence-a' }])
  for (const uri of ['radar://market/signals/signal-a/revisions/0', 'radar://market/signals/signal-a/revisions/9007199254740992',
    'radar://market/signals/signal-a/revisions/1?latest=true']) await expect(transport.readResource({ uri })).rejects.toThrow()
  expect(calls).toHaveLength(2)
})
