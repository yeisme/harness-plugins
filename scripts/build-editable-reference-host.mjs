#!/usr/bin/env node
/** Rebuild the editable-reference Host seam without cleaning unrelated outputs. */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = resolve(import.meta.dirname, '..')
const host = resolve(root, 'temp/dsh-unified-host-source')
const args = new Set(process.argv.slice(2))
for (const arg of args) {
  if (!['--plan', '--include-chat'].includes(arg)) throw new Error(`Unknown option: ${arg}`)
}
const plan = [
  { path: 'packages/api/session-controller', configs: ['tsconfig.host.json', 'tsconfig.client.json'], reflect: true, client: true },
  { path: 'packages/context/session-reference', configs: ['tsconfig.json'], reflect: true },
  { path: 'packages/api/remotes', configs: ['tsconfig.client.json'], client: true },
  { path: 'packages/client/ui-conversation', configs: ['tsconfig.json'], client: true },
  { path: 'packages/client/ui-reference', configs: ['tsconfig.json'], client: true },
  ...(args.has('--include-chat') ? [{ path: 'packages/client/ui-chat', configs: ['tsconfig.json'], client: true }] : []),
]
if (args.has('--plan')) {
  process.stdout.write(`${JSON.stringify({ clean: false, workspace: false, plan }, null, 2)}\n`)
} else {
  const requireHost = createRequire(resolve(host, 'package.json'))
  const { build } = await import(pathToFileURL(requireHost.resolve('tsdown')).href)
  const { WorkspaceTypertGenerator } = await import(pathToFileURL(resolve(host, 'packages/typert/generator/lib/types/workspace.js')).href)
  const tsc = requireHost.resolve('typescript/bin/tsc')
  for (const step of plan) {
    const cwd = resolve(host, step.path)
    process.stdout.write(`Building ${step.path}\n`)
    // -p intentionally does not recursively rebuild project references.
    // The staging Host must already have its dependency baseline built.
    for (const config of step.configs) {
      const result = spawnSync(process.execPath, [tsc, '-p', config], { cwd, stdio: 'inherit' })
      if (result.error) throw result.error
      if (result.status !== 0) throw new Error(`TypeScript failed for ${step.path}/${config}`)
    }
    const manifest = JSON.parse(await readFile(resolve(cwd, 'package.json'), 'utf8'))
    if (step.reflect) {
      const artifacts = new WorkspaceTypertGenerator(host).generate([manifest.name], ['host'])
      if (artifacts.length !== 1 || resolve(host, artifacts[0].packageRoot) !== cwd) {
        throw new Error(`Unexpected reflection output for ${step.path}`)
      }
      const artifact = artifacts[0]
      const output = resolve(cwd, 'lib')
      await mkdir(output, { recursive: true })
      await writeFile(resolve(output, 'typert.host.js'), artifact.js)
      await writeFile(resolve(output, 'typert.host.d.ts'), artifact.dts)
      if (artifact.remote) {
        await writeFile(resolve(output, 'typert.remote-client.js'), artifact.remote.js)
        await writeFile(resolve(output, 'typert.remote-client.d.ts'), artifact.remote.dts)
        await writeFile(resolve(output, 'typert.remote-client.d.ts.map'), artifact.remote.dtsMap)
      }
    }
    const nodeConfig = { entry: ['lib/types/index.js'], outDir: 'lib', format: ['esm'], platform: 'node', target: 'es2024' }
    let configs
    if (step.client) {
      // Reuse the Host's own ModuleLoader/CSS/purity preset, including its externals.
      const { default: preset } = await import(pathToFileURL(resolve(cwd, 'tsdown.config.ts')).href)
      configs = typeof preset === 'function' ? await preset({ env: { DSH_BUILD_FACE: 'client' } }) : preset
      // hostPhase packages omit their Node half from the Client face. The
      // session controller needs both its RPC service and live Session model.
      if (step.reflect) configs = [nodeConfig, ...(Array.isArray(configs) ? configs : [configs])]
    } else {
      configs = [nodeConfig]
    }
    for (const config of Array.isArray(configs) ? configs : [configs]) {
      await build({ ...config, cwd, config: false, workspace: false, fixedExtension: false, dts: false, clean: false })
    }
  }
}
