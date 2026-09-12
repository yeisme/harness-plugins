import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createHash, randomUUID } from 'node:crypto'
import { homedir, userInfo } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { readFile, realpath, mkdir, writeFile, rename, rm } from 'node:fs/promises'
import { z } from 'zod'
import { withLocalScaenaTable } from './local-scaena-table.ts'
import { withLocalScaenaPackage } from './local-scaena-package.ts'
import { withLocalScaena } from './local-scaena.ts'
import { withLocalEikonaReview } from './local-eikona-review.ts'
import { withLocalEikona } from './local-eikona.ts'
import type { CreatorOwnerAdapterV1, CreatorResourceV1, CreatorStudioContextV1 } from './types.ts'

const execute = promisify(execFile)
const cliSettings = z.object({
  version: z.literal(1),
  workingDirectory: z.string().min(1).optional(),
  eikona: z.object({ executable: z.string().min(1).default('eikona'), config: z.string().min(1).optional(), project: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u).optional(), outputRoot: z.string().min(1).optional() }).strict().optional(),
  scaena: z.object({ executable: z.string().min(1).default('scaena'), config: z.string().min(1).optional() }).strict().optional(),
}).strict()
export const localStudioConfigSchema = cliSettings
export const localStudioConfigPath = () => join(homedir(), '.config', 'yeisme', 'dsh-creator-studio.json')
export async function saveLocalStudioConfig(value: unknown, path = localStudioConfigPath()): Promise<void> {
  const settings = cliSettings.parse(value)
  if (settings.workingDirectory) await realpath(settings.workingDirectory)
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  const temporary = `${path}.${randomUUID()}.tmp`
  try { await writeFile(temporary, JSON.stringify(settings, null, 2) + '\n', { mode: 0o600, flag: 'wx' }); await rename(temporary, path) }
  finally { await rm(temporary, { force: true }) }
}

type LocalOwner = 'eikona' | 'scaena'
const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u)
const runList = z.object({ data: z.object({ runs: z.array(z.object({ run_id: id, project_id: id.optional(), status: id, model_ref: z.string().max(160).optional(), artifact_count: z.number().int().nonnegative().optional() })).max(50).nullable().transform(rows => rows ?? []) }) })

/** Local OS identity is only for local CLI execution; it is never an external delegation. */
export class LocalStudioCLI {
  private constructor(readonly cwd: string, private readonly settings: z.infer<typeof cliSettings>, readonly context: CreatorStudioContextV1) {}

