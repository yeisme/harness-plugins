/**
 * Additive command-entry convergence for the 31-bundle inventory.
 *
 * Consumes the frozen command-first directory seam. Does not replace
 * Modal/button surfaces. Old paths stay probe-first fallbacks.
 */

import type { CommandDanger, CommandExperienceEntryV1, CommandOwner } from './types'
import { normalizeCommandEntry } from './directory'
import {
  createLiveSlashDirectory,
  type LiveSlashDirectory,
} from './live-directory'
import { commandDraftReducer, createInitialDraft } from './draft'

export const CONVERGENCE_SOURCE = 'entry-convergence'
export const CONVERGENCE_SOURCE_PRIORITY = 40

export type ConvergenceDisposition = 'converged' | 'no-command-semantics' | 'exempt'

export interface BundleEntryLedgerRow {
  readonly bundleId: string
  readonly disposition: ConvergenceDisposition
  readonly reason: string
  readonly commands: readonly ConvergenceCommandSeed[]
  readonly oldPath: string | null
}

export interface ConvergenceCommandSeed {
  readonly canonicalName: string
  readonly aliases?: readonly string[]
  readonly description: string
  readonly category: string
  readonly danger: CommandDanger
  readonly owner: CommandOwner
  readonly actionKind: CommandExperienceEntryV1['actionKind']
  readonly schemaKey: string
}

