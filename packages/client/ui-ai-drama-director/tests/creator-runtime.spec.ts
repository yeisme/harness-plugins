import { describe, expect, it, vi } from 'vitest'
import { creatorSnapshot } from '../../ui-creator-studio/tests/fixtures.ts'
import {
  createLegacyCreatorStudioRuntime,
  creatorProjectionIdentity,
} from '../src/client/creator-runtime.js'

describe('legacy Creator Studio compatibility runtime', () => {
  it('is read-only, coalesces explicit refresh, and installs no polling loop', async () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
    let resolveRead: ((value: unknown) => void) | undefined
    const snapshot = vi.fn(() => new Promise<unknown>(resolve => { resolveRead = resolve }))
    const runtime = createLegacyCreatorStudioRuntime({ snapshot })
    const first = runtime.refresh()
    const second = runtime.refresh()

    expect(runtime).toMatchObject({ mode: 'legacy-readonly', canMutate: false })
    expect(snapshot).toHaveBeenCalledOnce()
    expect(setIntervalSpy).not.toHaveBeenCalled()
    resolveRead?.({ ok: true, value: creatorSnapshot() })
    await Promise.all([first, second])
    expect(runtime.getSnapshot()).toMatchObject({ phase: 'ready', snapshot: { snapshotRef: 'creator:studio:runtime:1:1' } })

    runtime.dispose()
    expect(runtime.getSnapshot()).toMatchObject({ phase: 'cold', snapshot: null })
    setIntervalSpy.mockRestore()
  })

  it('drops a late response after dispose and never retries it', async () => {
    let resolveRead: ((value: unknown) => void) | undefined
    const snapshot = vi.fn(() => new Promise<unknown>(resolve => { resolveRead = resolve }))
    const runtime = createLegacyCreatorStudioRuntime({ snapshot })
    const pending = runtime.refresh()
    runtime.dispose()
    resolveRead?.({ ok: true, value: creatorSnapshot() })
    await pending
    expect(snapshot).toHaveBeenCalledOnce()
    expect(runtime.getSnapshot().snapshot).toBeNull()
  })

  it('fences projection identity by context, runtime generation, and snapshot version', () => {
    const snapshot = creatorSnapshot()
    const state = {
      phase: 'ready' as const,
      snapshot,
      errorCode: null,
      pendingDescriptorRef: null,
      pendingApprovalRef: null,
      lastReceipt: null,
      assetPhase: 'cold' as const,
      assetQuery: { scope: 'current_project' as const },
      assetItems: [],
      assetNextCursor: null,
      assetStatus: null,
      assetMessage: null,
      assetUnavailableOwners: [],
      assetErrorCode: null,
    }
    expect(creatorProjectionIdentity('drama:1', state)).not.toBe(creatorProjectionIdentity('drama:2', state))
    expect(creatorProjectionIdentity('drama:1', state)).not.toBe(creatorProjectionIdentity('drama:1', { ...state, snapshot: { ...snapshot, snapshotVersion: 2 } }))
  })
})
