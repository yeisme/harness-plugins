import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { buildCatalog, listPersonalCodingPacks, parseInstallRows, resolvePersonalCodingPacks } from '@yeisme/dsh-plugin-catalog'
import {
  aggregateDshPluginProfileHealthV1,
  createPersonalCodingContractFixtureV1,
  decodeDshPluginSurfaceContributionV1,
  type DshPluginContributionHealthV1,
  type DshPluginSurfaceContributionV1,
} from '@yeisme/dsh-plugin-contracts'
import { report, type CheckerReport, type Finding } from '../types.js'

const MAX_CLIENT_BYTES = 16 * 1024 * 1024
const MAX_TOTAL_CLIENT_BYTES = 64 * 1024 * 1024

export function runPersonalCodingContractCheck(root: string): CheckerReport {
  const findings: Finding[] = []
  const catalog = buildCatalog(root)
  const packs = listPersonalCodingPacks(catalog)
  const base = packs.find(entry => entry.personalCoding?.tier === 'base')
  if (base === undefined) {
    findings.push({ location: 'packages/bundle', code: 'PERSONAL_CODING/BASE_MISSING', message: 'personal coding base pack is missing' })
    return report('personal-coding-contract', packs.length, findings)
  }

  const selections = [[], ...packs.filter(entry => entry.personalCoding?.tier === 'optional').map(entry => [entry.personalCoding?.packId ?? entry.id])]
  for (const requested of selections) {
    const resolved = resolvePersonalCodingPacks(catalog, requested)
    if (!resolved.ok) {
      findings.push({ location: base.path, code: 'PERSONAL_CODING/PACK_RESOLUTION', message: `pack ${resolved.packId} failed ${resolved.code}` })
      continue
    }
    const rows = resolved.bundles.flatMap(entry => entry.installRows.map(row => ({ ...row, bundle: entry.id })))
    const seen = new Map<string, string>()
    for (const row of rows) {
      const owner = seen.get(row.id)
      if (owner !== undefined) findings.push({ location: base.path, code: 'PERSONAL_CODING/DUPLICATE_INSERT', message: `insert id ${row.id} is declared by ${owner} and ${row.bundle}` })
      else seen.set(row.id, row.bundle)
    }
  }

  const basePatch = base.patchFile === undefined ? '' : readFileSync(join(root, base.patchFile), 'utf8')
  const baseRows = parseInstallRows(basePatch)
  const dependencyNames = new Set(base.pluginDependencies)
  const memberNames = [
    '@yeisme/dsh-command-experience',
    '@yeisme/dsh-workbench-core',
    '@yeisme/dsh-desktop-workbench',
    '@yeisme/dsh-semantic-file-editor',
    '@yeisme/dsh-terminal',
    '@yeisme/dsh-devtools',
    '@yeisme/dsh-ordo-agent-ops',
  ]
  if (baseRows.length !== 1 || baseRows[0]?.id !== 'dsh-personal-coding-base' || baseRows[0]?.name !== '@yeisme/dsh-personal-coding-base') {
    findings.push({ location: base.path, code: 'PERSONAL_CODING/COMPOSITION_INSERT', message: 'composition patch must insert only the marker id, not member plugin ids' })
  }
  for (const name of memberNames) {
    if (!dependencyNames.has(name)) findings.push({ location: base.path, code: 'PERSONAL_CODING/UNDECLARED_DEPENDENCY', message: `composition is missing member dependency ${name}` })
  }
  if ([...dependencyNames].some(name => /creator|drama|domain|radar/.test(name))) {
    findings.push({ location: base.path, code: 'PERSONAL_CODING/DOMAIN_BUNDLE', message: 'base pack contains a creator or domain bundle' })
  }

  let totalClientBytes = 0
  for (const name of memberNames) {
    const candidate = catalog.bundles.find(entry => entry.name === name)
    if (candidate === undefined) continue
    const clientPath = join(root, candidate.path, 'lib/client.js')
    if (!existsSync(clientPath)) continue
    const size = statSync(clientPath).size
    totalClientBytes += size
    if (size > MAX_CLIENT_BYTES) findings.push({ location: `${candidate.path}/lib/client.js`, code: 'PERSONAL_CODING/CLIENT_SIZE', message: `client bundle exceeds ${MAX_CLIENT_BYTES} bytes` })
  }
  if (totalClientBytes > MAX_TOTAL_CLIENT_BYTES) findings.push({ location: base.path, code: 'PERSONAL_CODING/TOTAL_CLIENT_SIZE', message: `base client bundles exceed ${MAX_TOTAL_CLIENT_BYTES} bytes` })

  const fixture = createPersonalCodingContractFixtureV1({ ordo_run_launch_available: false })
  const optionalHealth: DshPluginContributionHealthV1 = {
    status: 'degraded', stage: 'probe', code: 'ordo.run_launch.unavailable', reason: 'Ordo launch capability is unavailable.', fix: 'Enable the Ordo launch gate.', last_checked: '2026-09-02T00:00:00.000Z',
  }
  const syntheticSurface: DshPluginSurfaceContributionV1 = {
    contract_version: fixture.contract_version,
    id: 'personal-coding.parity', owner: 'harness-plugins', generation: 1, surfaces: ['web', 'tui'],
    commands: fixture.commands,
    views: [], actions: [],
    health: optionalHealth,
    dispose_ref: 'dispose:personal-coding:parity:1',
  }
  const decoded = decodeDshPluginSurfaceContributionV1(syntheticSurface)
  if (!decoded.ok) findings.push({ location: 'packages/sdk/dsh-plugin-contracts', code: 'PERSONAL_CODING/STRUCTURED_FIXTURE', message: `${decoded.code}: ${decoded.reason}` })

  const health = aggregateDshPluginProfileHealthV1([
    { contribution_id: 'commands', critical: true, health: { ...syntheticSurface.health, status: 'available', code: 'commands.ready' } },
    { contribution_id: 'ordo-agent-ops', critical: false, health: optionalHealth },
  ])
  if (health.status !== 'degraded' || health.critical_failures.length !== 0) {
    findings.push({ location: 'packages/sdk/dsh-plugin-contracts', code: 'PERSONAL_CODING/HEALTH_ISOLATION', message: 'optional Ordo failure does not remain isolated from critical base health' })
  }

  return report('personal-coding-contract', packs.length + memberNames.length, findings, [`base client bytes: ${totalClientBytes}`])
}
