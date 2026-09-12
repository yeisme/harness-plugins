import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { z } from 'zod'
import { PaneActionDescriptorSchema, PANE_ACTION_DESCRIPTOR_SCHEMA, type PaneActionReceiptV1 } from '@yeisme/dsh-pane-protocol'
import type { CreatorOwnerAdapterV1, CreatorResourceV1, CreatorStudioContextV1 } from './types.ts'
import { scaenaPackageQuerySchema } from './scaena-package-contract.ts'

type Invoke = (args: readonly string[], timeout?: number) => Promise<unknown>
const ref = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u)
const projectionSchema = z.object({ schema_version: z.literal('scaena.storyboard.review_package_projection.v1'), package_ref: ref, project_ref: ref,
  episode_ref: ref, package_version: z.number().int().positive(), graph_version: z.number().int().nonnegative(), state: z.string().max(100),
  scene_has_more: z.boolean(), scene_cards: z.array(z.object({ scene_ref: ref, order: z.number().int(), shot_refs: z.array(ref).max(200),
    structural_accepted: z.boolean(), visual_accepted: z.boolean(), stale: z.boolean() })).max(200).optional(),
  export: z.object({ formal_allowed: z.boolean(), draft_allowed: z.boolean() }), allowed_actions: z.array(z.string()).max(64),
})
const exportSchema = z.object({ schema_version: z.literal('scaena.storyboard.package_export_manifest.v1'), package_ref: ref,
  idempotency_key_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/u), request_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  package_version: z.number().int().positive(), export_mode: z.enum(['formal', 'draft']), production_ready: z.boolean(),
  files: z.array(z.object({ path: z.string().regex(/^[A-Za-z0-9._-]+$/u), digest: z.string().min(1), size_bytes: z.number().int().nonnegative() })).max(64),
})
const hash = (input: string) => createHash('sha256').update(input).digest('hex')

