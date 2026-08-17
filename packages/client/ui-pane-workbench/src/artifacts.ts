import {
  ArtifactIntentSchema,
  ArtifactRefSchema,
  PANE_INTENT_SCHEMA,
  type ArtifactIntentV1,
  type ArtifactRefV1,
  type PaneContextV1,
} from '@yeisme/dsh-pane-protocol'

export interface BuildArtifactIntentOptions {
  readonly intent: ArtifactIntentV1['intent']
  readonly source: ArtifactRefV1
  readonly targetOwner?: string
  readonly targetPaneKind?: string
  readonly context: PaneContextV1
  readonly idempotencyKey: string
}

/** Builds the same owner-neutral intent for pointer, keyboard, menu, or command entrypoints. */
export function buildArtifactIntent(options: BuildArtifactIntentOptions): ArtifactIntentV1 {
  return ArtifactIntentSchema.parse({ schema: PANE_INTENT_SCHEMA, ...options })
}

export function validateArtifactRef(input: unknown): ArtifactRefV1 {
  return ArtifactRefSchema.parse(input)
}
