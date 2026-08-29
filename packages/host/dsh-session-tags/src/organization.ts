/** Pure organization policy: defaults, classification, rules, and admin grants. */

import { randomUUID } from 'node:crypto'
import {
  SESSION_ORGANIZATION_ADMIN_TTL_MS,
  SESSION_ORGANIZATION_AUTO_CONFIDENCE,
} from './constants.ts'
import { normalizeTags } from './tags.ts'
import type {
  ClassificationCandidateV1,
  FunctionTypeV1,
  OrganizationRuleV1,
  SessionOrganizationAssignmentV1,
} from './organization-wire.ts'

const DEFAULT_FUNCTION_ROWS = [
  ['planning', '规划', 'info'],
  ['research', '调研', 'chart-1'],
  ['implementation', '实现', 'primary'],
  ['debugging', '调试', 'warning'],
  ['review', '评审', 'chart-2'],
  ['writing', '写作/创作', 'chart-3'],
  ['operations', '运维/执行', 'success'],
  ['other', '其他', 'muted'],
] as const

/** Stable built-in function ids with localized default labels. */
export function defaultFunctionTypes(): readonly FunctionTypeV1[] {
  return Object.freeze(DEFAULT_FUNCTION_ROWS.map(([id, name, color], order) => Object.freeze({
    id,
    name,
    color,
    scope: Object.freeze({ kind: 'global' as const }),
    order,
    active: true,
    version: `builtin:${id}`,
    updatedAt: 0,
  })))
}

export interface ClassificationPolicyInput {
  readonly sessionId: string
  readonly assignment: SessionOrganizationAssignmentV1 | undefined
  readonly workspaceRef: string
  readonly candidate: ClassificationCandidateV1
  readonly knownFunctionTypeIds: ReadonlySet<string>
  readonly knownTags: ReadonlySet<string>
  readonly now?: number
  readonly newVersion?: () => string
}

export type ClassificationPolicyResult =
  | { readonly ok: true; readonly assignment: SessionOrganizationAssignmentV1; readonly acceptedTags: readonly string[]; readonly createdTags: readonly string[] }
  | { readonly ok: false; readonly code: 'invalid-function' | 'invalid-confidence' | 'invalid-tags'; readonly message: string }

/** Apply the bounded one-shot classifier result without overriding manual locks. */
export function applyClassificationPolicy(input: ClassificationPolicyInput): ClassificationPolicyResult {
  const { candidate } = input
  if (!input.knownFunctionTypeIds.has(candidate.functionTypeId)) {
    return { ok: false, code: 'invalid-function', message: 'classifier returned an unknown function type' }
  }
  if (!Number.isFinite(candidate.confidence) || candidate.confidence < 0 || candidate.confidence > 1) {
    return { ok: false, code: 'invalid-confidence', message: 'classifier confidence must be between 0 and 1' }
  }
  const normalized = normalizeTags(candidate.tags)
  if (!normalized.ok) {
    return { ok: false, code: 'invalid-tags', message: normalized.reasons.join(',') }
  }
  const newTags = normalized.tags.filter(tag => !input.knownTags.has(tag))
  const acceptedTags = Object.freeze(normalized.tags.filter(tag => input.knownTags.has(tag) || newTags.indexOf(tag) < 3))
  const createdTags = Object.freeze(acceptedTags.filter(tag => !input.knownTags.has(tag)))
  const current = input.assignment
  const now = input.now ?? Date.now()
  const version = (input.newVersion ?? randomUUID)()
  const highConfidence = candidate.confidence >= SESSION_ORGANIZATION_AUTO_CONFIDENCE

  const assignment: SessionOrganizationAssignmentV1 = Object.freeze({
    sessionId: current?.sessionId ?? input.sessionId,
    workspaceRef: current?.workspaceRef ?? input.workspaceRef,
    functionTypeId: highConfidence && current?.functionLocked !== true
      ? candidate.functionTypeId
      : (current?.functionTypeId ?? null),
    functionSource: highConfidence && current?.functionLocked !== true
      ? 'automatic'
      : (current?.functionSource ?? null),
    functionLocked: current?.functionLocked ?? false,
    tagsLocked: current?.tagsLocked ?? false,
    classificationStatus: highConfidence ? 'classified' : 'needs_review',
    confidence: candidate.confidence,
    ...(!highConfidence ? { suggestedFunctionTypeId: candidate.functionTypeId, suggestedTags: acceptedTags } : {}),
    ...(candidate.modelRef === undefined ? {} : { modelRef: candidate.modelRef }),
    version,
    updatedAt: now,
  })
  return { ok: true, assignment, acceptedTags, createdTags }
}

