/**
 * Scenario preset to Workbench module mapping.
 *
 * Drama/Code/Review/Media scenario presets map to Workbench Core module sets
 * through versioned, declarative data. Invalid mappings fail closed; entries
 * that reference an uninstalled module resolve disabled with install guidance
 * while the remaining modules stay enabled. Undeclared modules are never
 * loaded at runtime.
 *
 * @module @yeisme/dsh-workbench-compose
 */

export const WORKBENCH_SCENARIO_MAPPING_SCHEMA = 'workbench.scenario-mapping.v1alpha1' as const
export const WORKBENCH_SCENARIO_MAPPING_VERSION = '1.0.0' as const
export const WORKBENCH_SCENARIO_IDS = Object.freeze(['drama', 'code', 'review', 'media'] as const)
export type WorkbenchScenarioIdV1 = (typeof WORKBENCH_SCENARIO_IDS)[number]

export interface WorkbenchScenarioModuleRefV1 {
  /** Workbench Core module id, for example `dsh-rich-media`. */
  readonly moduleId: string
  /** Bounded install guidance shown when the module is missing, for example a bundle install command or doc anchor. */
  readonly installHint?: string
}

export interface WorkbenchScenarioMappingV1 {
  readonly schema: typeof WORKBENCH_SCENARIO_MAPPING_SCHEMA
  readonly version: string
  readonly scenarios: Readonly<Record<string, readonly WorkbenchScenarioModuleRefV1[]>>
}

export type WorkbenchScenarioMappingValidation =
  | { ok: true; value: WorkbenchScenarioMappingV1 }
  | { ok: false; error: string }

const SCENARIO_ID = /^[a-z0-9][a-z0-9-]{0,63}$/
const MODULE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/i
const PACKAGE_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/
const INSTALL_HINT_MAX = 160
const UNSAFE_PROTOCOL = /^(?:https?|file|javascript|data):/i
const WINDOWS_ABSOLUTE_PATH = /^[A-Za-z]:[\\/]/
const UNC_PATH = /^\\\\/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validateModuleRef(value: unknown): WorkbenchScenarioModuleRefV1 | string {
  if (!isRecord(value)) return 'scenario module entry must be an object'
  const { moduleId, installHint } = value
  if (typeof moduleId !== 'string' || !MODULE_ID.test(moduleId)) return `scenario moduleId invalid: ${String(moduleId)}`
  if (installHint !== undefined) {
    if (typeof installHint !== 'string' || installHint.length === 0 || installHint.length > INSTALL_HINT_MAX) {
      return `installHint invalid for ${moduleId}`
    }
    if (installHint.startsWith('/') || WINDOWS_ABSOLUTE_PATH.test(installHint) || UNC_PATH.test(installHint) || UNSAFE_PROTOCOL.test(installHint)) {
      return `installHint must not carry URLs or absolute paths for ${moduleId}`
    }
  }
  return installHint === undefined ? { moduleId } : { moduleId, installHint }
}

/** Validate the versioned declarative mapping before any resolution. Invalid data fails closed. */
export function validateWorkbenchScenarioMapping(input: unknown): WorkbenchScenarioMappingValidation {
  if (!isRecord(input)) return { ok: false, error: 'scenario mapping must be an object' }
  const { schema, version, scenarios } = input
  if (schema !== WORKBENCH_SCENARIO_MAPPING_SCHEMA) return { ok: false, error: `schema must be ${WORKBENCH_SCENARIO_MAPPING_SCHEMA}` }
  if (typeof version !== 'string' || !PACKAGE_VERSION.test(version)) return { ok: false, error: `version invalid: ${String(version)}` }
  if (!isRecord(scenarios)) return { ok: false, error: 'scenarios must be an object' }
  const parsed: Record<string, readonly WorkbenchScenarioModuleRefV1[]> = {}
  for (const [scenarioId, entries] of Object.entries(scenarios)) {
    if (!SCENARIO_ID.test(scenarioId)) return { ok: false, error: `scenario id invalid: ${scenarioId}` }
    if (!Array.isArray(entries) || entries.length === 0) return { ok: false, error: `scenario ${scenarioId} must declare a non-empty module list` }
    const seen = new Set<string>()
    const refs: WorkbenchScenarioModuleRefV1[] = []
    for (const raw of entries) {
      const result = validateModuleRef(raw)
      if (typeof result === 'string') return { ok: false, error: `scenario ${scenarioId}: ${result}` }
      if (seen.has(result.moduleId)) return { ok: false, error: `scenario ${scenarioId} declares ${result.moduleId} twice` }
      seen.add(result.moduleId)
      refs.push(result)
    }
    parsed[scenarioId] = refs
  }
  return { ok: true, value: { schema: WORKBENCH_SCENARIO_MAPPING_SCHEMA, version, scenarios: parsed } }
}

