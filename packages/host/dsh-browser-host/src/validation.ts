/**
 * Strict validators for the Browser Pane host boundary (browser-pane 1.3).
 *
 * Every projection crossing into the browser (DSH web client) is validated
 * fail-closed here first: exact keys, opaque ref shapes, bounded text with a
 * forbidden-value regex, page/event budgets (32 pages / 64 KiB event payload),
 * and generation/cursor sanity. Unknown fields reject the whole value.
 *
 * @module @yeisme/dsh-browser-host
 */
import { z } from 'zod'
import {
  BROWSER_AUTOMATION_EVENT_SCHEMA,
  BROWSER_AUTOMATION_PROJECTION_SCHEMA,
  BROWSER_AUTOMATION_ACTION_SCHEMA,
  type BrowserActionRequestV1,
  type BrowserPaneEventV1,
  type BrowserPaneSnapshotV1,
} from './contracts.js'

/** Domain budgets: max 32 owner pages per Pane snapshot. */
export const BROWSER_PAGE_BUDGET = 32
/** Event payload bound measured in UTF-16 code units. */
export const BROWSER_EVENT_PAYLOAD_MAX = 64 * 1024

const UNSAFE_TEXT = /(?:^|[:/\\])(?:etc|home|usr|var)|file:\/\/|authorization|cookie|bearer\s|token:|secret|password|-----BEGIN|https?:\/\/|[?#]\w+=/i
const opaqueRef = z.string().min(1).max(256).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/)
const count = z.number().int().nonnegative().max(1_000_000)
const safeText = z.string().min(1).max(512).refine((value: string) => !UNSAFE_TEXT.test(value), 'forbidden value in browser projection text')
const isoTimestamp = z.string().min(1).max(80).refine((value: string) => Number.isFinite(Date.parse(value)), 'ISO timestamp required')

const safeLocationSchema = z.object({
  protocol: z.enum(['http:', 'https:', 'file:', 'about:', 'other']),
  host: z.string().min(1).max(253).regex(/^[a-z0-9.-]+$/i, 'host must be a bare punycode host'),
  pathDigest: z.string().min(8).max(128).regex(/^[a-f0-9]+$/),
  title: safeText.nullish().transform(value => value ?? undefined),
}).strict()

const pageSchema = z.object({
  pageRef: opaqueRef,
  location: safeLocationSchema,
  status: z.enum(['loading', 'ready', 'crashed', 'closed']),
  agentActivityCount: count,
}).strict()

export const browserPaneSnapshotSchema = z.object({
  schemaVersion: z.literal(BROWSER_AUTOMATION_PROJECTION_SCHEMA),
  generation: count,
  cursor: count,
  freshness: z.enum(['fresh', 'stale', 'offline']),
  safeMessage: safeText,
  pages: z.array(pageSchema).max(BROWSER_PAGE_BUDGET),
  activePageRef: opaqueRef.nullish().transform(value => value ?? undefined),
  controlHolder: z.enum(['agent', 'human', 'none']),
}).strict()

export const browserPaneEventSchema = z.object({
  schemaVersion: z.literal(BROWSER_AUTOMATION_EVENT_SCHEMA),
  generation: count,
  sequence: count.min(1),
  kind: z.enum(['page_opened', 'page_closed', 'navigation_completed', 'page_status', 'agent_activity', 'receipt', 'control_changed', 'invalidate']),
  pageRef: opaqueRef.nullish().transform(value => value ?? undefined),
  safeSummary: safeText.refine((value: string) => value.length <= BROWSER_EVENT_PAYLOAD_MAX, 'event payload exceeds 64 KiB budget'),
}).strict()

const bindingSchema = z.object({
  tenantRef: opaqueRef,
  workspaceRef: opaqueRef,
  principalRef: opaqueRef,
  contextRevision: count,
  sessionRef: opaqueRef,
}).strict()

export const browserActionRequestSchema = z.object({
  schemaVersion: z.literal(BROWSER_AUTOMATION_ACTION_SCHEMA),
  actionId: z.string().min(1).max(160),
  binding: bindingSchema,
  pageRef: opaqueRef.nullish().transform(value => value ?? undefined),
  idempotencyKey: z.string().min(8).max(160),
  navigationDraft: z.string().max(2_048).nullish().transform(value => value ?? undefined).refine((value: string | undefined) => value === undefined || !UNSAFE_TEXT.test(value), 'navigation draft carries forbidden content'),
}).strict()

/** Fail-closed snapshot validation. */
export function validateBrowserPaneSnapshot(input: unknown): BrowserPaneSnapshotV1 | undefined {
  const parsed = browserPaneSnapshotSchema.safeParse(input)
  return parsed.success ? parsed.data as BrowserPaneSnapshotV1 : undefined
}

/** Fail-closed event validation (64 KiB payload budget enforced). */
export function validateBrowserPaneEvent(input: unknown): BrowserPaneEventV1 | undefined {
  const parsed = browserPaneEventSchema.safeParse(input)
  return parsed.success ? parsed.data as BrowserPaneEventV1 : undefined
}

/** Fail-closed action-request validation. */
export function validateBrowserActionRequest(input: unknown): BrowserActionRequestV1 | undefined {
  const parsed = browserActionRequestSchema.safeParse(input)
  return parsed.success ? parsed.data as BrowserActionRequestV1 : undefined
}
