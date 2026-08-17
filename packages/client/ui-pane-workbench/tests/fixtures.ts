import {
  PANE_ARTIFACT_SCHEMA,
  PANE_EVENT_SCHEMA,
  PANE_PLUGIN_SCHEMA,
  type ArtifactRefV1,
  type PaneContextV1,
  type PaneEventEnvelopeV1,
  type PanePluginDefinitionV1,
} from '@yeisme/dsh-pane-protocol'
import type { PaneRuntimePluginV1 } from '../src/index.js'

export const context: PaneContextV1 = {
  workspaceRef: 'workspace:demo',
  sessionRef: 'session:one',
  principalRef: 'principal:local',
  revision: '1',
}

export const imageArtifact: ArtifactRefV1 = {
  schema: PANE_ARTIFACT_SCHEMA,
  owner: 'eikona',
  kind: 'image',
  ref: 'artifact:eikona:1',
  version: '1',
  mediaType: 'image/png',
  title: 'Variant 1',
  summary: 'Safe image summary',
  evidenceRefs: ['evidence:1'],
  capabilities: ['open', 'handoff'],
}

export function pluginDefinition(id: string, options: {
  permission?: string
  capability?: string
  kind?: string
  componentKey?: string
} = {}): PanePluginDefinitionV1 {
  const kind = options.kind ?? `${id}.view`
  const componentKey = options.componentKey ?? `${id}.component`
  return {
    schema: PANE_PLUGIN_SCHEMA,
    id,
    version: '0.1.0-rc.1',
    owner: { id: id.split('.')[0] ?? 'yeisme' },
    faces: {
      host: { provided: true, capabilities: ['snapshot'] },
      client: { provided: true, capabilities: ['pane.view'] },
      composition: { provided: true, capabilities: ['artifact.intent'] },
      observation: { provided: true, capabilities: ['pane.event'] },
    },
    capabilities: { required: [options.capability ?? 'pane.event.v1'], optional: [] },
    permissions: options.permission === undefined ? [] : [options.permission],
    views: [{
      kind,
      label: id,
      componentKey,
      role: 'content',
      preferredRegion: 'right',
      retention: 'snapshot',
      singleton: false,
    }],
    commands: [],
    artifactKinds: [kind],
    compatibility: { dshApiRange: '0.1.0-rc.6', experimental: true },
  }
}

export function runtimePlugin(id: string, options: Parameters<typeof pluginDefinition>[1] = {}): PaneRuntimePluginV1 {
  const definition = pluginDefinition(id, options)
  return {
    definition,
    viewFactories: Object.fromEntries(definition.views.map(view => [view.componentKey, () => ({ kind: view.kind })])),
  }
}

export function event(
  op: PaneEventEnvelopeV1['op'],
  sequence: number,
  payload: unknown,
  extra: Record<string, unknown> = {},
): unknown {
  return {
    schema: PANE_EVENT_SCHEMA,
    stream: 'canary.stream',
    cursor: String(sequence),
    sequence,
    context,
    occurredAt: new Date(sequence + 1).toISOString(),
    observedAt: new Date(sequence + 1).toISOString(),
    freshness: 'fresh',
    op,
    payload,
    ...extra,
  }
}
