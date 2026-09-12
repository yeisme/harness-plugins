// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { SkillDocumentReader } from '../src/client/SkillDocumentReader.tsx'
import { parseSkillDocument, readSkillDocument, type SkillDocumentAnswer } from '../src/client/skill-document-remote.ts'
import { en } from '../src/client/locales.ts'
import { ToolsPane } from '../src/client/pane.tsx'
import { SessionToolsWorkspace } from '../src/client/workspace-state.ts'
import { ToolHubSidecar } from '../../../host/dsh-tool-hub/src/service.ts'
import { SkillReferenceReader } from '../../../host/dsh-tool-hub/src/reference-reader.ts'

afterEach(cleanup)
const item = { id: 'skill:review', name: 'review', label: 'Review', description: 'Guide', family: 'skill' as const, origin: 'skill' as const,
  source: 'user-agents', availability: 'disabled' as const, enabled: false, canToggle: false }
const t = (key: keyof typeof en) => en[key]
const revision = 'a'.repeat(64), resourceRef = `skill-document:${'b'.repeat(64)}`
const ready = { status: 'ready' as const, revision, resourceRef, content: '<script>bad()</script>\n![image](https://example.invalid/private)', startLine: 1, continuedLine: false }

it('loads only on explicit action, escapes content, clears on cancellation and ignores a late answer', async () => {
  let resolve!: (value: SkillDocumentAnswer) => void
  const signals: AbortSignal[] = []
  const read = vi.fn((_input, signal: AbortSignal) => { signals.push(signal); return new Promise<SkillDocumentAnswer>(done => { resolve = done }) })
  const view = render(<SkillDocumentReader item={item} installed read={read} t={t} />)
  expect(read).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Read document' }))
  await act(async () => { resolve(ready) })
  expect(screen.getByLabelText('Skill document source').textContent).toBe(ready.content)
  expect(view.container.querySelector('script,img,a')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Reload document' }))
  expect(screen.queryByLabelText('Skill document source')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Close document' }))
  expect(signals[1]!.aborted).toBe(true)
  await act(async () => { resolve(ready) })
  expect(screen.queryByLabelText('Skill document source')).toBeNull()
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Read document' }))
})

it('pins versions during paging and clears content on a changed revision or denied read', async () => {
  const read = vi.fn().mockResolvedValueOnce({ ...ready, content: 'first', status: 'partial', nextCursor: 'next' })
    .mockResolvedValueOnce({ ...ready, content: 'second', startLine: 2 })
    .mockResolvedValueOnce({ ...ready, content: 'different version', revision: 'c'.repeat(64) })
    .mockResolvedValueOnce({ status: 'denied' })
  render(<SkillDocumentReader item={item} installed read={read} t={t} />)
  fireEvent.click(screen.getByRole('button', { name: 'Read document' }))
  await screen.findByText('first')
  fireEvent.click(screen.getByRole('button', { name: 'Read next section' }))
  await screen.findByText('second')
  expect(read).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'next', expectedRevision: revision }), expect.any(AbortSignal))
  fireEvent.click(screen.getByRole('button', { name: 'Previous section' }))
  await screen.findByText(en['reader.stale'])
  expect(screen.queryByLabelText('Skill document source')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Reload document' }))
  await screen.findByText(en['reader.denied'])
  expect(read.mock.calls[3]![0]).not.toHaveProperty('expectedRevision')
})

it('rejects malformed wire data, excessive text and absent protocol versions', () => {
  const wire = { specVersion: '1.0', mediaType: 'text/markdown', ...ready }
  expect(parseSkillDocument({ ...wire, privatePath: 'never-project' })).not.toHaveProperty('privatePath')
  expect(() => parseSkillDocument(ready)).toThrow('reader_contract_mismatch')
  expect(() => parseSkillDocument({ ...wire, content: 'x'.repeat(262145) })).toThrow('reader_contract_mismatch')
  expect(parseSkillDocument({ specVersion: '1.0', status: 'denied', content: 'must disappear' })).toEqual({ status: 'denied' })
})

it('does not widen session documents to profile or query without a reader', async () => {
  const read = vi.fn()
  render(<SkillDocumentReader item={item} installed={false} read={read} t={t} />)
  expect((screen.getByRole('button', { name: 'Read document' }) as HTMLButtonElement).disabled).toBe(true)
  expect(read).not.toHaveBeenCalled()
  expect(await readSkillDocument({ get: () => undefined } as never, { itemId: item.id, source: item.source, scope: 'profile' }, new AbortController().signal)).toEqual({ status: 'disabled' })
})