const LEDGER: readonly BundleEntryLedgerRow[] = [
  { bundleId: 'anchored-standard', disposition: 'no-command-semantics', reason: 'Installer/preset pack; no command action', commands: [], oldPath: null },
  { bundleId: 'dsh-command-experience', disposition: 'exempt', reason: 'Owns the live slash+Palette directory', commands: [], oldPath: 'command-menu' },
  { bundleId: 'dsh-yeisme-commands', disposition: 'exempt', reason: 'Host inspect commands already projected', commands: [], oldPath: null },
  { bundleId: 'pane-workbench', disposition: 'exempt', reason: 'Pane hub already projected as /pane', commands: [], oldPath: 'paneWorkbench.openView' },
  { bundleId: 'pane-agent-context', disposition: 'exempt', reason: 'Picker view already projected via /pane', commands: [], oldPath: 'workspace.agent-context' },
  { bundleId: 'pane-domain', disposition: 'exempt', reason: 'Picker view already projected via /pane', commands: [], oldPath: 'workspace.domain' },
  { bundleId: 'pane-subagent', disposition: 'exempt', reason: 'Picker view already projected via /pane', commands: [], oldPath: 'workspace.subagent' },
  { bundleId: 'dsh-mermaid-render', disposition: 'no-command-semantics', reason: 'Fence renderer; no discrete command', commands: [], oldPath: null },
  { bundleId: 'dsh-rich-media', disposition: 'no-command-semantics', reason: 'Media preview overlay; no discrete command', commands: [], oldPath: 'desktop.media' },
  { bundleId: 'dsh-selection-annotation', disposition: 'no-command-semantics', reason: 'Selection overlay; no discrete command', commands: [], oldPath: null },
  { bundleId: 'dsh-next-step-suggestions', disposition: 'no-command-semantics', reason: 'Chips write composer draft only', commands: [], oldPath: 'conversation.input.dock' },
  { bundleId: 'dsh-conversation-rewrite', disposition: 'no-command-semantics', reason: 'In-conversation rewrite control', commands: [], oldPath: null },
  { bundleId: 'dsh-interaction-space', disposition: 'no-command-semantics', reason: 'Space chrome; no discrete command', commands: [], oldPath: null },
  {
    bundleId: 'dsh-token-usage',
    disposition: 'converged',
    reason: 'Header Tokens action is a command-like open',
    commands: [{ canonicalName: 'token-usage', description: 'Open the token usage ledger', category: 'work', danger: 'safe', owner: 'host', actionKind: 'navigation', schemaKey: 'inspect:token-usage' }],
    oldPath: 'token-usage-open',
  },
  {
    bundleId: 'dsh-devtools',
    disposition: 'converged',
    reason: 'Devtools panel open is a command-like action',
    commands: [{ canonicalName: 'devtools', description: 'Open developer tools', category: 'work', danger: 'safe', owner: 'host', actionKind: 'navigation', schemaKey: 'inspect:devtools' }],
    oldPath: 'workspace.devtools',
  },
  {
    bundleId: 'dsh-browser-pane',
    disposition: 'converged',
    reason: 'Browser pane registerCommand open',
    commands: [{ canonicalName: 'browser', description: 'Open the browser pane', category: 'work', danger: 'safe', owner: 'host', actionKind: 'navigation', schemaKey: 'inspect:browser' }],
    oldPath: 'workspace.browser',
  },
  {
    bundleId: 'dsh-terminal',
    disposition: 'converged',
    reason: 'Terminal pane registerCommand open',
    commands: [{ canonicalName: 'terminal', description: 'Open the terminal pane', category: 'work', danger: 'safe', owner: 'host', actionKind: 'navigation', schemaKey: 'inspect:terminal' }],
    oldPath: 'workspace.terminal',
  },
  {
    bundleId: 'dsh-file-document',
    disposition: 'converged',
    reason: 'Document pane open is a command-like action',
    commands: [{ canonicalName: 'document', description: 'Open the document pane', category: 'work', danger: 'safe', owner: 'host', actionKind: 'navigation', schemaKey: 'inspect:document' }],
    oldPath: 'workspace.document',
  },
  {
    bundleId: 'dsh-desktop-workbench',
    disposition: 'converged',
    reason: 'Desktop workbench openers are command-like',
    commands: [{ canonicalName: 'desktop', description: 'Open the desktop workbench', category: 'work', danger: 'safe', owner: 'host', actionKind: 'navigation', schemaKey: 'inspect:desktop' }],
    oldPath: 'desktop.workbench',
  },
  {
    bundleId: 'dsh-creator-studio',
    disposition: 'converged',
    reason: 'Creator launcher already documented as optional slash.name',
    commands: [{ canonicalName: 'creator', description: 'Open Creator Studio', category: 'work', danger: 'safe', owner: 'host', actionKind: 'navigation', schemaKey: 'inspect:creator' }],
    oldPath: 'workspace.creator',
  },
  {
    bundleId: 'dsh-mcp-inspector',
    disposition: 'exempt',
    reason: 'Already live as /mcp when the inspector surface is present',
    commands: [],
    oldPath: 'workspace.mcp-inspector',
  },
  {
    bundleId: 'dsh-session-tags',
    disposition: 'converged',
    reason: 'Session tags panel open is a command-like action',
    commands: [{ canonicalName: 'tags', description: 'Open session tags', category: 'session', danger: 'safe', owner: 'host', actionKind: 'navigation', schemaKey: 'inspect:tags' }],
    oldPath: 'workspace.session-tags',
  },
  {
    bundleId: 'dsh-session-cookie-manager',
    disposition: 'converged',
    reason: 'Cookie manager open is a command-like action',
    commands: [{ canonicalName: 'cookies', description: 'Open session cookies', category: 'session', danger: 'safe', owner: 'host', actionKind: 'navigation', schemaKey: 'inspect:cookies' }],
    oldPath: 'workspace.cookies',
  },
  {
    bundleId: 'dsh-semantic-file-editor',
    disposition: 'converged',
    reason: 'Semantic editor open is a command-like action',
    commands: [{ canonicalName: 'semantic-edit', description: 'Open the semantic file editor', category: 'work', danger: 'safe', owner: 'host', actionKind: 'navigation', schemaKey: 'inspect:semantic-edit' }],
    oldPath: 'workspace.semantic-editor',
  },
  {
    bundleId: 'dsh-personal-radar',
    disposition: 'converged',
    reason: 'Radar pane open is a command-like action',
    commands: [{ canonicalName: 'radar', description: 'Open personal radar', category: 'work', danger: 'safe', owner: 'host', actionKind: 'navigation', schemaKey: 'inspect:radar' }],
    oldPath: 'workspace.radar',
  },
  {
    bundleId: 'dsh-ai-drama-director',
    disposition: 'converged',
    reason: 'Drama director pane open is a command-like action',
    commands: [{ canonicalName: 'drama', description: 'Open the AI drama director', category: 'work', danger: 'safe', owner: 'host', actionKind: 'navigation', schemaKey: 'inspect:drama' }],
    oldPath: 'workspace.drama',
  },
  {
    bundleId: 'dsh-workbench-compose',
    disposition: 'converged',
    reason: 'Compose workspace open is a command-like action',
    commands: [{ canonicalName: 'compose', description: 'Open workbench compose', category: 'work', danger: 'safe', owner: 'host', actionKind: 'navigation', schemaKey: 'inspect:compose' }],
    oldPath: 'workspace.compose',
  },
  {
    bundleId: 'dsh-workbench-core',
    disposition: 'converged',
    reason: 'Workbench command palette actions converge into the shared directory',
    commands: [{ canonicalName: 'workbench', description: 'Open workbench commands', category: 'work', danger: 'safe', owner: 'host', actionKind: 'navigation', schemaKey: 'inspect:workbench' }],
    oldPath: 'workbench.command-palette',
  },
  {
    bundleId: 'dsh-side-chat',
    disposition: 'converged',
    reason: 'Side chat open is a command-like action',
    commands: [{ canonicalName: 'sidechat', description: 'Open side chat', category: 'work', danger: 'safe', owner: 'host', actionKind: 'navigation', schemaKey: 'inspect:sidechat' }],
    oldPath: 'workspace.side-chat',
  },
  {
    bundleId: 'ordo-agent-ops',
    disposition: 'converged',
    reason: 'Ordo ops pane open is a command-like action',
    commands: [{ canonicalName: 'ordo', description: 'Open Ordo agent ops', category: 'work', danger: 'safe', owner: 'host', actionKind: 'navigation', schemaKey: 'inspect:ordo' }],
    oldPath: 'workspace.ordo',
  },
  {
    bundleId: 'dsh-plugin-example',
    disposition: 'no-command-semantics',
    reason: 'Example plugin; no product command entry',
    commands: [],
    oldPath: null,
  },
]

