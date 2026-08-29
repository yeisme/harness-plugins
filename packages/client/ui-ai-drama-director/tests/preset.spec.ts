import { describe, expect, it } from 'vitest'
import {
  applyDirectorPreset,
  applyShowControlPreset,
  buildDramaViewOpenRequest,
  buildShowControlViewOpenRequest,
  openDramaSecondaryView,
  persistDirectorPresetVariant,
  resolveDramaPresetService,
  DRAMA_DEFAULT_VISIBLE_TAB_LIMIT,
  DRAMA_PRESET_SERVICE_UNAVAILABLE,
  DRAMA_VIEW_KINDS,
  DRAMA_SHOW_CONTROL_VIEW_KINDS,
  type DramaPresetReceiptV1,
} from '../src/client/preset.js'
import type { DramaPaneWorkbenchFace } from '../src/client/probe.js'

interface OpenCall {
  readonly kind: string
  readonly resourceKey: string
  readonly viewId: string
  readonly role: string
  readonly preferredRegion: string
  readonly singleton: boolean
  readonly pinned: boolean
}

function recordingPane() {
  const opens: OpenCall[] = []
  const pane: DramaPaneWorkbenchFace = {
    registerView: () => () => {},
    openView: request => opens.push(request as OpenCall),
  }
  return { pane, opens }
}

describe('buildDramaViewOpenRequest', () => {
  it('builds stable singleton requests for all six views', () => {
    for (const [id, kind] of Object.entries(DRAMA_VIEW_KINDS)) {
      const request = buildDramaViewOpenRequest(id as keyof typeof DRAMA_VIEW_KINDS)
      expect(request.kind).toBe(kind)
      expect(request.viewId).toBe(`drama:${id.toLowerCase()}`)
      expect(request.resourceKey).toBe(`drama:${id.toLowerCase()}`)
      expect(request).toMatchObject({
        role: 'content',
        preferredRegion: 'right',
        retention: 'keep-alive',
        singleton: true,
        pinned: true,
      })
    }
  })
})

describe('applyDirectorPreset', () => {
  it('opens Context/Review/Run as an ordered tab set and activates Context', () => {
    const { pane, opens } = recordingPane()
    const result = applyDirectorPreset(pane)

    expect(opens.map(call => call.kind)).toEqual(['drama.context', 'drama.review', 'drama.run', 'drama.context'])
    // One region only: every request targets the same region/role and none
    // fabricates a split (the reducer keeps same-role tabs in one group).
    expect(new Set(opens.map(call => call.preferredRegion))).toEqual(new Set(['right']))
    expect(new Set(opens.map(call => call.role))).toEqual(new Set(['content']))
    expect(result.active).toBe('Context')
    expect(result.collapsed).toBe('single-region-tabs')
    expect(result.applied).toEqual(['Context', 'Review', 'Run'])
    expect(result.applied.length).toBeLessThanOrEqual(DRAMA_DEFAULT_VISIBLE_TAB_LIMIT)
  })

  it('is idempotent: re-application reuses stable view ids', () => {
    const { pane, opens } = recordingPane()
    applyDirectorPreset(pane)
    applyDirectorPreset(pane)
    const ids = opens.map(call => call.viewId)
    expect(new Set(ids).size).toBe(3)
  })

  it('keeps secondary views on-demand', () => {
    const { pane, opens } = recordingPane()
    applyDirectorPreset(pane)
    openDramaSecondaryView(pane, 'Story')
    expect(opens.map(call => call.kind)).toEqual(['drama.context', 'drama.review', 'drama.run', 'drama.context', 'drama.story'])
  })
})

describe('show-control preset', () => {
  it('builds stable requests for four additive show-control panes', () => {
    for (const [id, kind] of Object.entries(DRAMA_SHOW_CONTROL_VIEW_KINDS)) {
      const request = buildShowControlViewOpenRequest(id as keyof typeof DRAMA_SHOW_CONTROL_VIEW_KINDS)
      expect(request).toMatchObject({ kind, resourceKey: `drama:show-control:${id.toLowerCase()}`, singleton: true, pinned: true })
    }
  })

  it('opens Tier 0 Show Board, Review Inbox, existing Run, and Delivery while preserving Director preset behavior', () => {
    const { pane, opens } = recordingPane()
    const result = applyShowControlPreset(pane)
    expect(opens.map(call => call.kind)).toEqual(['drama.show-board', 'drama.review-inbox', 'drama.run', 'drama.delivery', 'drama.show-board'])
    expect(result.applied).toEqual(['ShowBoard', 'ReviewInbox', 'Run', 'Delivery'])
    expect(result.active).toBe('ShowBoard')

    opens.length = 0
    applyDirectorPreset(pane)
    expect(opens.map(call => call.kind)).toEqual(['drama.context', 'drama.review', 'drama.run', 'drama.context'])
  })
})

