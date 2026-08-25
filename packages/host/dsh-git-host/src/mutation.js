import { GIT_BRANCH_ACTIONS_CAPABILITY, GIT_REMOTE_ACTIONS_CAPABILITY, GIT_TYPED_ACTIONS_CAPABILITY, GIT_WORKTREE_ACTIONS_CAPABILITY_V2, admitGitAction, isSafeGitOpaqueRef, probeGitOptionalCapability, } from './index.js';
export const GIT_MUTATION_KINDS = ['stage', 'unstage', 'discard', 'commit'];
export const GIT_REMOTE_ACTIONS = ['fetch', 'pull', 'push'];
export const GIT_BRANCH_MUTATIONS = ['create', 'switch', 'delete'];
export const GIT_WORKTREE_MUTATIONS = ['create', 'remove'];
const DIGEST = /^[A-Za-z0-9._~:-]{1,160}$/;
function unsafeIntentBlob(intent) {
    const blob = `${intent.repositoryRef}|${intent.worktreeRef}|${intent.fileRef ?? ''}|${intent.hunkRef ?? ''}|${intent.message ?? ''}`;
    return blob.includes('--') || blob.includes(' ') || /file:\/\/|authorization|cookie|token/i.test(blob);
}
export function validateGitMutationIntent(intent) {
    if (!GIT_MUTATION_KINDS.includes(intent.kind))
        return false;
    if (!isSafeGitOpaqueRef(intent.repositoryRef) || !isSafeGitOpaqueRef(intent.worktreeRef))
        return false;
    if (!isSafeGitOpaqueRef(intent.expectedRevision) || !DIGEST.test(intent.previewDigest) || !DIGEST.test(intent.idempotencyKey))
        return false;
    if (intent.fileRef !== undefined && !isSafeGitOpaqueRef(intent.fileRef))
        return false;
    if (intent.hunkRef !== undefined && !isSafeGitOpaqueRef(intent.hunkRef))
        return false;
    return !unsafeIntentBlob(intent);
}
export function admitGitMutationIntent(host, intent, currentRevision) {
    if (!validateGitMutationIntent(intent)) {
        return { kind: 'contract_mismatch', actionId: intent.kind, reason: 'git mutation intent failed closed' };
    }
    if (currentRevision !== undefined && currentRevision !== intent.expectedRevision) {
        return { kind: 'revision_drift', actionId: intent.kind, reason: 'expected revision no longer matches owner projection' };
    }
    if (intent.kind === 'discard') {
        if (host === undefined)
            return { kind: 'not_available', actionId: 'discard', reason: 'git owner is offline' };
        const capabilities = host.capabilities ?? [];
        if (!capabilities.includes(GIT_TYPED_ACTIONS_CAPABILITY)) {
            return { kind: 'contract_mismatch', actionId: 'discard', reason: `missing ${GIT_TYPED_ACTIONS_CAPABILITY}` };
        }
        return { kind: 'approval_required', actionId: 'discard', reason: 'discard requires owner preview and approval' };
    }
    const mapped = intent.kind === 'commit' ? 'commit' : intent.kind === 'unstage' ? 'unstage' : 'stage';
    const admission = admitGitAction(host, mapped);
    if (admission.kind === 'contract_mismatch')
        return { kind: 'contract_mismatch', actionId: intent.kind, reason: admission.reason };
    if (admission.kind === 'not_available')
        return { kind: 'not_available', actionId: intent.kind, reason: admission.reason };
    if (admission.kind === 'approval_required')
        return { kind: 'approval_required', actionId: intent.kind, reason: `${intent.kind} requires owner approval` };
    return { kind: 'allowed', actionId: intent.kind, reason: `${intent.kind} admitted` };
}
/**
 * 超时与 unknown 只能标 reconcile，不能当成功，也不能自动重试。
 * 浏览器持有 idempotency key，下一次只能查询 receipt，不得再提交同一副作用。
 */