export function withLocalScaenaPackage(base: CreatorOwnerAdapterV1, invoke: Invoke, cwd: string): CreatorOwnerAdapterV1 {
  let selected: { ref: string; scope: string } | undefined, version = 0, selectionEpoch = 0
  const read = async (packageRef: string) => {
    const result = z.object({ data: projectionSchema }).parse(await invoke(['storyboard', 'package', 'show', packageRef, '--project', cwd, '--view', 'detail']))
    if (result.data.package_ref !== packageRef) throw new Error('Package identity mismatch')
    return result.data
  }
  const descriptors = (value: z.infer<typeof projectionSchema>, context: CreatorStudioContextV1) => (['formal', 'draft'] as const)
    .filter(mode => mode === 'formal' ? value.export.formal_allowed : value.export.draft_allowed)
    .map(mode => PaneActionDescriptorSchema.parse({ schema: PANE_ACTION_DESCRIPTOR_SCHEMA, owner: 'scaena', actionId: `scaena.package.export.${mode}`,
      descriptorRef: `scaena:export:${hash(JSON.stringify([value.package_ref, value.package_version, mode]))}`, targetRef: value.package_ref, targetVersion: String(value.package_version),
      context, presentation: { task: 'video', group: 'export' }, label: mode === 'formal' ? '导出正式制作包' : '导出草稿制作包', risk: 'medium', confirmation: 'confirm',
      expiresAt: new Date(Date.now() + 60000).toISOString(), fields: [], preview: { summary: mode === 'formal' ? '由 Scaena 核验当前审阅状态并导出正式制作包。' : '导出带草稿标记的制作包，不代表制作验收通过。' },
    }))
  const observe = async (input: { actionId: string; expectedTargetRef: string; idempotencyKey: string }, queryOnly: boolean): Promise<PaneActionReceiptV1> => {
    const draft = input.actionId.endsWith('.draft')
    const output = join(cwd, '.scaena', 'exports', `dsh-${hash(input.expectedTargetRef + ':' + input.idempotencyKey)}`)
    const raw = z.object({ data: exportSchema }).parse(await invoke(['storyboard', 'package', queryOnly ? 'export-status' : 'export', input.expectedTargetRef,
      '--project', cwd, '--output', output, '--idempotency-key', input.idempotencyKey, ...(draft ? ['--allow-draft'] : [])]))
    const result = raw.data
    if (result.package_ref !== input.expectedTargetRef || result.idempotency_key_digest !== `sha256:${hash(input.idempotencyKey)}` || result.export_mode !== (draft ? 'draft' : 'formal') || (!draft && !result.production_ready)) throw new Error('Export identity mismatch')
    return { owner: 'scaena', actionId: input.actionId, status: 'completed', receiptRef: result.request_digest,
      summary: `${result.export_mode} package exported: ${result.files.map(file => file.path).join(', ')}.`, evidenceRefs: [result.package_ref, result.request_digest] }
  }
  const unknown = (actionId: string): PaneActionReceiptV1 => ({ owner: 'scaena', actionId, status: 'unknown', receiptRef: 'scaena:export:unconfirmed', summary: 'The original export is unconfirmed. Reconcile it without exporting again.' })
  return {
    ...base,
    async selectScaenaPackage(input, context) {
      const parsed = scaenaPackageQuerySchema.safeParse(input), current = ++selectionEpoch
      if (!parsed.success) return { status: 'invalid_input' }
      try {
        await read(parsed.data.packageRef)
        if (current !== selectionEpoch) return { status: 'unconfirmed' }
        selected = { ref: parsed.data.packageRef, scope: JSON.stringify(context) }
        return { status: 'ready', packageRef: parsed.data.packageRef }
      } catch { return { status: 'unconfirmed' } }
    },
    async snapshot(context) {
      const selection = selected
      if (!selection || selection.scope !== JSON.stringify(context)) return base.snapshot(context)
      try {
        const value = await read(selection.ref)
        if (selected !== selection) return base.snapshot(context)
        const current = ++version
        const resources: CreatorResourceV1[] = [{ ref: value.package_ref, version: String(value.package_version), kind: 'production-package', title: value.episode_ref,
          status: value.state, summary: value.scene_has_more ? 'Showing the first scene page; more scenes remain in the owner.' : 'Canonical storyboard package.', evidenceRefs: [] }]
        for (const scene of value.scene_cards ?? []) {
          resources.push({ ref: scene.scene_ref, version: String(value.graph_version), kind: 'scene', title: `${scene.order + 1} · ${scene.scene_ref}`,
            status: scene.stale ? 'stale' : scene.visual_accepted ? 'accepted' : scene.structural_accepted ? 'review_required' : 'draft', evidenceRefs: [] })
          resources.push(...scene.shot_refs.map(shot => ({ ref: shot, version: String(value.graph_version), kind: 'shot', title: shot, summary: scene.scene_ref,
            status: scene.stale ? 'stale' : 'observed', evidenceRefs: [] })))
        }
        return { schemaVersion: 'creator.owner.snapshot.v1alpha1', owner: 'scaena', transport: 'local', context, snapshotRef: `scaena:package:${value.package_ref}`,
          snapshotVersion: current, cursor: `scaena:package:${current}`, sequence: current, generatedAt: new Date().toISOString(), status: 'ready', freshness: 'fresh',
          summary: 'Scaena canonical storyboard package.', resources, actions: descriptors(value, context) }
      } catch {
        return { ...await base.snapshot(context), status: 'offline', freshness: 'unknown', summary: 'The selected Scaena package is unavailable.', actions: [] }
      }
    },
    async dispatch(input, context) {
      if (!['scaena.package.export.formal', 'scaena.package.export.draft'].includes(input.actionId)) return base.dispatch(input, context)
      try {
        if (selected?.ref !== input.expectedTargetRef || selected.scope !== JSON.stringify(context) || Object.keys(input.values).length) return unknown(input.actionId)
        const descriptor = descriptors(await read(input.expectedTargetRef), context).find(item => item.descriptorRef === input.descriptorRef && item.targetVersion === input.expectedTargetVersion)
        if (!descriptor) return { ...unknown(input.actionId), status: 'reconcile_required' }
        return await observe(input, false)
      } catch { return unknown(input.actionId) }
    },
    async reconcile(input, context) {
      if (!['scaena.package.export.formal', 'scaena.package.export.draft'].includes(input.actionId)) return base.reconcile?.(input, context) ?? unknown(input.actionId)
      if (!ref.safeParse(input.expectedTargetRef).success) return unknown(input.actionId)
      try { return await observe(input, true) } catch { return unknown(input.actionId) }
    },
  }
}
