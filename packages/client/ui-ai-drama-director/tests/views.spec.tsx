// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import type { ArtifactIntentV1, ArtifactRefV1 } from '@yeisme/dsh-pane-protocol'
import type { CreatorStudioRuntimeV1, CreatorStudioViewState } from '@yeisme/dsh-client-ui-creator-studio/runtime'
import { creatorSnapshot } from '../../ui-creator-studio/tests/fixtures.ts'
import type { DramaClientUiSnapshotV1, DramaViewModel } from '../src/client/views.js'
import { createDramaViewFactories } from '../src/client/views.js'
import { createDramaKeymap } from '../src/client/keymap.js'

afterEach(cleanup)

function fixture() {
  const baseStudio = creatorSnapshot()
  const reviewArtifact = baseStudio.owners.find(owner => owner.owner === 'eikona')?.resources[0]?.artifact
  const studio = {
    ...baseStudio,
    reviews: baseStudio.reviews.map(review => reviewArtifact === undefined ? review : { ...review, artifact: reviewArtifact }),
  }
  const creator: CreatorStudioViewState = {
    phase: 'ready',
    snapshot: studio,
    errorCode: null,
    pendingDescriptorRef: null,
    pendingApprovalRef: null,
    lastReceipt: null,
    assetPhase: 'cold',
    assetQuery: { scope: 'current_project' },
    assetItems: [],
    assetNextCursor: null,
    assetStatus: null,
    assetMessage: null,
    assetUnavailableOwners: [],
    assetErrorCode: null,
  }
  const runtime: CreatorStudioRuntimeV1 = {
    schemaVersion: 'creator.studio.runtime.v1alpha1',
    mode: 'shared',
    canMutate: true,
    getSnapshot: () => creator,
    subscribe: () => () => {},
    refresh: vi.fn(async () => {}),
    loadAssets: vi.fn(async () => {}),
    resolveArtifact: vi.fn(async () => undefined),
    dispatchAction: vi.fn(async descriptor => ({ status: 'completed', receiptRef: 'receipt:test', owner: descriptor.owner, actionId: descriptor.actionId })),
    decideApproval: vi.fn(async () => ({ status: 'completed', receiptRef: 'receipt:approval', owner: 'ordo', actionId: 'ordo.approval.decide' })),
  }
  const snapshot: DramaClientUiSnapshotV1 = {
    context: {
      status: 'ready',
      reason: 'owner snapshot',
      mutationsEnabled: true,
      context: {
        schema: 'drama.context.v1',
        workspaceRef: 'workspace:one',
        projectRef: 'project:one',
        showRef: 'show:one',
        episodeRef: 'episode:one',
        ownerVersions: { drama: '1' },
        contextRevision: 'drama:1',
        freshness: 'fresh',
      },
    },
    creator,
    creatorMode: 'shared',
    projectionIdentity: 'drama:1\u0000creator:studio:runtime:1:1\u00001',
  }
  const opened: Array<{ readonly artifact: ArtifactRefV1; readonly compare: boolean }> = []
  const intents: ArtifactIntentV1[] = []
  const model: DramaViewModel = {
    getSnapshot: () => snapshot,
    getAvailability: () => ({ disabled: false }),
    getCommands: () => [
      { id: 'drama.review', label: 'Review', disabled: false },
      { id: 'drama.handoff', label: 'Handoff', disabled: false },
    ],
    getKeymap: () => createDramaKeymap(),
    getCreatorRuntime: () => runtime,
    refreshCreator: runtime.refresh,
    reconcile: vi.fn(async () => {}),
    dispatchArtifactIntent: intent => { intents.push(intent) },
    openArtifact: (artifact, compare = false) => { opened.push({ artifact, compare }) },
    handleViewKey: vi.fn(),
    runCommand: vi.fn(),
    subscribe: () => () => {},
  }
  return { model, opened, intents, runtime }
}

describe('operational Drama Director panes', () => {
  it.each([
    ['drama-context', ['雨夜来客', '准备', '镜头', 'next action']],
    ['drama-story', ['auctra', 'Create text']],
    ['drama-visual', ['雨夜城市', 'eikona', 'scaena']],
    ['drama-audio', ['主角对白 Take 1', 'sonora']],
    ['drama-run', ['生成当前镜头', 'active']],
    ['drama-review', ['镜头 04 视觉候选', 'Owner approvals']],
  ] as const)('renders real owner projection in %s', (componentKey, expected) => {
    const { model } = fixture()
    const component = createDramaViewFactories(model)[componentKey]
    render(component?.() as ReactElement)
    for (const text of expected) expect(screen.getAllByText(text, { exact: false }).length).toBeGreaterThan(0)
  })

  it('opens independent artifact/version compare targets and keeps keyboard handling element-scoped', () => {
    const { model, opened } = fixture()
    const component = createDramaViewFactories(model)['drama-review']
    render(component?.() as ReactElement)
    fireEvent.click(screen.getByRole('button', { name: 'Compare' }))
    expect(opened).toEqual([expect.objectContaining({ compare: true, artifact: expect.objectContaining({ ref: 'artifact:image:one', version: '1' }) })])
    fireEvent.keyDown(screen.getByLabelText('Drama Review'), { key: 'Escape' })
    expect(model.handleViewKey).toHaveBeenCalledOnce()
    expect(Array.from(document.querySelectorAll('style')).some(style => style.textContent?.includes('@media(max-width:390px)'))).toBe(true)
  })

  it('renders legacy mode as read-only and leaves mutation forms absent', () => {
    const { model } = fixture()
    const legacySnapshot = { ...model.getSnapshot(), creatorMode: 'legacy-readonly' as const }
    const legacyRuntime = {
      schemaVersion: 'creator.studio.legacy-readonly.v1alpha1' as const,
      mode: 'legacy-readonly' as const,
      canMutate: false as const,
      getSnapshot: () => legacySnapshot.creator!,
      subscribe: () => () => {},
      refresh: async () => {},
      dispose: () => {},
    }
    const legacyModel: DramaViewModel = {
      ...model,
      getSnapshot: () => legacySnapshot,
      getCreatorRuntime: () => legacyRuntime,
    }
    render(createDramaViewFactories(legacyModel)['drama-story']?.() as ReactElement)
    expect(screen.getAllByText('read-only', { exact: false }).length).toBeGreaterThan(0)
    expect(document.querySelector('[data-action-composer]')).toBeNull()
  })
})
