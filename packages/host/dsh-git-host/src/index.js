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
