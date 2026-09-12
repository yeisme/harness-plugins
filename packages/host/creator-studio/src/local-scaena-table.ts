import { createHash } from 'node:crypto'
import { z } from 'zod'
import { PaneActionDescriptorSchema, decodePaneActionValues, PANE_ACTION_DESCRIPTOR_SCHEMA, type PaneActionReceiptV1 } from '@yeisme/dsh-pane-protocol'
import type { CreatorOwnerAdapterV1, CreatorStudioContextV1 } from './types.ts'
import { scaenaTableQuerySchema, scaenaTableViewSchema, type ScaenaTableQuery } from './scaena-table-contract.ts'

type Invoke = (args: readonly string[], timeout?: number) => Promise<unknown>
type View = z.infer<typeof scaenaTableViewSchema>
const ref = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u)
const hash = (value: string) => createHash('sha256').update(value).digest('hex')

export function withLocalScaenaTable(base: CreatorOwnerAdapterV1, invoke: Invoke, cwd: string): CreatorOwnerAdapterV1 {
  let selected: (ScaenaTableQuery & { scope: string }) | undefined
  let selectionEpoch = 0, sequence = 0
  const read = async (input: Pick<ScaenaTableQuery, 'breakdownRef' | 'continuation'>) => {
    const result = z.object({ data: z.object({ view: scaenaTableViewSchema }) }).parse(await invoke(['storyboard', 'table', 'show', input.breakdownRef, '--project', cwd,
      '--page-size', '100', ...(input.continuation ? ['--continuation', input.continuation] : [])]))
    if (result.data.view.breakdown_ref !== input.breakdownRef) throw new Error('Table identity mismatch')
    return result.data.view
  }
  const descriptors = (view: View, context: CreatorStudioContextV1) => {
    const shot = view.shots.find(row => row.shot_ref === selected?.shotRef)
    if (!shot || view.historical || view.expected_version < 1) return []
    const definitions = [
      { verb: 'set', label: '保存镜头字段', fields: [
        { key: 'field', label: '字段', kind: 'select', required: true, options: view.columns.map(column => ({ value: column.field, label: column.label ?? column.field })) },
        { key: 'value', label: '新内容', kind: 'textarea', required: true, maxLength: 16000 },
      ] },
      { verb: 'set_duration', label: '保存镜头时长', fields: [{ key: 'duration_micros', label: '时长（微秒，1000000 = 1 秒）', kind: 'number', required: true, min: 1, max: 3600000000 }] },
      { verb: 'reorder', label: '保存场景镜头顺序', fields: [{ key: 'shots', label: '按顺序填写本场景全部镜头引用，每行一个', kind: 'textarea', required: true, maxLength: 16000 }] },
    ]
    return definitions.filter(item => item.verb !== 'reorder' || (!view.truncated && !selected?.continuation)).map(item => PaneActionDescriptorSchema.parse({ schema: PANE_ACTION_DESCRIPTOR_SCHEMA, owner: 'scaena', actionId: `scaena.table.${item.verb}`,
      descriptorRef: `scaena:table:${hash(JSON.stringify([view.candidate_ref, view.candidate_digest, view.expected_version, shot.shot_ref, item.verb]))}`,
      targetRef: view.breakdown_ref, targetVersion: view.candidate_digest, context, label: item.label, presentation: { task: 'video' }, risk: 'medium', confirmation: 'confirm',
      expiresAt: new Date(Date.now() + 60000).toISOString(), preview: { summary: `${shot.shot_ref} · 新版本由 Scaena 保存，原候选保留。时长变化不自动拉伸声音。` }, fields: item.fields }))
  }
  const unknown = (actionId: string): PaneActionReceiptV1 => ({ owner: 'scaena', actionId, status: 'unknown', receiptRef: 'scaena:table:unconfirmed', summary: 'Read the original table operation before another edit.' })
  const receipt = (raw: unknown, actionId: string): PaneActionReceiptV1 => {
    const parsed = z.object({ data: z.object({ candidate_ref: ref, version: z.number().int().positive(), digest: z.string().regex(/^sha256:[a-f0-9]{64}$/u), state: z.string() }) }).safeParse(raw)
    if (!parsed.success) return unknown(actionId)
    return { owner: 'scaena', actionId, status: 'completed', receiptRef: parsed.data.data.candidate_ref, evidenceRefs: [parsed.data.data.digest], summary: 'Scaena saved a new storyboard candidate. Review and production remain separate.' }
  }
  return {
    ...base,
    async selectScaenaPackage(input, context) {
      const result = await base.selectScaenaPackage?.(input, context)
      if (result?.status === 'ready') { selected = undefined; selectionEpoch++ }
      return result ?? { status: 'unavailable' }
    },
    async readScaenaTable(input, context) {
      const query = scaenaTableQuerySchema.safeParse(input), epoch = ++selectionEpoch
      if (!query.success) return { status: 'invalid_input' }
      try {
        const view = await read(query.data)
        if (epoch !== selectionEpoch) return { status: 'unconfirmed' }
        if (query.data.shotRef && !view.shots.some(shot => shot.shot_ref === query.data.shotRef)) return { status: 'unconfirmed' }
        selected = { ...query.data, scope: JSON.stringify(context) }
        return { status: 'ready', view }
      } catch { return { status: 'unconfirmed' } }
    },
    async snapshot(context) {
      const selection = selected
      if (!selection || selection.scope !== JSON.stringify(context)) return base.snapshot(context)
      try {
        const view = await read(selection), current = ++sequence
        if (selection !== selected) return base.snapshot(context)
        return { schemaVersion: 'creator.owner.snapshot.v1alpha1', owner: 'scaena', transport: 'local', context, snapshotRef: `scaena:table:${view.breakdown_ref}`,
          snapshotVersion: current, cursor: `scaena:table:${current}`, sequence: current, generatedAt: new Date().toISOString(), status: 'ready', freshness: 'fresh', summary: 'Canonical storyboard table.',
          resources: [{ ref: view.breakdown_ref, version: view.candidate_digest, kind: 'storyboard-table', title: view.breakdown_ref, status: view.historical ? 'historical' : 'ready', evidenceRefs: [view.candidate_ref] },
            ...view.shots.map(shot => ({ ref: shot.shot_ref, version: view.candidate_digest, kind: 'shot', title: `${shot.order + 1} · ${shot.shot_ref}`, status: 'ready', summary: shot.scene_ref, evidenceRefs: [] }))],
          actions: descriptors(view, context) }
      } catch { return { ...await base.snapshot(context), status: 'offline', freshness: 'unknown', actions: [], summary: 'The selected storyboard table is unavailable.' } }
    },
    async dispatch(input, context) {
      if (!['scaena.table.set', 'scaena.table.set_duration', 'scaena.table.reorder'].includes(input.actionId)) return base.dispatch(input, context)
      const selection = selected
      if (!selection || selection.breakdownRef !== input.expectedTargetRef || selection.scope !== JSON.stringify(context)) return unknown(input.actionId)
      try {
        const view = await read(selection), action = descriptors(view, context).find(item => item.descriptorRef === input.descriptorRef && item.targetVersion === input.expectedTargetVersion)
        if (!action || selected !== selection) return { ...unknown(input.actionId), status: 'reconcile_required' }
        const values = decodePaneActionValues(input), verb = input.actionId.replace('scaena.table.', ''), shot = view.shots.find(row => row.shot_ref === selection.shotRef)!
        const args = ['storyboard', 'table', 'edit', view.breakdown_ref, '--project', cwd, '--candidate', view.candidate_ref, '--expected-version', String(view.expected_version),
          '--expected-digest', view.candidate_digest, '--idempotency-key', input.idempotencyKey, '--actor', 'user:operator', '--confirm', '--action', verb, '--shot', shot.shot_ref]
        if (verb === 'set') { if (typeof values.field !== 'string' || typeof values.value !== 'string' || !view.columns.some(column => column.field === values.field)) return unknown(input.actionId); args.push('--field', values.field, '--value', values.value) }
        if (verb === 'set_duration') { if (typeof values.duration_micros !== 'number' || !Number.isSafeInteger(values.duration_micros) || values.duration_micros < 1) return unknown(input.actionId); args.push('--duration-micros', String(values.duration_micros)) }
        if (verb === 'reorder') {
          if (typeof values.shots !== 'string') return unknown(input.actionId)
          const refs = values.shots.split(/\s+/u).filter(Boolean), expected = view.shots.filter(row => row.scene_ref === shot.scene_ref).map(row => row.shot_ref)
          if (view.truncated || refs.length !== expected.length || new Set(refs).size !== refs.length || refs.some(value => !expected.includes(value))) return unknown(input.actionId)
          args.push('--scene', shot.scene_ref, '--shots', refs.join(','))
        }
        return receipt(await invoke(args), input.actionId)
      } catch { return unknown(input.actionId) }
    },
    async reconcile(input, context) {
      if (!input.actionId.startsWith('scaena.table.')) return base.reconcile?.(input, context) ?? unknown(input.actionId)
      try { return receipt(await invoke(['storyboard', 'table', 'reconcile', input.expectedTargetRef, '--project', cwd, '--actor', 'user:operator', '--idempotency-key', input.idempotencyKey]), input.actionId) }
      catch { return unknown(input.actionId) }
    },
  }
}
