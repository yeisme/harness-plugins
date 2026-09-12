import { z } from 'zod'
import { PaneActionReconcileRequestSchema, PaneActionRequestSchema } from '@yeisme/dsh-pane-protocol'
import { creatorStudioContextSchema } from './validation.ts'

export const creatorOperationRecoveryPageSchema = z.discriminatedUnion('status', [
  z.object({ schemaVersion: z.literal('creator.operation-recovery-page.v1alpha1'), status: z.literal('ready'), context: creatorStudioContextSchema,
    operations: z.array(z.object({ request: PaneActionReconcileRequestSchema, targetVersion: PaneActionRequestSchema.shape.expectedTargetVersion }).strict()).max(128),
  }).strict().superRefine((page, ctx) => {
    const identities = page.operations.map(item => JSON.stringify([item.request.owner, item.request.actionId, item.request.expectedTargetRef]))
    if (new Set(identities).size !== identities.length) ctx.addIssue({ code: 'custom', message: 'Duplicate recovery identity' })
    const keys = ['tenantRef', 'workspaceRef', 'projectRef', 'sessionRef', 'principalRef', 'membershipRevision', 'installationRef', 'pluginDigest', 'policyRevision', 'runtimeGeneration', 'revision'] as const
    if (page.operations.some(item => keys.some(key => item.request.context[key] !== page.context[key]))) ctx.addIssue({ code: 'custom', message: 'Recovery context mismatch' })
  }),
  z.object({ schemaVersion: z.literal('creator.operation-recovery-page.v1alpha1'), status: z.literal('unavailable') }).strict(),
])
export type CreatorOperationRecoveryPageV1 = z.infer<typeof creatorOperationRecoveryPageSchema>
