/** `yeisme_session_organization_v1` additive storage-domain declaration. */

import { z } from 'zod'
import type { DomainSpec, DomainTableSpec } from '@deepseek-ai/dsh-storage-domain'
import { SESSION_ORGANIZATION_DOMAIN } from './constants.ts'
import type {
  BatchReceiptV1,
  FunctionTypeV1,
  OrganizationRuleV1,
  SessionOrganizationAssignmentV1,
  TagCatalogEntryV1,
} from './organization-wire.ts'

const scopeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('global') }).strict(),
  z.object({ kind: z.literal('workspace'), workspaceRef: z.string().min(1) }).strict(),
])

export const functionTypeSchema: z.ZodType<FunctionTypeV1> = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: z.string().min(1),
  scope: scopeSchema,
  order: z.number().int(),
  active: z.boolean(),
  version: z.string().min(1),
  updatedAt: z.number(),
}).strict()

export const assignmentSchema: z.ZodType<SessionOrganizationAssignmentV1> = z.object({
  sessionId: z.string().min(1),
  workspaceRef: z.string().min(1),
  functionTypeId: z.string().min(1).nullable(),
  functionSource: z.enum(['automatic', 'manual', 'rule']).nullable(),
  functionLocked: z.boolean(),
  tagsLocked: z.boolean(),
  classificationStatus: z.enum(['unclassified', 'classified', 'needs_review', 'failed']),
  confidence: z.number().min(0).max(1).nullable(),
  suggestedFunctionTypeId: z.string().min(1).optional(),
  suggestedTags: z.array(z.string()).optional(),
  modelRef: z.string().min(1).optional(),
  version: z.string().min(1),
  updatedAt: z.number(),
}).strict()

export const tagCatalogEntrySchema: z.ZodType<TagCatalogEntryV1> = z.object({
  name: z.string().min(1),
  color: z.string().min(1),
  scope: scopeSchema,
  active: z.boolean(),
  aliasTo: z.string().min(1).optional(),
  version: z.string().min(1),
  updatedAt: z.number(),
}).strict()

export const organizationRuleSchema: z.ZodType<OrganizationRuleV1> = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  order: z.number().int(),
  enabled: z.boolean(),
  condition: z.object({
    workspaceRefs: z.array(z.string()).optional(),
    functionTypeIds: z.array(z.string()).optional(),
    tagsAll: z.array(z.string()).optional(),
    tagsNone: z.array(z.string()).optional(),
    query: z.string().optional(),
  }).strict(),
  action: z.object({
    setFunctionTypeId: z.string().optional(),
    addTags: z.array(z.string()).optional(),
    removeTags: z.array(z.string()).optional(),
    proposeArchive: z.boolean().optional(),
  }).strict(),
  version: z.string().min(1),
  updatedAt: z.number(),
}).strict()

const batchActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('set-function'), functionTypeId: z.string().min(1) }).strict(),
  z.object({ type: z.literal('add-tags'), tags: z.array(z.string()) }).strict(),
  z.object({ type: z.literal('remove-tags'), tags: z.array(z.string()) }).strict(),
  z.object({ type: z.literal('archive') }).strict(),
  z.object({ type: z.literal('restore') }).strict(),
  z.object({ type: z.literal('purge') }).strict(),
])

const assignmentOrNull = assignmentSchema.nullable()
const batchItemSchema = z.object({
  sessionId: z.string().min(1),
  status: z.enum(['ok', 'stale', 'conflict', 'rejected', 'not_available']),
  reason: z.string().optional(),
  beforeAssignment: assignmentOrNull.optional(),
  afterAssignment: assignmentOrNull.optional(),
  beforeTags: z.array(z.string()).optional(),
  afterTags: z.array(z.string()).optional(),
}).strict()

export const batchReceiptSchema: z.ZodType<BatchReceiptV1> = z.object({
  id: z.string().min(1),
  planId: z.string().min(1),
  action: batchActionSchema,
  status: z.enum(['ok', 'partial', 'rejected']),
  items: z.array(batchItemSchema),
  createdAt: z.number(),
  undoExpiresAt: z.number().nullable(),
}).strict()

export interface SessionOrganizationDomainSpec extends DomainSpec {
  readonly name: typeof SESSION_ORGANIZATION_DOMAIN
  readonly version: 1
  readonly tables: {
    readonly function_types: DomainTableSpec<string, FunctionTypeV1>
    readonly assignments: DomainTableSpec<string, SessionOrganizationAssignmentV1>
    readonly tag_catalog: DomainTableSpec<string, TagCatalogEntryV1>
    readonly rules: DomainTableSpec<string, OrganizationRuleV1>
    readonly batch_runs: DomainTableSpec<string, BatchReceiptV1>
  }
}

export const sessionOrganizationDomainSpec: SessionOrganizationDomainSpec = Object.freeze({
  name: SESSION_ORGANIZATION_DOMAIN,
  version: 1,
  tables: {
    function_types: { valueSchema: functionTypeSchema },
    assignments: { valueSchema: assignmentSchema },
    tag_catalog: { valueSchema: tagCatalogEntrySchema },
    rules: { valueSchema: organizationRuleSchema },
    batch_runs: { valueSchema: batchReceiptSchema },
  },
})