export function reconcileGitMutationReceipt(intent, receipt, options = {}) {
    if (options.timedOut === true) {
        return {
            status: 'timeout',
            actionId: intent.kind,
            idempotencyKey: intent.idempotencyKey,
            reason: 'git mutation timed out; reconcile required',
        };
    }
    if (receipt === undefined) {
        return {
            status: 'unknown',
            actionId: intent.kind,
            idempotencyKey: intent.idempotencyKey,
            reason: 'git mutation receipt missing; reconcile required',
        };
    }
    if (receipt.idempotencyKey !== intent.idempotencyKey) {
        return {
            status: 'reconcile_required',
            actionId: intent.kind,
            idempotencyKey: intent.idempotencyKey,
            reason: 'receipt idempotency does not match the submitted intent',
        };
    }
    if (receipt.status === 'ok' || receipt.status === 'rejected' || receipt.status === 'approval_required' || receipt.status === 'revision_drift') {
        return receipt;
    }
    return { ...receipt, status: receipt.status === 'timeout' ? 'timeout' : 'unknown' };
}
export function gitMutationTimeoutIsSuccess() {
    return false;
}
export function gitMutationTimeoutShouldRetry() {
    return false;
}
export function admitGitBranchMutation(host, action) {
    const probe = probeGitOptionalCapability(host, GIT_BRANCH_ACTIONS_CAPABILITY);
    if (!probe.available)
        return { kind: 'not_available', actionId: action, reason: probe.reason };
    const allowed = host?.branchActions?.actions ?? [];
    if (!allowed.includes(action))
        return { kind: 'not_available', actionId: action, reason: `branch ${action} is not published` };
    if (action === 'delete')
        return { kind: 'approval_required', actionId: action, reason: 'branch delete requires preview and approval' };
    return { kind: 'allowed', actionId: action, reason: `branch ${action} available` };
}
export function admitGitRemoteAction(host, action) {
    const probe = probeGitOptionalCapability(host, GIT_REMOTE_ACTIONS_CAPABILITY);
    if (!probe.available)
        return { kind: 'not_available', actionId: action, reason: probe.reason };
    const allowed = host?.remoteActions?.actions ?? [];
    if (!allowed.includes(action))
        return { kind: 'not_available', actionId: action, reason: `remote ${action} is not published` };
    if (action === 'push' || action === 'pull') {
        return { kind: 'approval_required', actionId: action, reason: `${action} requires preflight and approval` };
    }
    return { kind: 'allowed', actionId: action, reason: `remote ${action} available` };
}
export function createGitRemotePreflight(action, remote, ref) {
    if (!isSafeGitOpaqueRef(remote) || !isSafeGitOpaqueRef(ref))
        return undefined;
    if (action !== 'fetch' && action !== 'pull' && action !== 'push')
        return undefined;
    return { action, remote, ref, force: false };
}
export function gitRemoteForcePushDefault() {
    return false;
}
export function admitGitWorktreeMutation(host, action, lease) {
    const probe = probeGitOptionalCapability(host, GIT_WORKTREE_ACTIONS_CAPABILITY_V2);
    if (!probe.available)
        return { kind: 'not_available', actionId: action, reason: probe.reason };
    const allowed = host?.worktreeActions?.actions ?? [];
    if (!allowed.includes(action))
        return { kind: 'not_available', actionId: action, reason: `worktree ${action} is not published` };
    if (host?.worktreeActions?.releasesOrdoLease !== false) {
        return { kind: 'contract_mismatch', actionId: action, reason: 'Git worktree actions must not release an Ordo lease' };
    }
    if (action === 'remove' && lease?.active === true) {
        return {
            kind: 'lease_blocked',
            actionId: action,
            reason: lease.reason ?? 'Ordo writer lease is active; Git Pane cannot release it',
        };
    }
    if (action === 'remove' || action === 'create') {
        return { kind: 'approval_required', actionId: action, reason: `worktree ${action} requires preview and approval` };
    }
    return { kind: 'allowed', actionId: action, reason: `worktree ${action} available` };
}
export function gitPaneReleasesOrdoLease() {
    return false;
}