  static async open(cwd = process.cwd(), configPath = localStudioConfigPath()): Promise<LocalStudioCLI> {
    let settings: z.infer<typeof cliSettings> = { version: 1 }
    try { settings = cliSettings.parse(JSON.parse(await readFile(configPath, 'utf8'))) }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Invalid user-level Creator Studio configuration') }
    const directory = await realpath(resolve(settings.workingDirectory ?? cwd))
    const hash = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 32)
    const principal = `local-user:${hash(String(userInfo().uid) + ':' + homedir())}`
    const workspace = `local-workspace:${hash(directory)}`
    const context: CreatorStudioContextV1 = { tenantRef: principal, principalRef: principal, workspaceRef: workspace,
      projectRef: workspace, membershipRevision: 'local-cli:1', installationRef: `local-installation:${hash(homedir())}`,
      pluginDigest: 'creator-studio:local-cli-v1', policyRevision: 'local-cli:1', runtimeGeneration: `local-runtime:${randomUUID()}`, revision: '1' }
    return new LocalStudioCLI(directory, settings, context)
  }

  async read(owner: LocalOwner, operation: 'runs' | 'projects' | 'sessions'): Promise<unknown> {
    const commands = {
      eikona: { runs: ['list', '--limit', '40', '--full'], projects: ['projects', 'list', '--full'] },
      scaena: { sessions: ['production', 'session', 'list', '--project', this.cwd, '--limit', '40'] },
    }
    const args = (commands[owner] as Partial<Record<typeof operation, string[]>>)[operation]
    if (!args) throw new Error('Unsupported local owner read')
    return this.invoke(owner, args)
  }

  private async invoke(owner: LocalOwner, args: readonly string[], timeout = 30_000): Promise<unknown> {
    const options = this.settings[owner]
    const executable = options?.executable ?? owner
    try {
      const { stdout } = await execute(executable, [...args, '--json', ...(options?.config ? ['--config', options.config] : []), ...(owner === 'eikona' && this.settings.eikona?.outputRoot ? ['--output-root', this.settings.eikona.outputRoot] : [])], {
        cwd: this.cwd, encoding: 'utf8', timeout, maxBuffer: 24 * 1024 * 1024, windowsHide: true,
      })
      return JSON.parse(stdout)
    } catch (error) {
      const failed = error as { stdout?: string; code?: unknown; killed?: boolean }
      if (!failed.killed && typeof failed.code === 'number' && failed.stdout) {
        try { return JSON.parse(failed.stdout) } catch { /* Invalid owner output remains unavailable. */ }
      }
      // Do not forward command arguments, owner stdout, config paths or stderr to the browser.
      throw new Error(`${owner}_cli_unavailable`)
    }
  }

  adapter(owner: LocalOwner): CreatorOwnerAdapterV1 {
    let version = 0
    const base: CreatorOwnerAdapterV1 = {
      owner, transport: 'local', configured: true,
      snapshot: async context => {
        const current = ++version
        let resources: CreatorResourceV1[] = [], available = false
        try {
          if (context.workspaceRef !== this.context.workspaceRef || context.principalRef !== this.context.principalRef) throw new Error('Local workspace mismatch')
          if (owner === 'eikona') {
            const project = await resolveProject()
            if (!project) throw new Error('Local project is not registered')
            const result = runList.parse(await this.invoke(owner, ['list', '--limit', '40', '--full', '--project', project]))
            resources = result.data.runs.filter(run => run.project_id === project).map(run => ({ ref: `eikona:run:${run.run_id}`, version: String(current), kind: 'generation-run',
              title: run.run_id, status: run.status, ...(run.model_ref ? { summary: run.model_ref } : {}), evidenceRefs: [] }))
          } else {
            const envelope = z.object({ data: z.record(z.string(), z.unknown()) }).parse(await this.read(owner, 'sessions'))
            const rows = z.array(z.object({ session_ref: id, version: z.number().int().positive(), episode_ref: id.optional(), state: id.optional(), status: id.optional() })).max(50).nullable().transform(rows => rows ?? []).parse(Object.hasOwn(envelope.data, 'Items') ? envelope.data.Items : Object.hasOwn(envelope.data, 'items') ? envelope.data.items : envelope.data.sessions)
            resources = rows.map(row => ({ ref: row.session_ref, version: String(row.version), kind: 'production-session', title: row.episode_ref ?? row.session_ref, status: row.state ?? row.status ?? 'unknown', evidenceRefs: [] }))
          }
          available = true
        } catch { /* Honest offline projection; private CLI diagnostics stay in the owner. */ }
        return { schemaVersion: 'creator.owner.snapshot.v1alpha1', owner, transport: 'local', context,
          snapshotRef: `${owner}:local:${current}`, snapshotVersion: current, cursor: `${owner}:local:${current}`, sequence: current,
          generatedAt: new Date().toISOString(), status: available ? 'ready' : 'offline', freshness: available ? 'fresh' : 'unknown',
          summary: available ? `${owner} local CLI connected.` : `${owner} CLI is unavailable or the current project is not initialized.`, resources, actions: [] }
      },
      dispatch: () => ({ status: 'rejected', owner, receiptRef: `${owner}:local:unsupported-action`, summary: 'This local CLI action is not available.' }),
    }
    const resolveProject = async () => {
      const projects = z.object({ data: z.object({ projects: z.array(z.object({ project_id: id, root_path: z.string() })) }) }).parse(await this.read('eikona', 'projects'))
      const configured = this.settings.eikona?.project
      const match = projects.data.projects.find(project => configured ? project.project_id === configured : resolve(project.root_path) === this.cwd)
      return match?.project_id
    }
    return owner === 'eikona' ? withLocalEikonaReview(withLocalEikona(base, (args, timeout) => this.invoke(owner, args, timeout), resolveProject), (args, timeout) => this.invoke(owner, args, timeout), resolveProject) : withLocalScaenaTable(withLocalScaenaPackage(withLocalScaena(base, (args, timeout) => this.invoke(owner, args, timeout), this.cwd), (args, timeout) => this.invoke(owner, args, timeout), this.cwd), (args, timeout) => this.invoke(owner, args, timeout), this.cwd)
  }
}