describe('persistDirectorPresetVariant', () => {
  const draft = { schema: 'pane.workspace-draft.v1alpha1' }

  it('disables the write entry with a reason when no preset service exists', async () => {
    const result = await persistDirectorPresetVariant(undefined, { name: 'My Director', scope: 'workspace', draft })
    expect(result.writeDisabled).toBe(true)
    expect(result.reason).toBe(DRAMA_PRESET_SERVICE_UNAVAILABLE)
  })

  it('enables further writes on an ok receipt', async () => {
    const receipt: DramaPresetReceiptV1 = { status: 'ok', action: 'create', id: 'preset:1' }
    const result = await persistDirectorPresetVariant(
      { create: async () => receipt, update: async () => receipt, delete: async () => receipt, reset: async () => receipt },
      { name: 'My Director', scope: 'workspace', draft },
    )
    expect(result.writeDisabled).toBe(false)
    expect(result.receipt?.status).toBe('ok')
  })

  it.each(['rejected', 'permission_denied'] as const)('disables the write entry on %s without touching the layout', async (status) => {
    const receipt: DramaPresetReceiptV1 = { status, action: 'create', reason: 'workspace scope is not permitted' }
    const service = { create: async () => receipt, update: async () => receipt, delete: async () => receipt, reset: async () => receipt }
    const result = await persistDirectorPresetVariant(service, { name: 'My Director', scope: 'workspace', draft })
    expect(result.writeDisabled).toBe(true)
    expect(result.reason).toBe('workspace scope is not permitted')

    // A denied write never blocks applying the layout locally.
    const { pane, opens } = recordingPane()
    applyDirectorPreset(pane)
    expect(opens.length).toBe(4)
  })

  it('fails closed without partial state when the service throws', async () => {
    const service = {
      create: async () => {
        throw new Error('owner crashed')
      },
      update: async () => ({ status: 'rejected', action: 'update' }) as Promise<DramaPresetReceiptV1>,
      delete: async () => ({ status: 'rejected', action: 'delete' }) as Promise<DramaPresetReceiptV1>,
      reset: async () => ({ status: 'rejected', action: 'reset' }) as Promise<DramaPresetReceiptV1>,
    }
    const result = await persistDirectorPresetVariant(service, { name: 'My Director', scope: 'workspace', draft })
    expect(result.writeDisabled).toBe(true)
    expect(result.receipt).toBeUndefined()
  })
})

describe('resolveDramaPresetService', () => {
  const service = {
    create: async () => ({ status: 'ok', action: 'create' }) as Promise<DramaPresetReceiptV1>,
    update: async () => ({ status: 'ok', action: 'update' }) as Promise<DramaPresetReceiptV1>,
    delete: async () => ({ status: 'ok', action: 'delete' }) as Promise<DramaPresetReceiptV1>,
    reset: async () => ({ status: 'ok', action: 'reset' }) as Promise<DramaPresetReceiptV1>,
  }

  it('prefers a preset face exposed by the pane workbench', () => {
    const pane = { registerView: () => () => {}, openView: () => {}, presets: service } as unknown as DramaPaneWorkbenchFace
    expect(resolveDramaPresetService(() => undefined, pane)).toBe(service)
  })

  it('falls back to a context service and rejects invalid shapes', () => {
    expect(resolveDramaPresetService(name => (name === 'paneWorkspacePresets' ? service : undefined), undefined)).toBe(service)
    expect(resolveDramaPresetService(() => ({ create: 'nope' }), undefined)).toBeUndefined()
    expect(resolveDramaPresetService(() => {
      throw new Error('no context')
    }, undefined)).toBeUndefined()
  })
})
