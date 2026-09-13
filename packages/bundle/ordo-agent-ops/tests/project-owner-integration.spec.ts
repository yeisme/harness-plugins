import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { ProjectSnapshotSchema } from '../src/project-contract.ts'
import { executeProjectCli, OrdoProjectOwner } from '../src/host/project-owner.ts'

const ordoRoot = resolve(import.meta.dirname, '../../../../../ordo')
const roots: string[] = []
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }) })

describe('real Ordo CLI to DSH consumer contract (no model execution)', () => {
  it.skipIf(!process.env.DSH_PROJECT_OPS_INTEGRATION_RUN)('projects two isolated project stores, dependency edges and safe registered roots through the real CLI', async () => {
    const temp = await mkdtemp(join(tmpdir(), 'dsh-project-owner-')); roots.push(temp)
    const projectA = join(temp, 'a'); const projectB = join(temp, 'b')
    const env = { ...process.env, XDG_CONFIG_HOME: join(temp, 'config') }
    const seed = `import { mkdir } from 'node:fs/promises';
      import { AgentTeamService } from './packages/core/src/team/service.ts';
      import { ProjectOpsBindings } from './packages/core/src/team/project-bindings.ts';
      const adapter={executeReadOnly:async()=>{throw new Error('forbidden')},executeWrite:async()=>{throw new Error('forbidden')}};
      const bindings=new ProjectOpsBindings();
      for (const [root,title] of ${JSON.stringify([[projectA, 'Project A'], [projectB, 'Project B']])}) {
        await mkdir(root,{recursive:true}); const service=new AgentTeamService(root,{adapter,dispatchEnabled:false});
        await service.create({teamId:'demo',description:title});
        await service.taskCreate('demo',{taskId:'first',subject:title+' first',mode:'read_only'});
        await service.taskCreate('demo',{taskId:'second',subject:title+' second',mode:'read_only',dependencies:['first']});
        await bindings.register(root,title);
      }`
    const setup = spawnSync('bun', ['-e', seed], { cwd: ordoRoot, env, encoding: 'utf8', timeout: 30_000 })
    expect(setup.status, 'Application-service fixture creation failed').toBe(0)
    const cli = (...args: string[]) => {
      const result = spawnSync('bun', ['run', 'apps/cli/src/bin/ordo.ts', 'project-ops', ...args, '--json'], { cwd: ordoRoot, env, encoding: 'utf8', timeout: 30_000 })
      expect(result.status, 'Project CLI failed').toBe(0)
      return JSON.parse(result.stdout).data
    }
    const { projects } = cli('projects')
    expect(projects).toHaveLength(2); expect(JSON.stringify(projects)).not.toContain(temp)
    const snapshots = projects.map((project: { ref: string }) => ProjectSnapshotSchema.parse(cli('snapshot', '--project', project.ref).snapshot))
    expect(snapshots[0].projectRef).not.toBe(snapshots[1].projectRef)
    expect(snapshots[0].tasks[1].dependencies).toEqual([snapshots[0].tasks[0].ref])
    expect(snapshots[0].tasks[0].title).toContain('Project A')
    expect(snapshots[1].tasks[0].title).toContain('Project B')
    expect(JSON.stringify(snapshots)).not.toContain(temp)
    const page = cli('events', '--project', projects[0].ref, '--cursor', snapshots[0].version)
    expect(page.changed).toBe(false); expect(page.events).toHaveLength(snapshots[0].events.length)
    // Exercise the production asynchronous Host process adapter against the
    // compiled owner as well as the source CLI. No fake transport here.
    const previousConfig = process.env.XDG_CONFIG_HOME
    process.env.XDG_CONFIG_HOME = env.XDG_CONFIG_HOME
    const binary = join(ordoRoot, 'dist', `ordo-${process.platform}-${process.arch}${process.platform === 'win32' ? '.exe' : ''}`)
    const owner = new OrdoProjectOwner((args, input, signal) => executeProjectCli(args, input, signal, binary))
    try {
      const projected = await owner.snapshot(projects[0].ref)
      expect(projected.projectRef).toBe(snapshots[0].projectRef)
      expect(projected.tasks).toEqual(snapshots[0].tasks)
      expect((await owner.events(projects[0].ref, projected.version)).changed).toBe(false)
    } finally {
      owner.dispose()
      if (previousConfig === undefined) delete process.env.XDG_CONFIG_HOME
      else process.env.XDG_CONFIG_HOME = previousConfig
    }
  }, 60_000)
})
