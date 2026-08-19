/**
 * DSH Workbench Core headless contracts.
 *
 * This module is dependency-free and browser-agnostic. It defines the module
 * and tab descriptors that feature bundles register into the Workbench Core.
 * The descriptors never carry raw paths, credentials, provider payloads, or
 * arbitrary component URLs.
 *
 * @module @yeisme/dsh-workbench-core/types
 */

export const WORKBENCH_TAB_SCOPES = ['root', 'session', 'session-maybe'] as const
export type WorkbenchTabScope = (typeof WORKBENCH_TAB_SCOPES)[number]

export interface WorkbenchTabV1 {
  /** Stable tab id, unique within the Workbench Core. */
  id: string
  /** Owner module id. */
  moduleId: string
  /** Display title. */
  title: string
  /** Optional bounded summary for tooltips/rail mode. */
  summary?: string
  /** Ascending sort order. */
  order: number
  /** Whether the tab can be closed by the user. */
  closable: boolean
  /** Which session context the tab needs. */
  scope: WorkbenchTabScope
}

export interface WorkbenchCommandV1 {
  id: string
  moduleId: string
  title: string
  /** Optional keyboard shortcut hint, not a binding contract. */
  shortcutHint?: string
}

export interface WorkbenchModuleDefinitionV1 {
  /** Stable module id, for example `dsh-rich-media`. */
  id: string
  /** Semantic version of this module. */
  version: string
  /** Safe display name. */
  title: string
  /** Bounded description shown in module management UI. */
  description?: string
  /** Required DSH/Workbench capabilities. Missing capabilities fail closed. */
  requiredCapabilities: readonly string[]
  /** Tabs contributed by this module. */
  tabs: readonly WorkbenchTabV1[]
  /** Commands contributed by this module. */
  commands: readonly WorkbenchCommandV1[]
}

export type WorkbenchModuleValidation =
  | { ok: true; value: WorkbenchModuleDefinitionV1 }
  | { ok: false; error: string }

const ID_RE = /^[a-z0-9][a-z0-9._-]{0,127}$/i
const TITLE_MAX = 120
const SUMMARY_MAX = 300
const DESCRIPTION_MAX = 500

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

function validateTabs(value: unknown): WorkbenchTabV1[] | string {
  if (!Array.isArray(value)) return 'tabs must be an array'
  for (const raw of value) {
    if (!isRecord(raw)) return 'tab must be an object'
    const { id, moduleId, title, summary, order, closable, scope } = raw
    if (typeof id !== 'string' || !ID_RE.test(id)) return `tab.id invalid: ${String(id)}`
    if (typeof moduleId !== 'string' || !ID_RE.test(moduleId)) return `tab.moduleId invalid: ${String(moduleId)}`
    if (typeof title !== 'string' || title.length === 0 || title.length > TITLE_MAX) return `tab.title invalid: ${String(title)}`
    if (summary !== undefined && (typeof summary !== 'string' || summary.length > SUMMARY_MAX)) return `tab.summary invalid for ${String(id)}`
    if (typeof order !== 'number' || !Number.isFinite(order)) return `tab.order invalid for ${String(id)}`
    if (typeof closable !== 'boolean') return `tab.closable invalid for ${String(id)}`
    if (typeof scope !== 'string' || !(WORKBENCH_TAB_SCOPES as readonly string[]).includes(scope)) return `tab.scope invalid for ${String(id)}`
  }
  return value as WorkbenchTabV1[]
}

function validateCommands(value: unknown): WorkbenchCommandV1[] | string {
  if (!Array.isArray(value)) return 'commands must be an array'
  for (const raw of value) {
    if (!isRecord(raw)) return 'command must be an object'
    const { id, moduleId, title, shortcutHint } = raw
    if (typeof id !== 'string' || !ID_RE.test(id)) return `command.id invalid: ${String(id)}`
    if (typeof moduleId !== 'string' || !ID_RE.test(moduleId)) return `command.moduleId invalid: ${String(moduleId)}`
    if (typeof title !== 'string' || title.length === 0 || title.length > TITLE_MAX) return `command.title invalid: ${String(id)}`
    if (shortcutHint !== undefined && (typeof shortcutHint !== 'string' || shortcutHint.length > 80)) return `command.shortcutHint invalid for ${String(id)}`
  }
  return value as WorkbenchCommandV1[]
}

/** Validate a module descriptor before registration. */
export function validateWorkbenchModule(value: unknown): WorkbenchModuleValidation {
  if (!isRecord(value)) return { ok: false, error: 'module must be an object' }
  const { id, version, title, description, requiredCapabilities, tabs, commands } = value
  if (typeof id !== 'string' || !ID_RE.test(id)) return { ok: false, error: `id invalid: ${String(id)}` }
  if (typeof version !== 'string' || version.length === 0 || version.length > 64) return { ok: false, error: `version invalid: ${String(version)}` }
  if (typeof title !== 'string' || title.length === 0 || title.length > TITLE_MAX) return { ok: false, error: `title invalid: ${String(title)}` }
  if (description !== undefined && (typeof description !== 'string' || description.length > DESCRIPTION_MAX)) return { ok: false, error: `description invalid for ${String(id)}` }
  if (!isStringArray(requiredCapabilities)) return { ok: false, error: `requiredCapabilities must be a string array for ${String(id)}` }
  const tabsResult = validateTabs(tabs)
  if (typeof tabsResult === 'string') return { ok: false, error: tabsResult }
  const commandsResult = validateCommands(commands)
  if (typeof commandsResult === 'string') return { ok: false, error: commandsResult }

  const result: WorkbenchModuleDefinitionV1 = {
    id,
    version,
    title,
    ...description === undefined ? {} : { description },
    requiredCapabilities: [...requiredCapabilities],
    tabs: tabsResult,
    commands: commandsResult,
  }
  return { ok: true, value: result }
}

/** Type guard built on the same validation. */
export function isWorkbenchModule(value: unknown): value is WorkbenchModuleDefinitionV1 {
  return validateWorkbenchModule(value).ok
}
