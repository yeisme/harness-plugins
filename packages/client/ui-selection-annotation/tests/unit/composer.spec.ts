import { describe, expect, it, vi } from 'vitest'
import {
  CompactComposerController,
  COMPOSER_ROWS_MAX,
  COMPOSER_WIDTH_DEFAULT,
  COMPOSER_WIDTH_MAX,
  COMPOSER_WIDTH_MIN,
} from '../../src/client/composer.ts'

describe('compact agent composer seam', () => {
  it('keeps drafts, attachments and context through expand/collapse', () => {
    const composer = new CompactComposerController({ anchorTitle: 'package.json · L18–24' })
    composer.update('请解释这段配置')
    composer.addContextCard({ id: 'selection', label: 'L18–24' })
    composer.addContextCard({ id: 'screenshot', label: '#2 截图标记' })
    composer.expand()
    expect(composer.getState().expanded).toBe(true)
    expect(composer.getState().text).toBe('请解释这段配置')
    expect(composer.getState().cards).toHaveLength(2)
    composer.collapse()
    expect(composer.getState().text).toBe('请解释这段配置')
    expect(composer.getState().cards).toHaveLength(2)
  })

  it('grows the input area 1–6 rows with the draft', () => {
    const composer = new CompactComposerController({})
    expect(composer.getState().rows).toBe(1)
    composer.update('一\n二\n三')
    expect(composer.getState().rows).toBe(3)
    composer.update(Array.from({ length: 10 }, (_, i) => `行${i}`).join('\n'))
    expect(composer.getState().rows).toBe(COMPOSER_ROWS_MAX)
  })

  it('clamps width to 280–480 with a 360 default', () => {
    const composer = new CompactComposerController({})
    expect(composer.getState().width).toBe(COMPOSER_WIDTH_DEFAULT)
    composer.setWidth(100)
    expect(composer.getState().width).toBe(COMPOSER_WIDTH_MIN)
    composer.setWidth(9999)
    expect(composer.getState().width).toBe(COMPOSER_WIDTH_MAX)
  })

  it('forces preview-first for edit intent and refuses auto-apply', async () => {
    const send = vi.fn(async () => {})
    const composer = new CompactComposerController({ adapter: { send } })
    composer.setIntent('edit')
    composer.update('把这里改成块级编辑器')
    const blocked = await composer.submit('auto-apply' as never)
    expect(blocked.status).toBe('blocked')
    expect(blocked.reason).toBe('preview-first-required')
    expect(send).not.toHaveBeenCalled()
    expect(composer.getState().status).toBe('blocked')

    const sent = await composer.submit()
    expect(sent.status).toBe('sent')
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ intent: 'edit', approvalPolicy: 'preview-first' }))
  })

  it('comments locally without calling the model by default', async () => {
    const send = vi.fn(async () => {})
    const composer = new CompactComposerController({ adapter: { send } })
    composer.setIntent('comment')
    composer.update('这里布局需要调整')
    const result = await composer.submit()
    expect(result.status).toBe('local')
    expect(send).not.toHaveBeenCalled()

    // 用户显式切换“请 Agent 回应”后才走模型。
    composer.update('这里布局需要调整')
    composer.setModelResponseForComment(true)
    const withModel = await composer.submit()
    expect(withModel.status).toBe('sent')
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('degrades honestly when the host composer adapter is missing', async () => {
    const composer = new CompactComposerController({})
    composer.setIntent('ask')
    composer.update('这段代码做了什么？')
    const result = await composer.submit()
    expect(result.status).toBe('blocked')
    expect(result.reason).toBe('composer-adapter-unavailable')
    expect(composer.getState().blockedReason).toBe('composer-adapter-unavailable')
  })

  it('blocks empty drafts and walks input history', async () => {
    const composer = new CompactComposerController({})
    expect((await composer.submit()).status).toBe('blocked')

    const send = vi.fn(async () => {})
    const withAdapter = new CompactComposerController({ adapter: { send } })
    withAdapter.update('第一条')
    await withAdapter.submit()
    withAdapter.update('第二条')
    await withAdapter.submit()
    expect(withAdapter.historyUp()).toBe('第二条')
    expect(withAdapter.historyUp()).toBe('第一条')
    expect(withAdapter.historyDown()).toBe('第二条')
    expect(withAdapter.historyDown()).toBe('')
    expect(withAdapter.historyDown()).toBeUndefined()
  })
})
