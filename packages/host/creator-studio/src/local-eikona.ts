import { z } from 'zod'
import type { CreatorOwnerAdapterV1 } from './types.ts'
import { eikonaPreparationInputSchema } from './eikona-preparation-contract.ts'
import { inspectEikonaPreparation } from './eikona-preparation.ts'
import { eikonaApprovalInputSchema, eikonaRevokeInputSchema, inspectEikonaPreparationApproval, type EikonaApprovalResult } from './eikona-preparation-approval.ts'
import { inspectEikonaApprovalStatus } from './eikona-approval-status.ts'
import { createEikonaGenerationDescriptor } from './eikona-generation-descriptor.ts'
import { EIKONA_GENERATE_ACTION, parseEikonaGenerationRequest } from './eikona-generation-request.ts'
import type { PaneActionReceiptV1 } from '@yeisme/dsh-pane-protocol'

type Invoke = (args: readonly string[], timeout?: number) => Promise<unknown>
const envelope = z.object({ status: z.string(), data: z.record(z.string(), z.unknown()).optional(), facts: z.record(z.string(), z.unknown()).optional() })
const csv = (value: string) => /[,"\n]/u.test(value) ? `"${value.replaceAll('"', '""')}"` : value

/** CLI composition keeps preparation, approval and execution in Eikona's existing stores. */
export function withLocalEikona(base: CreatorOwnerAdapterV1, invoke: Invoke, resolveProject: () => Promise<string | undefined>): CreatorOwnerAdapterV1 {
  let approved: Extract<EikonaApprovalResult, { status: 'approved' }> | undefined
  let approvalRevision = 0
  const project = async () => { const value = await resolveProject(); if (!value) throw new Error('Project is not registered'); return value }
  const readPreparation = async (projectId: string, ref: string) => {
    const result = envelope.parse(await invoke(['preparation', 'show', '--project', projectId, '--preparation', ref]))
    return inspectEikonaPreparation(result.data?.preparation, { preparationRef: ref, ownerProjectRef: projectId })
  }
  const readApproval = async (projectId: string, approvalRef: string) => {
    const result = envelope.parse(await invoke(['preparation', 'approval-status', '--project', projectId, '--approval', approvalRef]))
    return inspectEikonaApprovalStatus(result.data?.approval_status, { approvalRef, projectId })
  }
  const receipt = (raw: unknown): PaneActionReceiptV1 => {
    const parsed = envelope.safeParse(raw), facts = parsed.success ? parsed.data.facts : undefined
    const operation = typeof facts?.operation_ref === 'string' && /^own_[a-f0-9]{24}$/u.test(facts.operation_ref) ? facts.operation_ref : undefined
    const state = facts?.status
    return { owner: 'eikona', actionId: EIKONA_GENERATE_ACTION, receiptRef: operation ?? 'eikona:local:unconfirmed',
      status: operation && state === 'succeeded' ? 'completed' : operation && state === 'failed' ? 'failed' : 'unknown',
      summary: operation && state === 'succeeded' ? 'Eikona generated the fixed input. Review the resulting candidates.' : 'Read the original Eikona operation before another execution.',
      ...(typeof facts?.run_id === 'string' && /^[A-Za-z0-9._-]{1,160}$/u.test(facts.run_id) ? { evidenceRefs: [facts.run_id] } : {}) }
  }
  return {
    ...base,
    async prepareEikonaGeneration(input) {
      const parsed = eikonaPreparationInputSchema.safeParse(input)
      if (!parsed.success) return { status: 'invalid_input' }
      approved = undefined; approvalRevision++
      try {
        const projectId = await project(), value = parsed.data
        const args = ['preparation', 'preview', '--project', projectId, '--prompt', value.prompt_id, '--version', String(value.prompt_version), '--model', value.controls?.model_ref ?? 'openai/gpt-5.4-image-2']
        for (const key of ['size', 'quality', 'aspect'] as const) if (value.controls?.[key]) args.push(`--${key}`, value.controls[key]!)
        if (value.controls?.seed !== undefined) args.push('--seed', String(value.controls.seed))
        if (value.controls?.reference_mode) args.push('--reference-mode', value.controls.reference_mode)
        for (const reference of value.references ?? []) args.push('--reference', `${reference.ref}:${reference.role ?? 'reference_image'}`)
        for (const [key, item] of Object.entries(value.values ?? {})) args.push('--set', csv(`${key}=${item}`))
        const result = envelope.parse(await invoke(args))
        const ref = z.string().regex(/^egp_[a-f0-9]{64}$/u).parse(result.facts?.preparation_ref)
        return inspectEikonaPreparation(result.data?.preparation, { preparationRef: ref, ownerProjectRef: projectId })
      } catch { return { status: 'unconfirmed' } }
    },
    async approveEikonaPreparation(input) {
      const parsed = eikonaApprovalInputSchema.safeParse(input)
      if (!parsed.success) return { status: 'invalid_input' }
      const revision = ++approvalRevision
      approved = undefined
      try {
        const projectId = await project(), value = parsed.data
        const raw = envelope.parse(await invoke(['preparation', 'approve', '--project', projectId, '--preparation', value.preparation_ref,
          '--digest', value.expected_digest, '--max-cost', String(value.max_cost_usd), '--max-images', '1', '--expires-in', `${value.expires_in_seconds}s`]))
        const result = inspectEikonaPreparationApproval(raw.data?.approval, value, projectId)
        if (revision !== approvalRevision) return { status: 'unconfirmed' }
        if (result.status === 'approved') approved = result
        return result
      } catch { return { status: 'unconfirmed' } }
    },
    async readEikonaApprovalStatus(input) {
      try { return await readApproval(await project(), input.approvalRef) } catch { return { status: 'unconfirmed' } }
    },
    async revokeEikonaPreparationApproval(raw) {
      const parsed = eikonaRevokeInputSchema.safeParse(raw)
      if (!parsed.success) return { status: 'invalid_input' }
      const input = parsed.data
      approved = undefined; approvalRevision++
      try {
        const result = envelope.parse(await invoke(['preparation', 'revoke', '--project', await project(), '--approval', input.approvalRef]))
        return result.status === 'success' ? { status: 'revoked', approvalRef: input.approvalRef } : { status: 'unconfirmed' }
      } catch { return { status: 'unconfirmed' } }
    },
    async snapshot(context) {
      const snapshot = await base.snapshot(context)
      let projectId: string | undefined
      try { projectId = await resolveProject() } catch { /* CLI is not ready. */ }
      if (!projectId || snapshot.freshness !== 'fresh') return snapshot
      const selection = approved
      let action
      if (selection) {
        try { action = createEikonaGenerationDescriptor(await readPreparation(projectId, selection.preparationRef), selection,
          await readApproval(projectId, selection.approvalRef), context, Date.now(), projectId) } catch { /* Only verified approvals publish execution. */ }
      }
      return { ...snapshot, resources: [...snapshot.resources,
        { ref: 'eikona:local:preparation', version: '1', kind: 'preparation-capability', title: 'Local preparation', status: 'available', evidenceRefs: [] },
        { ref: 'eikona:local:approval', version: '1', kind: 'approval-capability', title: 'Local approval', status: 'available', evidenceRefs: [] }],
        actions: selection === approved && action ? [action.descriptor] : [] }
    },
    async dispatch(input, context) {
      const request = parseEikonaGenerationRequest(input, context)
      if (!request) return receipt(undefined)
      try {
        const projectId = await project()
        const selection = approved
        if (!selection || selection.approvalRef !== request.values.approval_ref) return receipt(undefined)
        const action = createEikonaGenerationDescriptor(await readPreparation(projectId, selection.preparationRef), selection,
          await readApproval(projectId, selection.approvalRef), context, Date.now(), projectId)
        if (!action || approved !== selection || action.descriptor.descriptorRef !== request.request.descriptorRef) return receipt(undefined)
        return receipt(await invoke(['preparation', 'run', '--project', projectId, '--approval', selection.approvalRef,
          '--idempotency-key', request.request.idempotencyKey], 120_000))
      } catch { return receipt(undefined) }
    },
    async reconcile(input) {
      if (input.owner !== 'eikona' || input.actionId !== EIKONA_GENERATE_ACTION || !/^[A-Za-z0-9._-]{8,128}$/u.test(input.idempotencyKey)) return receipt(undefined)
      try { return receipt(await invoke(['preparation', 'reconcile', '--project', await project(), '--idempotency-key', input.idempotencyKey])) }
      catch { return receipt(undefined) }
    },
  }
}
