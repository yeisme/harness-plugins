/**
 * DSH Command Experience Host Adapter
 *
 * Host-side adapter for DSH owner action/receipt projection and capability probing.
 */

// Types
export type {
  ThreadRef,
  SessionRef,
  PresetRef,
  ThreadProjection,
  SessionProjection,
  OwnerActionDescriptor,
  OwnerActionRequest,
  OwnerActionReceipt,
  CapabilityProbeResult,
  CompatibilityMapping,
} from './types';

// Capability probe
export {
  probeCapabilities,
  createActivationFailure,
  formatProbeError,
  TARGET_DSH_VERSION,
} from './capability-probe';

// Owner action adapter
export {
  type OwnerActionAdapter,
  createThreadOpenRequest,
  createSessionResumeRequest,
  createNewChatRequest,
  createForkChatRequest,
  createRenameRequest,
  createCompactRequest,
  createDeleteRequest,
  isValidReceipt,
  areReceiptsEquivalent,
  createMockAdapter,
} from './owner-action-adapter';
