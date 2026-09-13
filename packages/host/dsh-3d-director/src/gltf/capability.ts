import {
  GltfCapabilityReportSchema,
  GltfExtensionNameSchema,
  isOfficialGltfExtension,
  type GltfCapabilityGapV1,
  type GltfCapabilityReportV1,
  type GltfExtensionCapabilityV1,
} from '@yeisme/dsh-pane-protocol'
import { boundedReason } from './types.js'

/**
 * Capability classes for this engine. The host adapter parses only core glTF
 * 2.0 scene structure (scenes, node hierarchy, TRS transforms) with
 * `@gltf-transform/core`; no extension plugins are registered, so no extension
 * payload is ever decoded, edited, or re-emitted.
 *
 * - `resource_opaque`: the payload lives inside mesh/material/texture/asset
 *   internals that the SceneDocumentV1 projection carries only as opaque
 *   resourceRefs. The source asset is never rewritten, so the payload is
 *   preserved verbatim with its owner; the scene-graph snapshot export simply
 *   does not contain it. Import stays possible, export is not blocked.
 * - `scene_structure`: the payload attaches to nodes/scenes/animations that
 *   the projection does represent structurally but cannot parameterize. A
 *   snapshot export would lose it, so export is blocked with a concrete gap.
 * - `unknown_vendor`: well-formed name outside the official registry. Treated
 *   fail-closed like `scene_structure`: readable as an optional declaration,
 *   never silently dropped, export blocked.
 */
type CapabilityClass = 'resource_opaque' | 'scene_structure' | 'unknown_vendor'

const RESOURCE_OPAQUE_NOTE =
  'Payload preserved verbatim with the opaque source resource; not editable and not re-emitted in scene-graph snapshots.'
const SCENE_STRUCTURE_NOTE =
  'Scene-structure payload cannot be represented in the scene-graph snapshot; export is blocked to avoid silent data loss.'
const UNKNOWN_VENDOR_NOTE =
  'Unrecognized vendor extension; declared but not parsed, export is blocked to avoid silent data loss.'

const RESOURCE_OPAQUE_EXTENSIONS = new Set<string>([
  'KHR_draco_mesh_compression',
  'KHR_gaussian_splatting',
  'KHR_materials_anisotropy',
  'KHR_materials_clearcoat',
  'KHR_materials_diffuse_transmission',
  'KHR_materials_dispersion',
  'KHR_materials_emissive_strength',
  'KHR_materials_ior',
  'KHR_materials_iridescence',
  'KHR_materials_pbrSpecularGlossiness',
  'KHR_materials_sheen',
  'KHR_materials_specular',
  'KHR_materials_transmission',
  'KHR_materials_unlit',
  'KHR_materials_variants',
  'KHR_materials_volume',
  'KHR_materials_volume_scatter',
  'KHR_mesh_quantization',
  'KHR_texture_basisu',
  'KHR_texture_transform',
  'KHR_xmp_json_ld',
  'EXT_meshopt_compression',
  'EXT_texture_avif',
  'EXT_texture_webp',
])

const SCENE_STRUCTURE_EXTENSIONS = new Set<string>([
  'KHR_animation_pointer',
  'KHR_interactivity',
  'KHR_lights_punctual',
  'EXT_lights_ies',
  'EXT_mesh_gpu_instancing',
])

function classifyExtension(name: string): CapabilityClass {
  if (RESOURCE_OPAQUE_EXTENSIONS.has(name)) return 'resource_opaque'
  if (SCENE_STRUCTURE_EXTENSIONS.has(name)) return 'scene_structure'
  return 'unknown_vendor'
}

function capabilityEntry(name: string): GltfExtensionCapabilityV1 {
  const capabilityClass = classifyExtension(name)
  switch (capabilityClass) {
    case 'resource_opaque':
      return { name, readable: true, editable: false, exportable: false, opaquePreserved: true, note: RESOURCE_OPAQUE_NOTE }
    case 'scene_structure':
      return { name, readable: true, editable: false, exportable: false, opaquePreserved: false, note: SCENE_STRUCTURE_NOTE }
    default:
      return {
        name,
        readable: true,
        editable: false,
        exportable: false,
        opaquePreserved: false,
        note: isOfficialGltfExtension(name) ? SCENE_STRUCTURE_NOTE : UNKNOWN_VENDOR_NOTE,
      }
  }
}

/**
 * Pure capability evaluation over the extension declarations of an asset or
 * SceneDocumentV1. Every used (and required) name gets exactly one entry, in
 * first-seen order; any extension that can neither be exported nor
 * opaque-preserved blocks export with a concrete gap, per the frozen contract
 * invariant. Throws a bounded Error on malformed extension names — callers
 * that accept untrusted declarations must pre-validate or catch.
 */
export function evaluateGltfCapabilityReport(
  extensionsUsed: readonly string[],
  extensionsRequired: readonly string[] = [],
): GltfCapabilityReportV1 {
  const ordered: string[] = []
  const seen = new Set<string>()
  for (const name of [...extensionsUsed, ...extensionsRequired]) {
    if (seen.has(name)) continue
    if (!GltfExtensionNameSchema.safeParse(name).success) {
      throw new Error(`Malformed glTF extension name rejected: ${boundedReason(name, 80)}`)
    }
    seen.add(name)
    ordered.push(name)
  }

  const extensions = ordered.map(capabilityEntry)
  const gaps: GltfCapabilityGapV1[] = extensions
    .filter(entry => !entry.exportable && !entry.opaquePreserved)
    .map(entry => ({
      extension: entry.name,
      reason: entry.note ?? SCENE_STRUCTURE_NOTE,
    }))

  return GltfCapabilityReportSchema.parse({
    gltfVersion: '2.0',
    extensions,
    export: { ready: gaps.length === 0, gaps },
  })
}