export function bundleEntryLedger(): readonly BundleEntryLedgerRow[] {
  return LEDGER
}

export function ledgerIsClosed(): boolean {
  return LEDGER.every(row =>
    row.disposition === 'converged' ||
    row.disposition === 'no-command-semantics' ||
    row.disposition === 'exempt',
  ) && LEDGER.length >= 31
}

export function seedToEntry(seed: ConvergenceCommandSeed): CommandExperienceEntryV1 {
  return normalizeCommandEntry({
    canonicalName: seed.canonicalName,
    aliases: seed.aliases ?? [],
    description: seed.description,
    category: seed.category,
    input: { schemaKey: seed.schemaKey },
    surfaces: ['web', 'tui'],
    actionKind: seed.actionKind,
    owner: seed.owner,
    danger: seed.danger,
    availability: { state: 'available' },
    coverage: 'adapted',
  })
}

export function projectConvergedCommands(
  installedBundleIds: readonly string[],
): CommandExperienceEntryV1[] {
  const installed = new Set(installedBundleIds)
  const entries: CommandExperienceEntryV1[] = []
  for (const row of LEDGER) {
    if (row.disposition !== 'converged') continue
    if (!installed.has(row.bundleId)) continue
    for (const seed of row.commands) entries.push(seedToEntry(seed))
  }
  return entries
}

export function registerConvergedSource(
  directory: LiveSlashDirectory,
  installedBundleIds: readonly string[],
): void {
  directory.setSource({
    source: CONVERGENCE_SOURCE,
    priority: CONVERGENCE_SOURCE_PRIORITY,
    commands: projectConvergedCommands(installedBundleIds),
  })
}

export function unloadConvergedSource(directory: LiveSlashDirectory): void {
  directory.removeSource(CONVERGENCE_SOURCE)
}

export function probeOldPathFallback(input: {
  readonly directorySeam: boolean
  readonly oldPathAvailable: boolean
}): { readonly oldPathUsable: boolean; readonly deadPath: boolean } {
  if (input.directorySeam) {
    return { oldPathUsable: input.oldPathAvailable, deadPath: false }
  }
  return {
    oldPathUsable: input.oldPathAvailable,
    deadPath: !input.oldPathAvailable,
  }
}

export interface PaletteExecuteRecord {
  readonly found: boolean
  readonly canonicalName: string
  readonly executed: boolean
  readonly owner: CommandOwner | null
  readonly danger: CommandDanger | null
  readonly availability: CommandExperienceEntryV1['availability'] | null
  readonly receiptStatus: 'success' | 'idle'
  readonly activityCanonicalName: string | null
  readonly oldPath: string | null
}

/**
 * Drive a converged Palette row through the frozen directory + draft
 * reducer. Success records official-style command/run|done identity, not a
 * second client log. Disabled or missing rows do not dispatch.
 */
export function paletteExecuteRecord(
  directory: LiveSlashDirectory,
  canonicalName: string,
): PaletteExecuteRecord {
  const ledgerRow = LEDGER.find(row =>
    row.commands.some(seed => seed.canonicalName === canonicalName),
  )
  const hit = directory.snapshot().commands.find(command => command.canonicalName === canonicalName)
  if (hit === undefined) {
    return {
      found: false,
      canonicalName,
      executed: false,
      owner: null,
      danger: null,
      availability: null,
      receiptStatus: 'idle',
      activityCanonicalName: null,
      oldPath: ledgerRow?.oldPath ?? null,
    }
  }
  if (hit.availability.state !== 'available') {
    return {
      found: true,
      canonicalName: hit.canonicalName,
      executed: false,
      owner: hit.owner,
      danger: hit.danger,
      availability: hit.availability,
      receiptStatus: 'idle',
      activityCanonicalName: null,
      oldPath: ledgerRow?.oldPath ?? null,
    }
  }
  let draft = commandDraftReducer(createInitialDraft(), {
    type: 'START_ASSIST',
    query: `/${hit.canonicalName}`,
    originalDraft: '',
  })
  draft = commandDraftReducer(draft, { type: 'SELECT', command: hit })
  draft = commandDraftReducer(draft, { type: 'DISPATCH', correlationId: `conv-${hit.canonicalName}` })
  draft = commandDraftReducer(draft, {
    type: 'RECEIPT',
    status: 'success',
    correlationId: draft.correlationId ?? `conv-${hit.canonicalName}`,
    message: `/${hit.canonicalName}`,
  })
  return {
    found: true,
    canonicalName: hit.canonicalName,
    executed: draft.receiptStatus === 'success',
    owner: hit.owner,
    danger: hit.danger,
    availability: hit.availability,
    receiptStatus: draft.receiptStatus === 'success' ? 'success' : 'idle',
    activityCanonicalName: hit.canonicalName,
    oldPath: ledgerRow?.oldPath ?? null,
  }
}

export function createConvergenceDirectory(): LiveSlashDirectory {
  return createLiveSlashDirectory()
}