export interface RuleSubjectV1 {
  readonly workspaceRef: string
  readonly functionTypeId: string | null
  readonly tags: readonly string[]
  readonly title: string
  readonly visibleText?: string | undefined
}

export interface RuleEvaluationV1 {
  readonly functionTypeId: string | null
  readonly tags: readonly string[]
  readonly archiveProposed: boolean
  readonly matchedRuleIds: readonly string[]
}

/** Evaluate enabled rules in order; the first function assignment wins. */
export function evaluateOrganizationRules(
  rules: readonly OrganizationRuleV1[],
  subject: RuleSubjectV1,
): RuleEvaluationV1 {
  let functionTypeId = subject.functionTypeId
  let functionClaimed = false
  let tags = [...subject.tags]
  let archiveProposed = false
  const matchedRuleIds: string[] = []
  for (const rule of [...rules].filter(item => item.enabled).sort((a, b) => a.order - b.order)) {
    if (!matchesRule(rule, subject)) continue
    matchedRuleIds.push(rule.id)
    if (!functionClaimed && rule.action.setFunctionTypeId !== undefined) {
      functionTypeId = rule.action.setFunctionTypeId
      functionClaimed = true
    }
    const remove = new Set(rule.action.removeTags ?? [])
    tags = tags.filter(tag => !remove.has(tag))
    for (const tag of rule.action.addTags ?? []) {
      if (!tags.includes(tag)) tags.push(tag)
    }
    archiveProposed ||= rule.action.proposeArchive === true
  }
  const normalized = normalizeTags(tags)
  return Object.freeze({
    functionTypeId,
    tags: normalized.ok ? normalized.tags : Object.freeze(subject.tags),
    archiveProposed,
    matchedRuleIds: Object.freeze(matchedRuleIds),
  })
}

function matchesRule(rule: OrganizationRuleV1, subject: RuleSubjectV1): boolean {
  const { condition } = rule
  if (condition.workspaceRefs !== undefined && !condition.workspaceRefs.includes(subject.workspaceRef)) return false
  if (condition.functionTypeIds !== undefined && !condition.functionTypeIds.includes(subject.functionTypeId ?? '')) return false
  if (condition.tagsAll !== undefined && !condition.tagsAll.every(tag => subject.tags.includes(tag))) return false
  if (condition.tagsNone !== undefined && condition.tagsNone.some(tag => subject.tags.includes(tag))) return false
  if (condition.query !== undefined) {
    const query = condition.query.trim().toLocaleLowerCase()
    if (query !== '') {
      const haystack = `${subject.title}\n${subject.visibleText ?? ''}`.toLocaleLowerCase()
      if (!haystack.includes(query)) return false
    }
  }
  return true
}

/** In-memory temporary administrator grant; reload naturally clears it. */
export class TemporaryAdminGate {
  private readonly grants = new Map<string, number>()

  unlock(now = Date.now()): { readonly token: string; readonly expiresAt: number } {
    const token = randomUUID()
    const expiresAt = now + SESSION_ORGANIZATION_ADMIN_TTL_MS
    this.grants.set(token, expiresAt)
    return { token, expiresAt }
  }

  verify(token: string | undefined, now = Date.now()): boolean {
    if (token === undefined) return false
    const expiresAt = this.grants.get(token)
    if (expiresAt === undefined || expiresAt <= now) {
      this.grants.delete(token)
      return false
    }
    return true
  }
}
