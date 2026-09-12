import { expect, it, vi } from 'vitest'
import { CreatorStudioController } from '../src/controller.ts'
import { creatorContext, creatorSnapshot } from './fixtures.ts'
import type { EikonaDraft, EikonaDraftReadResult } from '@yeisme/dsh-creator-studio-host/contracts'

const scope = { tenantRef: creatorContext.tenantRef, workspaceRef: creatorContext.workspaceRef, projectRef: creatorContext.projectRef }
const draft: EikonaDraft = { schemaVersion: 'eikona.studio_draft.v1', scope, id: 'primary', revision: 0, fields: { prompt: '', version: '1', size: '', seed: '-', variables: [] }, checkpoint: { status: 'preparation_unconfirmed' } }
const snapshot = async () => ({ ok: true as const, value: creatorSnapshot() })
const dispatch = vi.fn()

it('retains draft uncertainty, rejects foreign reads and never dispatches on restore', async () => {
  const read = vi.fn(async () => ({ ok: true as const, value: { status: 'ready' as const, draft } }))
  const controller = new CreatorStudioController({ snapshot, dispatch, readEikonaDraft: read })
  await controller.refresh()
  expect(await controller.readEikonaDraft({ scope, id: 'primary' })).toEqual({ status: 'ready', draft })
  expect(await controller.readEikonaDraft({ scope: { ...scope, projectRef: 'other' }, id: 'primary' })).toEqual({ status: 'forbidden' })
  expect(read).toHaveBeenCalledOnce()
  expect(dispatch).not.toHaveBeenCalled()
  controller.dispose()
})

it('rejects mismatched save receipts without retrying', async () => {
  for (const receipt of [{ requestId: 'other', revision: 1 }, { requestId: 'save-one', revision: 8 }]) {
    const save = vi.fn(async () => ({ ok: true as const, value: { status: 'saved' as const, ...receipt } }))
    const controller = new CreatorStudioController({ snapshot, dispatch, saveEikonaDraft: save })
    await controller.refresh()
    expect(await controller.saveEikonaDraft({ requestId: 'save-one', draft })).toEqual({ status: 'unknown' })
    expect(save).toHaveBeenCalledOnce()
    controller.dispose()
  }
})

it('rejects responses from another draft and after disposal', async () => {
  let resolve!: (value: { ok: true; value: EikonaDraftReadResult }) => void
  const controller = new CreatorStudioController({ snapshot, dispatch, readEikonaDraft: async () => new Promise(done => { resolve = done }) })
  await controller.refresh()
  const first = controller.readEikonaDraft({ scope, id: 'primary' })
  resolve({ ok: true, value: { status: 'ready', draft: { ...draft, id: 'other' } } })
  expect(await first).toEqual({ status: 'unknown' })
  const second = controller.readEikonaDraft({ scope, id: 'primary' })
  controller.dispose()
  resolve({ ok: true, value: { status: 'ready', draft } })
  expect(await second).toEqual({ status: 'unknown' })
})