/** Built-in Drama/Code/Review/Media mapping. Uninstalled entries resolve disabled with install guidance. */
export function createDefaultWorkbenchScenarioMapping(): WorkbenchScenarioMappingV1 {
  return {
    schema: WORKBENCH_SCENARIO_MAPPING_SCHEMA,
    version: WORKBENCH_SCENARIO_MAPPING_VERSION,
    scenarios: {
      drama: [
        { moduleId: 'dsh-ai-drama-director', installHint: 'dsh plugin add @yeisme/dsh-ai-drama-director' },
        { moduleId: 'dsh-file-document' },
        { moduleId: 'dsh-rich-media' },
      ],
      code: [
        { moduleId: 'dsh-file-document' },
        { moduleId: 'dsh-terminal' },
      ],
      review: [
        { moduleId: 'dsh-file-document' },
        { moduleId: 'dsh-rich-media' },
      ],
      media: [
        { moduleId: 'dsh-rich-media' },
        { moduleId: 'dsh-file-document' },
      ],
    },
  }
}

/** Installed module ids, either as a plain list or as a WorkbenchRegistry-like source. */
export type WorkbenchScenarioModuleSource =
  | readonly string[]
  | { snapshot(): { modules: readonly { id: string }[] } }

export interface WorkbenchScenarioEntryV1 {
  readonly moduleId: string
  readonly enabled: boolean
  readonly reason?: 'module_not_installed'
  readonly installHint?: string
}

export type WorkbenchScenarioResolutionV1 =
  | { ok: true; scenario: string; version: string; entries: readonly WorkbenchScenarioEntryV1[] }
  | { ok: false; reason: 'mapping_invalid' | 'scenario_not_declared'; detail: string }

function isRegistrySource(
  source: WorkbenchScenarioModuleSource,
): source is { snapshot(): { modules: readonly { id: string }[] } } {
  return !Array.isArray(source) && typeof (source as { snapshot?: unknown }).snapshot === 'function'
}

function installedModuleIds(source: WorkbenchScenarioModuleSource): ReadonlySet<string> {
  if (isRegistrySource(source)) return new Set(source.snapshot().modules.map(module => module.id))
  return new Set(source)
}

/**
 * Resolves one scenario against the installed modules. The result lists exactly
 * the declared modules — missing ones disabled with guidance, present ones
 * enabled; undeclared modules are never added, and invalid input fails closed.
 */
export function resolveWorkbenchScenarioModules(
  mapping: unknown,
  scenario: string,
  installed: WorkbenchScenarioModuleSource,
): WorkbenchScenarioResolutionV1 {
  const validation = validateWorkbenchScenarioMapping(mapping)
  if (!validation.ok) return { ok: false, reason: 'mapping_invalid', detail: validation.error }
  const declared = validation.value.scenarios[scenario]
  if (declared === undefined) {
    const safeId = SCENARIO_ID.test(scenario) ? scenario : 'invalid-scenario-id'
    return { ok: false, reason: 'scenario_not_declared', detail: `Scenario ${safeId} is not declared by mapping ${validation.value.version}.` }
  }
  const installedIds = installedModuleIds(installed)
  return {
    ok: true,
    scenario,
    version: validation.value.version,
    entries: declared.map(entry => {
      if (installedIds.has(entry.moduleId)) return { moduleId: entry.moduleId, enabled: true }
      return {
        moduleId: entry.moduleId,
        enabled: false,
        reason: 'module_not_installed' as const,
        ...(entry.installHint === undefined ? {} : { installHint: entry.installHint }),
      }
    }),
  }
}