it('mounts only the document namespace on demand and preserves its strict wire envelope', async () => {
  const unmount = vi.fn(async () => {})
  let release!: () => void
  const root: Record<string, unknown> = {}
  const mount = vi.fn(async (contribution: any) => {
    expect(contribution.descriptors).toHaveLength(1)
    const descriptor = contribution.descriptors[0]
    expect(descriptor).toMatchObject({ namespace: 'toolReferences', method: 'readSkill', cancellation: { parameter: 'signal' } })
    root.toolReferences = { readSkill: async (input: unknown) => {
      expect(descriptor.parameters[0].codec.schema.parse(input)).toEqual({ itemId: item.id, source: item.source, scope: 'profile' })
      return { ok: true, value: descriptor.result.schema.parse({ specVersion: '1.0', mediaType: 'text/markdown', ...ready }) }
    } }
    return unmount
  })
  root.$mount = mount
  const ctx = { get: (key: string) => key === 'remote' ? root : undefined, effect: (setup: () => () => void) => { release = setup() } }
  expect(mount).not.toHaveBeenCalled()
  expect(await readSkillDocument(ctx as never, { itemId: item.id, source: item.source, scope: 'profile' }, new AbortController().signal)).toEqual(ready)
  expect(mount).toHaveBeenCalledTimes(1)
  release()
  expect(unmount).toHaveBeenCalledTimes(1)
})

it('aborts the old item read on selection change and never displays its late content', async () => {
  let complete!: (answer: SkillDocumentAnswer) => void
  let signal!: AbortSignal
  const read = vi.fn((_input, next: AbortSignal) => { signal = next; return new Promise<SkillDocumentAnswer>(resolve => { complete = resolve }) })
  const view = render(<SkillDocumentReader key="first" item={item} installed read={read} t={t} />)
  fireEvent.click(screen.getByRole('button', { name: 'Read document' }))
  view.rerender(<SkillDocumentReader key="second" item={{ ...item, id: 'skill:other' }} installed read={read} t={t} />)
  expect(signal.aborted).toBe(true)
  await act(async () => { complete(ready) })
  expect(screen.queryByLabelText('Skill document source')).toBeNull()
  expect(read).toHaveBeenCalledTimes(1)
})

it('reads through original Tools details and the real Host reader without toggling a disabled Skill', async () => {
  const summary = { name: 'review', description: 'Guide', source: 'user-agents', provider: 'filesystem', resourceBase: { kind: 'directory', path: 'controlled-root' } }
  const getDocument = vi.fn(async () => ({ ...summary, content: '# Owner document' }))
  const reader = new SkillReferenceReader(() => owner)
  const owner = { list: async () => [summary], getDocument }
  const put = vi.fn(async () => {})
  const sidecar = new ToolHubSidecar({ table: { get: () => ({ disabled: ['skill:review'], version: 'one', updatedAt: 0 }), put },
    catalog: { collect: async () => ({ skills: [summary], skillsComplete: true, tools: [], pluginEntries: [] }) } })
  const enable = vi.spyOn(sidecar, 'setEnabled')
  const remote = { toolHub: { list: () => sidecar.list(), setEnabled: sidecar.setEnabled.bind(sidecar) },
    toolReferences: { readSkill: async (input: never, signal: AbortSignal) => ({ ok: true, value: await reader.readSkill(input, signal) }) } }
  const ctx = { get: (key: string) => key === 'remote' ? remote : undefined }
  const workspace = new SessionToolsWorkspace(ctx as never)
  const snapshot = { ids: [], byId: {} }
  const sessions = { list: { getSnapshot: () => snapshot, subscribe: () => () => {} } }
  const view = render(<ToolsPane ctx={ctx as never} sessions={sessions as never} workspace={workspace} manager t={t} />)
  await waitFor(() => expect(view.container.querySelector('.tools-row-main')).not.toBeNull())
  fireEvent.click(view.container.querySelector('.tools-row-main')!)
  expect(getDocument).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Read document' }))
  await screen.findByText('# Owner document')
  expect(getDocument).toHaveBeenCalledTimes(1)
  expect(enable).not.toHaveBeenCalled()
  expect(put).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Back to catalog' }))
  expect(screen.queryByLabelText('Skill document source')).toBeNull()
  view.unmount()
})
