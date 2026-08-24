export type GitClientMutationKindV1 = 'stage' | 'unstage' | 'discard' | 'commit'
export type GitClientReceiptStatusV1 =
  | 'ok'
  | 'rejected'
  | 'unknown'
  | 'timeout'
  | 'approval_required'
  | 'revision_drift'
  | 'reconcile_required'

export interface GitClientMutationIntentV1 {
  readonly kind: GitClientMutationKindV1
  readonly repositoryRef: string
  readonly worktreeRef: string
  readonly expectedRevision: string
  readonly previewDigest: string
  readonly idempotencyKey: string
  readonly fileRef?: string
  readonly hunkRef?: string
  readonly message?: string
}

export interface GitClientMutationReceiptV1 {
  readonly status: GitClientReceiptStatusV1
  readonly actionId: string
  readonly idempotencyKey: string
  readonly reason?: string
}

const OPAQUE = /^[A-Za-z0-9._~:-]{1,160}$/

export function createGitMutationIntent(
  kind: GitClientMutationKindV1,
  refs: Pick<GitClientMutationIntentV1, 'repositoryRef' | 'worktreeRef' | 'expectedRevision' | 'previewDigest' | 'idempotencyKey'> & {
    readonly fileRef?: string
    readonly hunkRef?: string
    readonly message?: string
  },
): GitClientMutationIntentV1 {
  return { kind, ...refs }
}

export function validateClientGitMutationIntent(intent: GitClientMutationIntentV1): boolean {
  if (!OPAQUE.test(intent.repositoryRef) || !OPAQUE.test(intent.worktreeRef) || !OPAQUE.test(intent.expectedRevision)) return false
  if (!OPAQUE.test(intent.previewDigest) || !OPAQUE.test(intent.idempotencyKey)) return false
  if (intent.fileRef !== undefined && !OPAQUE.test(intent.fileRef)) return false
  if (intent.hunkRef !== undefined && !OPAQUE.test(intent.hunkRef)) return false
  const blob = `${intent.repositoryRef}|${intent.worktreeRef}|${intent.fileRef ?? ''}|${intent.message ?? ''}`
  return !blob.includes('--') && !blob.startsWith('/') && !/file:\/\/|token|cookie/i.test(blob)
}

/**
 * 超时与 unknown 只能进入 reconcile，不得自动重试，也不得把进行中的提交标成成功。
 */
export function reconcileClientGitReceipt(
  intent: GitClientMutationIntentV1,
  receipt: GitClientMutationReceiptV1 | undefined,
  options: { readonly timedOut?: boolean } = {},
): GitClientMutationReceiptV1 {
  if (options.timedOut === true) {
    return {
      status: 'timeout',
      actionId: intent.kind,
      idempotencyKey: intent.idempotencyKey,
      reason: 'git mutation timed out; reconcile required',
    }
  }
  if (receipt === undefined || receipt.idempotencyKey !== intent.idempotencyKey) {
    return {
      status: receipt === undefined ? 'unknown' : 'reconcile_required',
      actionId: intent.kind,
      idempotencyKey: intent.idempotencyKey,
      reason: 'git mutation receipt is incomplete; query before any new submit',
    }
  }
  return receipt
}

export function gitClientTimeoutMarksSuccess(): false {
  return false
}

export function gitClientTimeoutAutoRetries(): false {
  return false
}
