export { LocalStudioCLI, localStudioConfigPath, localStudioConfigSchema, saveLocalStudioConfig } from './local-cli.ts'
export { createEikonaStudioAdapter } from './eikona-studio-adapter.ts'
export { withEikonaGeneration } from './eikona-generation-adapter.ts'
export { CreatorStudioOwnerDirectory } from './directory.ts'
export { createSelectableEikonaReviewAdapter } from './eikona-selection-adapter.ts'
export { normalizeAuctraWorkingCopyOpen, normalizeAuctraTextUnitList, normalizeAuctraWorkingCopyCandidate, normalizeAuctraCandidateAdopt } from './auctra-working-copy.ts'
export { AuctraWorkingCopyClient, AUCTRA_WORKING_COPY_SCHEMA_DIGEST } from './auctra-working-copy-client.ts'
export { createLocalAuctraAdapter, localAuctraConfigSchema } from './local-auctra.ts'
export type { LocalAuctraConfig } from './local-auctra.ts'
export type { AuctraWorkingCopyConnection, AuctraWorkingCopyReadResult, AuctraWorkingCopySaveResult, AuctraWorkingCopyCandidateResult, AuctraWorkingCopyAdoptResult } from './auctra-working-copy-client.ts'
export {
  CREATOR_STUDIO_EXPECTED_CONTEXT,
  CREATOR_STUDIO_OWNER_DIRECTORY,
  CreatorStudioGateway,
} from './gateway.ts'
export {
  creatorOwnerSnapshotSchema,
  creatorApprovalDecisionSchema,
  creatorAssetPageSchema,
  creatorAssetQuerySchema,
  creatorStudioContextSchema,
  creatorStudioSnapshotSchema,
  validateCreatorActionDescriptor,
  validateCreatorActionReceipt,
  validateCreatorApprovalDecision,
  validateCreatorAsset,
  validateCreatorArtifactContent,
  validateCreatorAssetPage,
  validateCreatorAssetQuery,
  validateCreatorOwnerAssetList,
  validateCreatorMediaAccess,
  validateCreatorOwnerSnapshot,
  validateCreatorStudioContext,
  validateCreatorStudioSnapshot,
} from './validation.ts'
export * from './types.ts'
export { ScaenaProductionReads, scaenaProductionPageQuerySchema } from './scaena-production-reads.ts'
export type { ScaenaProductionPageQuery, ScaenaProductionPageResult } from './scaena-production-reads.ts'
export {
  validateScaenaPortfolioProjection, validateScaenaCockpitProjection, validateScaenaReviewQueueProjection, validateScaenaEvidenceExportProjection,
  SCAENA_PRODUCTION_STAGES, SCAENA_PRODUCTION_STAGE_STATUSES,
} from './scaena-production-contract.ts'
export type {
  ScaenaPortfolioProjection, ScaenaCockpitProjection, ScaenaReviewQueueProjection, ScaenaEvidenceExportProjection,
  ScaenaProductionView, ScaenaProductionStage, ScaenaProductionStageStatus, ScaenaProjectionActionDescriptor, ScaenaProductionReadReason,
} from './scaena-production-contract.ts'
export { withLocalScaenaStoryboardActions, readScaenaPackageProjection, scaenaStoryboardReceipt, invokeScaenaMutation, scaenaUnconfirmedReceipt, ScaenaFlightMemory, scaenaStoryboardBaseDescriptors, scaenaStoryboardActionIds } from './scaena-storyboard-actions.ts'
export { scaenaVisualAcceptanceActionIds, visualAcceptanceDescriptors, visualAcceptanceDispatch } from './scaena-visual-acceptance.ts'
export { scaenaWaveActionIds, waveDescriptors, waveDispatch, deriveScaenaWavePreview, deriveScaenaWaveCardPreview, parseScaenaPlannedWave, SCAENA_WAVE_KINDS } from './scaena-wave-preview.ts'
export type { ScaenaWavePreview, ScaenaWaveActionId } from './scaena-wave-preview.ts'
export { readScaenaDeliveryPage, scaenaDeliveryQuerySchema, scaenaExportGate } from './scaena-export-delivery.ts'
export type { ScaenaDeliveryPageResult, ScaenaDeliveryQuery } from './scaena-export-delivery.ts'
export { ScaenaPackageEventsClient, scaenaPackageEventsQuerySchema, verifyScaenaPackagePin } from './scaena-review-package-transport.ts'
export type { ScaenaPackageEventsResult, ScaenaPackageEventsQuery, ScaenaPackagePin, ScaenaPackagePinVerification } from './scaena-review-package-transport.ts'
export { withLocalScaenaProduction, scaenaCockpitToProduction } from './local-scaena-production.ts'
export { scaenaPackageProjectionSchema, scaenaPackageExportManifestSchema, scaenaGenerationWaveSchema, scaenaDigestRef } from './scaena-package-contract.ts'
export type { ScaenaPackageProjection, ScaenaPackageExportManifest, ScaenaGenerationWave, ScaenaInvoke } from './scaena-package-contract.ts'
export { SonoraSubtitleExportClient } from './sonora-subtitle-export.ts'
export { SonoraWorksTableClient, validateSonoraWorksTable } from './sonora-works-table.ts'
export type { SonoraWorksConnection, SonoraWorksTable, SonoraWorksTableRow, SonoraWorksTableResult } from './sonora-works-table.ts'
export { SonoraWorkspaceClient } from './sonora-workspace.ts'
export { SonoraCapabilityMatrixClient } from './sonora-capability-matrix.ts'
export { SonoraAuditionClient } from './sonora-audition.ts'
export { SonoraSubtitleHandoffClient } from './sonora-subtitle-handoff.ts'
export { createSonoraSubtitleExportAdapter } from './sonora-subtitle-adapter.ts'
export type { SonoraAudioStudioExtras } from './sonora-subtitle-adapter.ts'
export type { SonoraTranscriptionCatalog } from './sonora-transcription-catalog.ts'
export type { SonoraCapabilityMatrix, SonoraCapabilityMatrixEntry, SonoraCapabilityFamily } from './sonora-capability-matrix.ts'
export type { SonoraWorkspaceBoard, SonoraWorkspaceActionDescriptor, SonoraWorkspaceActionReceipt } from './sonora-workspace.ts'
export type { SonoraSubtitleHandoff, SonoraSubtitleHandoffResult } from './sonora-subtitle-handoff.ts'
export type { SonoraAudioJob, SonoraAudioAsset, SonoraArtifactAccessGrant } from './sonora-audition.ts'
export type { SonoraSubtitleConnection, SonoraSubtitleExportInput, SonoraSubtitleExportResource, SonoraSubtitleExportResult } from './sonora-subtitle-export.ts'
export { validateCreatorArtifactImage, CREATOR_ARTIFACT_IMAGE_MAX_BYTES } from './artifact-image.ts'
export { ProjectCanvasStore, projectCanvasDomainSpec, projectCanvasRowSchema } from './project-canvas-store.ts'
export type { ProjectCanvasStorage, ProjectCanvasTable, ProjectCanvasDomainSpec } from './project-canvas-store.ts'
export { OperationIdentityStore, operationIdentityDomainSpec } from './operation-identity-store.ts'
export { OperationRecoveryStore, operationRecoveryDomainSpec } from './operation-recovery-store.ts'
export type { OperationRecoveryStorage, OperationRecoveryRow } from './operation-recovery-store.ts'
export type { OperationIdentityStorage, CreatorOperationIdentityV1 } from './operation-identity-store.ts'
export { createAuctraWorkingCopyAdapter, type AuctraWorkingCopySelection } from './auctra-working-copy-adapter.ts'
export { normalizeAuctraWorkingCopyReceipt } from './auctra-working-copy.ts'

export { AUCTRA_EDITOR_RECOVERY_SCHEMA_DIGEST } from './auctra-editor-recovery.ts'

export { EikonaDiscoveryClient, type EikonaDiscoveryConnection } from './eikona-discovery-client.ts'
export { createEikonaDiscoveryAdapter } from './eikona-discovery-adapter.ts'
export { createEikonaReviewAdapter, type EikonaReviewSelection } from './eikona-review-adapter.ts'

export { CreatorInputIntake } from "./input-intake.ts"
export { inputViewSchema, inputQuerySchema } from "./input-contract.ts"
export type { InputControl, InputHostSeams, SelectedInputFile } from "./input-intake.ts"
