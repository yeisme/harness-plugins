import { z } from 'zod'

const ref = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:@+-]{0,255}$/)
const text = z.string().max(512).refine(value => !/(?:https?:\/\/|Bearer\s|(?:token|password|secret)\s*[:=]|(?:^|\s)\/|[A-Za-z]:[\\/])/i.test(value))
const date = z.string().datetime()
export const ProjectTaskSchema = z.object({
  ref, runRef: ref, title: text, state: ref, dependencies: z.array(ref).max(2_000), agentRefs: z.array(ref).max(100), blockers: z.array(ref).max(2_000),
  verification: ref.optional(), artifacts: z.array(ref).max(200), evidence: z.array(ref).max(200),
  attempts: z.array(z.object({ ref, state: ref, runtime: ref.optional() }).strict()).max(200),
}).strict()
const event = z.object({ ref, streamRef: ref, sequence: z.number().int().nonnegative(), at: date, kind: ref, runRef: ref, taskRef: ref.optional(), agentRef: ref.optional() }).strict()
const window = z.object({ eventLimit: z.number().int().min(1).max(1_000), truncated: z.boolean() }).strict()
export const ProjectSnapshotSchema = z.object({
  schemaVersion: z.literal('ordo.project_ops.snapshot.v1'), projectRef: ref, version: z.string().regex(/^[a-f0-9]{64}$/), generatedAt: date,
  freshness: z.enum(['fresh', 'partial']),
  runs: z.array(z.object({ ref, title: text, state: ref, kind: z.enum(['team', 'plan', 'run']), planRef: ref.optional() }).strict()).max(2_000),
  tasks: z.array(ProjectTaskSchema).max(10_000),
  agents: z.array(z.object({ ref, runRef: ref, label: text, role: text, state: ref, source: z.literal('ordo'), runtime: ref.optional(), model: text.optional() }).strict()).max(4_000),
  events: z.array(event).max(1_000), actions: z.array(z.object({ id: ref, targetRef: ref, confirmation: z.boolean(), disabledReason: text.optional() }).strict()).max(10_000),
  limitations: z.array(text).max(50), window, sessionRoots: z.array(ref).max(200).optional(),
  runtimeChoices: z.array(ref).max(20).optional(),
  pendingReceipts: z.array(z.lazy(() => ProjectReceiptSchema)).max(200).optional(),
}).strict()
export const ProjectListSchema = z.object({ projects: z.array(z.object({ ref, title: text }).strict()).max(1_000) }).strict()
export const ProjectSessionLinksSchema = z.object({ links: z.array(z.object({ projectRef: ref, title: text, taskRefs: z.array(ref).max(2_000) }).strict()).max(1_000) }).strict()
export const ProjectEventsSchema = z.object({ projectRef: ref, cursor: z.string().regex(/^[a-f0-9]{64}$/), changed: z.boolean(), events: z.array(event).max(1_000), window, refetch: z.boolean() }).strict()
export const ProjectDraftSchema = z.object({ planRef: ref, revision: z.number().int().positive(), budgetRef: ref, maxWallClockMinutes: z.number().int().positive(),
  roles: z.array(z.object({ ref, role: text, modelRef: text }).strict()).max(100),
  tasks: z.array(z.object({ ref, dependencies: z.array(ref).max(2_000) }).strict()).max(2_000),
}).strict()
export type ProjectDraft = z.infer<typeof ProjectDraftSchema>
export const ProjectRestoreSchema = z.object({ projectRef: ref,
  view: z.enum(['attention', 'graph', 'agents', 'timeline', 'tasks']).optional(), selectedRef: ref.optional(), runRef: ref.optional(), query: text.optional(),
  positions: z.record(ref, z.object({ x: z.number().finite(), y: z.number().finite() }).strict()).refine(value => Object.keys(value).length <= 1_000).optional(),
  draft: z.object({ targetRef: ref, value: ProjectDraftSchema }).strict().optional(),
}).strict()
export type ProjectRestoreState = z.infer<typeof ProjectRestoreSchema>
export const ProjectRequestSchema = z.object({ projectRef: ref, expectedVersion: z.string().regex(/^[a-f0-9]{64}$/), requestId: ref,
  action: ref, targetRef: ref, confirmed: z.boolean(), payload: z.record(z.string().max(100), z.union([z.string().max(65_536), z.boolean()])).refine(value => Object.keys(value).length <= 20),
}).strict()
export const ProjectReceiptSchema = z.object({ schemaVersion: z.literal('ordo.project_ops.receipt.v1'), ref, requestId: ref, projectRef: ref,
  action: ref, targetRef: ref, state: z.enum(['accepted', 'rejected', 'unknown']), reason: ref, resultRef: ref.optional(),
}).strict()
export type ProjectSnapshot = z.infer<typeof ProjectSnapshotSchema>
export type ProjectTask = z.infer<typeof ProjectTaskSchema>
export type ProjectRequest = z.infer<typeof ProjectRequestSchema>
export type ProjectReceipt = z.infer<typeof ProjectReceiptSchema>
export interface ProjectRemote {
  projectSettlement?(projectRef: string, requestId: string): Promise<ProjectReceipt>
  projectDraft?(projectRef: string, targetRef: string): Promise<ProjectDraft>
  projects(): Promise<z.infer<typeof ProjectListSchema>>
  projectSnapshot(projectRef: string): Promise<ProjectSnapshot>
  projectEvents(projectRef: string, cursor: string): Promise<z.infer<typeof ProjectEventsSchema>>
  projectInvoke(request: ProjectRequest): Promise<ProjectReceipt>
}
