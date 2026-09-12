// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PANE_ARTIFACT_SCHEMA } from '@yeisme/dsh-pane-protocol'
import { AuctraWritingStudioPages } from '../src/auctra-writing-studio.tsx'
import { CreatorStudioController } from '../src/controller.ts'
import { defaultCreatorStudioTranslator } from '../src/locales.ts'
import { action, creatorSnapshot } from './fixtures.ts'

afterEach(cleanup)

it('opens the independent text studio with keyboard-equivalent page actions', () => {
  render(<AuctraWritingStudioPages t={defaultCreatorStudioTranslator}
    structure={<p data-testid="structure">结构</p>} candidates={<p data-testid="candidates">候选</p>} versions={<p data-testid="versions">版本</p>} exportPage={<p data-testid="export">导出</p>} />)
  const structure = screen.getByRole('tab', { name: '结构与正文' })
  expect(structure.getAttribute('aria-selected')).toBe('true')
  expect(screen.getByTestId('structure')).toBeTruthy()
  expect(screen.queryByTestId('candidates')).toBeNull()
  fireEvent.click(screen.getByRole('tab', { name: 'Agent与候选' }))
  expect(screen.getByTestId('candidates')).toBeTruthy()
  fireEvent.keyDown(screen.getByRole('tab', { name: 'Agent与候选' }), { key: 'End' })
  expect(screen.getByRole('tab', { name: '导出与交接' })).toBe(document.activeElement)
  expect(screen.getByTestId('export')).toBeTruthy()
  fireEvent.click(screen.getByRole('tab', { name: '版本与审阅' }))
  expect(screen.getByTestId('versions')).toBeTruthy()
  expect(document.querySelector('[data-auctra-writing-studio]')).toBeTruthy()
})

it('discards a late owner dispatch and body read after project, session, or version switch', async () => {
  const textArtifact = (version: string) => ({ schema: PANE_ARTIFACT_SCHEMA, owner: 'auctra' as const, kind: 'text',
    ref: 'auctra:working-copy:note', version, mediaType: 'text/plain', title: 'Note', evidenceRefs: [] as const, capabilities: [] as const })
  const withVersion = (base: ReturnType<typeof creatorSnapshot>, version: string, extra: Partial<typeof base.context> = {}) => {
    const context = { ...base.context!, ...extra }
    return { ...base, snapshotRef: `snapshot:${version}`, snapshotVersion: Number.parseInt(version, 10) || base.snapshotVersion + 1, context,
      owners: base.owners.map(owner => ({ ...owner, context, actions: owner.actions.map(item => ({ ...item, context })),
        ...(owner.owner === 'auctra' ? { artifactWorkspace: { status: 'partial' as const, safeMessage: 'Selected version.',
          artifacts: [{ artifact: textArtifact(version), acceptedVersion: version, candidates: [] }] } } : {}) })) }
  }
  let snapshot = withVersion(creatorSnapshot(), '1')
  let settleDispatch!: (value: unknown) => void
  let settleRead!: (value: unknown) => void
  const dispatch = vi.fn(() => new Promise(resolve => { settleDispatch = resolve }))
  const readArtifactContent = vi.fn(() => new Promise(resolve => { settleRead = resolve }))
  const controller = new CreatorStudioController({ snapshot: async () => ({ ok: true, value: snapshot }), dispatch,
    resolveArtifact: async () => ({ ok: true, value: null }), readArtifactContent })
  await controller.refresh()
  const descriptor = { ...action('auctra', 'text'), context: snapshot.context! }
  const first = controller.dispatchAction(descriptor, { brief: 'first body' })
  const pendingRead = controller.readArtifactContent(textArtifact('1'))
  await vi.waitFor(() => { expect(dispatch).toHaveBeenCalledOnce(); expect(readArtifactContent).toHaveBeenCalledOnce() })
  snapshot = withVersion(snapshot, '9', { sessionRef: 'session:two' })
  await controller.refresh()
  settleDispatch({ ok: true, value: { status: 'completed', receiptRef: 'receipt:late', owner: 'auctra', actionId: 'auctra.create', summary: 'late saved' } })
  settleRead({ ok: true, value: { artifact: textArtifact('1'), contentRevision: '1', content: 'stale body' } })
  const receipt = await first
  expect(receipt.status).toBe('unknown')
  expect(receipt.reconcileReason).toBe('generation_replaced')
  expect(controller.store.getSnapshot().lastReceipt).toBeNull()
  expect(controller.store.getSnapshot().snapshot?.owners.find(owner => owner.owner === 'auctra')?.artifactWorkspace?.artifacts[0]?.artifact.version).toBe('9')
  expect(await pendingRead).toBeUndefined()
  controller.dispose()
})
