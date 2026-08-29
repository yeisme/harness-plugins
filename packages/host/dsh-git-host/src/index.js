/**
 * @yeisme/dsh-git-host.
 *
 * Typed Git actions for the Git Manager Pane. Canonical git state stays with
 * the repository owner. This host never runs arbitrary argv and never mutates
 * Ordo scheduler or writer-lease state.
 *
 * @module @yeisme/dsh-git-host
 */
export const GIT_TYPED_ACTIONS_CAPABILITY = 'GitTypedActionsCapabilityV1';
export const GIT_STATUS_PROJECTION_CAPABILITY_V2 = 'GitStatusProjectionCapabilityV2';
export const GIT_DIFF_WINDOW_CAPABILITY = 'GitDiffWindowCapabilityV1';
export const GIT_STATUS_WINDOW_CAPABILITY_V1 = 'GitStatusWindowCapabilityV1';
export const GIT_DIFF_WINDOW_CAPABILITY_V2 = 'GitDiffWindowCapabilityV2';
export const GIT_MUTATION_ACTIONS_CAPABILITY_V2 = 'GitMutationActionsCapabilityV2';
export const GIT_HISTORY_WINDOW_CAPABILITY_V1 = 'GitHistoryWindowCapabilityV1';
export const GIT_COMPARE_SESSION_CAPABILITY_V1 = 'GitCompareSessionCapabilityV1';
export const GIT_STASH_PROJECTION_CAPABILITY_V1 = 'GitStashProjectionCapabilityV1';
export const GIT_STASH_ACTIONS_CAPABILITY_V1 = 'GitStashActionsCapabilityV1';
export const GIT_TAG_PROJECTION_CAPABILITY_V1 = 'GitTagProjectionCapabilityV1';
export const GIT_TAG_ACTIONS_CAPABILITY_V1 = 'GitTagActionsCapabilityV1';
export const GIT_BRANCH_ACTIONS_CAPABILITY = 'GitBranchActionsCapabilityV1';
export const GIT_REMOTE_ACTIONS_CAPABILITY = 'GitRemoteActionsCapabilityV1';
export const GIT_WORKTREE_ACTIONS_CAPABILITY_V2 = 'GitWorktreeActionsCapabilityV2';
export const GIT_OPTIONAL_CAPABILITIES_V2 = [
    GIT_STATUS_PROJECTION_CAPABILITY_V2,
    GIT_DIFF_WINDOW_CAPABILITY,
    GIT_BRANCH_ACTIONS_CAPABILITY,
    GIT_REMOTE_ACTIONS_CAPABILITY,
    GIT_WORKTREE_ACTIONS_CAPABILITY_V2,
];
export const GIT_REVIEW_WORKBENCH_CAPABILITIES_V1 = [
    GIT_STATUS_WINDOW_CAPABILITY_V1,
    GIT_DIFF_WINDOW_CAPABILITY_V2,
    GIT_MUTATION_ACTIONS_CAPABILITY_V2,
    GIT_HISTORY_WINDOW_CAPABILITY_V1,
    GIT_COMPARE_SESSION_CAPABILITY_V1,
    GIT_STASH_PROJECTION_CAPABILITY_V1,
    GIT_STASH_ACTIONS_CAPABILITY_V1,
    GIT_TAG_PROJECTION_CAPABILITY_V1,
    GIT_TAG_ACTIONS_CAPABILITY_V1,
];
export const GIT_TYPED_ACTIONS = [
    'status',
    'diff',
    'stage',
    'unstage',
    'commit',
    'worktree.create',
    'worktree.remove',
];
export const GIT_GATED_ACTIONS = ['commit', 'worktree.create', 'worktree.remove'];
const TYPED = new Set(GIT_TYPED_ACTIONS);
const GATED = new Set(GIT_GATED_ACTIONS);
export function isGitTypedAction(actionId) {
    return TYPED.has(actionId);
}
const OPAQUE_GIT_REF = /^[A-Za-z0-9._~:-]{1,160}$/;
export function isSafeGitOpaqueRef(value) {
    return OPAQUE_GIT_REF.test(value) && !value.startsWith('/') && !value.includes('--') && !value.includes(' ');
}
export function probeGitOptionalCapability(host, capability) {
    if (host === undefined)
        return { available: false, capability, reason: 'git owner is offline' };
    const advertised = host.capabilities ?? [];
    if (!advertised.includes(capability))
        return { available: false, capability, reason: `missing ${capability}` };
    const present = capability === GIT_STATUS_PROJECTION_CAPABILITY_V2 ? host.statusProjection !== undefined
        : capability === GIT_DIFF_WINDOW_CAPABILITY ? host.diffWindow !== undefined
            : capability === GIT_BRANCH_ACTIONS_CAPABILITY ? host.branchActions !== undefined
                : capability === GIT_REMOTE_ACTIONS_CAPABILITY ? host.remoteActions !== undefined
                    : host.worktreeActions !== undefined;
    if (!present)
        return { available: false, capability, reason: `missing ${capability} handle` };
    return { available: true, capability, reason: `${capability} available` };
}
export function probeGitReviewWorkbenchCapability(host, capability) {
    if (host === undefined)
        return { available: false, capability, reason: 'git owner is offline' };
    if (!(host.capabilities ?? []).includes(capability))
        return { available: false, capability, reason: `missing ${capability}` };
    const handle = capability === GIT_STATUS_WINDOW_CAPABILITY_V1 ? host.statusWindow
        : capability === GIT_DIFF_WINDOW_CAPABILITY_V2 ? host.diffWindowV2
            : capability === GIT_MUTATION_ACTIONS_CAPABILITY_V2 ? host.mutationActionsV2
                : capability === GIT_HISTORY_WINDOW_CAPABILITY_V1 ? host.historyWindow
                    : capability === GIT_COMPARE_SESSION_CAPABILITY_V1 ? host.compareSession
                        : capability === GIT_STASH_PROJECTION_CAPABILITY_V1 ? host.stashProjection
                            : capability === GIT_STASH_ACTIONS_CAPABILITY_V1 ? host.stashActions
                                : capability === GIT_TAG_PROJECTION_CAPABILITY_V1 ? host.tagProjection
                                    : host.tagActions;
    return handle === undefined
        ? { available: false, capability, reason: `missing ${capability} handle` }
        : { available: true, capability, reason: `${capability} available` };
}
export function validateGitWindowRequest(request) {
    if (!isSafeGitOpaqueRef(request.repositoryRef) || !isSafeGitOpaqueRef(request.worktreeRef))
        return false;
    if (!Number.isInteger(request.limit) || request.limit < 1 || request.limit > 500)
        return false;
    if (request.cursor !== undefined && !isSafeGitOpaqueRef(request.cursor))
        return false;
    if ('fileRef' in request && !isSafeGitOpaqueRef(request.fileRef))
        return false;
    if ('ref' in request && request.ref !== undefined && !isSafeGitOpaqueRef(request.ref))
        return false;
    return true;
}
export function validateGitMutationIntentV2(intent) {
    if (!isSafeGitOpaqueRef(intent.repositoryRef) || !isSafeGitOpaqueRef(intent.worktreeRef))
        return false;
    if (!isSafeGitOpaqueRef(intent.expectedRevision) || !isSafeGitOpaqueRef(intent.idempotencyKey))
        return false;
    if (intent.previewDigest !== undefined && !isSafeGitOpaqueRef(intent.previewDigest))
        return false;
    if (intent.backupRef !== undefined && !isSafeGitOpaqueRef(intent.backupRef))
        return false;
    if (intent.fileRefs?.some(ref => !isSafeGitOpaqueRef(ref)) === true)
        return false;
    if (intent.hunkRefs?.some(ref => !isSafeGitOpaqueRef(ref)) === true)
        return false;
    const text = `${intent.message ?? ''}|${intent.overrideReason ?? ''}`;
    return !/authorization|cookie|token|file:\/\//i.test(text) && !text.includes('--');
}
export function gitDiffRevisionDriftV2(window) {
    return window.targetRevision !== window.currentRevision;
}
export function gitDiscardUndoRetentionHours() {
    return 24;
}
export function gitMutationV2AutoStagesCommit() {
    return false;
}
export function gitMutationV2AutoRetriesTimeout() {
    return false;
}
export function validateGitTypedActionId(actionId) {
    return isGitTypedAction(actionId) && !actionId.includes(' ') && !actionId.includes('--');
}
export function admitGitAction(host, actionId) {
    if (host === undefined) {
        return { kind: 'not_available', actionId, reason: 'git owner is offline' };
    }
    const capabilities = host.capabilities ?? [];
    if (!capabilities.includes(GIT_TYPED_ACTIONS_CAPABILITY)) {
        return { kind: 'contract_mismatch', reason: `missing ${GIT_TYPED_ACTIONS_CAPABILITY}` };
    }
    if (!isGitTypedAction(actionId) || actionId.includes(' ') || actionId.includes('--')) {
        return { kind: 'not_available', actionId, reason: 'arbitrary git argv is rejected' };
    }
    const allowed = host.allowedActions ?? GIT_TYPED_ACTIONS;
    if (!allowed.includes(actionId)) {
        return { kind: 'not_available', actionId, reason: 'owner did not publish this action' };
    }
    if (GATED.has(actionId))
        return { kind: 'approval_required', actionId };
    return { kind: 'allowed', actionId };
}
/** Git worktree delete must never be interpreted as an Ordo lease mutation. */
export function gitWorktreeRemoveReleasesOrdoLease() {
    return false;
}
export function createGitHostPlaceholder() {
    return {
        version: '0.1.0-rc.1',
        capability: 'git-host',
        capabilities: [],
        allowedActions: [],
    };
}
