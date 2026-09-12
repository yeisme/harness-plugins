import { createHash } from 'node:crypto'
import { z } from 'zod'
import { PaneActionDescriptorSchema, PaneActionRequestSchema, PANE_ACTION_DESCRIPTOR_SCHEMA, type PaneActionReceiptV1 } from '@yeisme/dsh-pane-protocol'
import type { CreatorOwnerAdapterV1, CreatorStudioContextV1 } from './types.ts'

type Invoke = (args: readonly string[], timeout?: number) => Promise<unknown>
const actionsSchema = z.object({ facts: z.object({ session_ref: z.string(), session_version: z.number().int().positive(), session_status: z.string() }),
  data: z.object({ AllowedActions: z.array(z.string()).max(64) }) })
const verbs = ['run', 'pause', 'resume', 'cancel'] as const
const labels = { run: '推进制作', pause: '暂停制作', resume: '恢复制作', cancel: '取消制作' }
const actionRef = (target: string, version: number, verb: string) => `scaena:local:${createHash('sha256').update(JSON.stringify([target, version, verb])).digest('hex')}`

/** Invoke only fixed CLI verbs. Owner-authored command strings are never executed. */
export function withLocalScaena(base: CreatorOwnerAdapterV1, invoke: Invoke, cwd: string): CreatorOwnerAdapterV1 {
  const actions = async (target: string, context: CreatorStudioContextV1) => {
    const result = actionsSchema.parse(await invoke(['production', 'session', 'actions', '--project', cwd, '--session', target]))
    if (result.facts.session_ref !== target) throw new Error('Session identity mismatch')
    return verbs.filter(verb => result.data.AllowedActions.includes(`production.session.${verb}`)).map(verb => PaneActionDescriptorSchema.parse({
      schema: PANE_ACTION_DESCRIPTOR_SCHEMA, owner: 'scaena', actionId: `production.session.${verb}`, descriptorRef: actionRef(target, result.facts.session_version, verb),
      targetRef: target, targetVersion: String(result.facts.session_version), context, label: labels[verb], risk: 'high', confirmation: 'confirm',
      presentation: { task: 'video' }, expiresAt: new Date(Date.now() + 60_000).toISOString(),
      preview: { summary: `${labels[verb]}；仅作用于所选制作会话的当前版本。生成权限和预算由 Scaena 核验。` }, fields: [],
    }))
  }
  const unconfirmed = (actionId: string): PaneActionReceiptV1 => ({ owner: 'scaena', actionId, status: 'unknown', receiptRef: 'scaena:local:unconfirmed', summary: 'The original Scaena operation is unconfirmed. Inspect its existing session before another operation.' })
  return {
    ...base,
    async snapshot(context) {
      const snapshot = await base.snapshot(context)
      if (snapshot.freshness !== 'fresh') return snapshot
      const discovered = []
      for (const resource of snapshot.resources.slice(0, 20)) {
        try { discovered.push(...await actions(resource.ref, context)) } catch { /* One unavailable session must not hide others. */ }
      }
      return { ...snapshot, actions: discovered }
    },
    async dispatch(raw, context) {
      const parsed = PaneActionRequestSchema.safeParse(raw)
      if (!parsed.success || parsed.data.owner !== 'scaena') return unconfirmed('production.session')
      const request = parsed.data, verb = verbs.find(value => request.actionId === `production.session.${value}`)
      if (!verb || Object.keys(request.values).length || request.textBody) return unconfirmed(request.actionId)
      try {
        const fresh = (await actions(request.expectedTargetRef, context)).find(action => action.descriptorRef === request.descriptorRef)
        if (!fresh || fresh.targetVersion !== request.expectedTargetVersion) return { ...unconfirmed(request.actionId), status: 'reconcile_required' }
        const result = z.object({ status: z.string(), facts: z.object({ session_ref: z.string(), session_version: z.number().int(), session_status: z.string() }) }).parse(await invoke([
          'production', 'session', verb, '--project', cwd, '--session', request.expectedTargetRef,
          '--expected-version', request.expectedTargetVersion, '--idempotency-key', request.idempotencyKey,
          ...(verb === 'run' ? ['--max-steps', '1'] : []),
        ], 120_000))
        if (result.facts.session_ref !== request.expectedTargetRef || result.facts.session_version <= Number(request.expectedTargetVersion)) return unconfirmed(request.actionId)
        return { owner: 'scaena', actionId: request.actionId, receiptRef: `scaena:session:${createHash('sha256').update(request.idempotencyKey).digest('hex')}`,
          status: 'accepted', summary: `Scaena session state: ${result.facts.session_status}. Production acceptance and delivery remain separate.` }
      } catch { return unconfirmed(request.actionId) }
    },
    async reconcile(input) {
      // A session version is not proof of which mutation happened; do not infer settlement or resubmit.
      return unconfirmed(input.actionId)
    },
  }
}
