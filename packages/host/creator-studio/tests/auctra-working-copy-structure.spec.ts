import { expect, it } from 'vitest'
import { normalizeAuctraTextUnitList } from '../src/auctra-working-copy.ts'

const envelope = (data: unknown) => ({ schema_version: 'auctra.api.envelope.v1', status: 'success', data })

it('maps the three authorized families and omits unknown kinds without a body', () => {
  const items = normalizeAuctraTextUnitList(envelope([
    { id: 'ch_001', kind: 'chapter', title: '第一章', status: 'draft' },
    { id: 'scene_001', kind: 'screenplay_scene', title: '第一场', status: 'editing' },
    { id: 'note_001', kind: 'wechat_article', title: '随笔', status: 'draft' },
    { id: 'secret', kind: 'internal_ledger', title: 'Hidden', status: 'ready' },
  ]))
  expect(items).toEqual([
    { unitRef: 'chapter:ch_001', family: 'novel-chapter', title: '第一章', status: 'draft' },
    { unitRef: 'text:scene_001', family: 'screenplay-scene', title: '第一场', status: 'editing' },
    { unitRef: 'text:note_001', family: 'general-text', title: '随笔', status: 'draft' },
  ])
  expect(JSON.stringify(items)).not.toMatch(/body|internal_ledger/)
})

it('rejects a list envelope that carries a body field', () => {
  expect(normalizeAuctraTextUnitList(envelope([{ id: 'note_001', kind: 'wechat_article', title: '随笔', status: 'draft', body: 'secret' }]))).toBeUndefined()
})
