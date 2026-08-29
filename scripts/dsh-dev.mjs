#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { existsSync, watch } from 'node:fs'
import { mkdir, readFile, readdir, realpath, stat, utimes, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_FILE = fileURLToPath(import.meta.url)
export const DEFAULT_WORKSPACE_ROOT = resolve(dirname(SCRIPT_FILE), '..')
const PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i
const RUNTIME_EXTENSION = /\.(?:cjs|js|mjs)$/i
const WATCH_EXTENSION = /\.(?:cjs|css|js|json|jsx|mjs|mts|cts|ts|tsx|ya?ml)$/i
const CONFIG_FILES = new Set(['cordis.patch.yml', 'cordis.patch.yaml', 'package.json', 'pnpm-workspace.yaml'])
const IGNORED_PARTS = new Set(['.git', '.turbo', 'build', 'coverage', 'dist', 'docs', 'lib', 'node_modules', 'openspec', 'temp', 'tests'])

function sleep(milliseconds) {
  return new Promise(resolvePromise => setTimeout(resolvePromise, milliseconds))
}

function normalizePath(path) {
  return path.split(sep).join('/')
}

function displayPath(path, workspaceRoot = DEFAULT_WORKSPACE_ROOT) {
  const rel = normalizePath(relative(workspaceRoot, path))
  return rel !== '' && !rel.startsWith('../') ? rel : basename(path)
}

async function readManifest(dir) {
  const filename = join(dir, 'package.json')
  const source = await readFile(filename, 'utf8')
  let manifest
  try {
    manifest = JSON.parse(source)
  } catch {
    throw new Error(`invalid package manifest: ${displayPath(filename)}`)
  }
  if (typeof manifest.name !== 'string' || !PACKAGE_NAME.test(manifest.name)) {
    throw new Error(`package has no valid name: ${displayPath(filename)}`)
  }
  return manifest
}

function dependencyNames(manifest) {
  const result = new Set()
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    const dependencies = manifest[field]
    if (dependencies === null || typeof dependencies !== 'object') continue
    for (const name of Object.keys(dependencies)) result.add(name)
  }
  return result
}

export function isBundleManifest(manifest) {
  return typeof manifest?.dsh?.bundle?.patch === 'string' && manifest.dsh.bundle.patch.trim() !== ''
}

export async function discoverWorkspacePackages(workspaceRoot = DEFAULT_WORKSPACE_ROOT) {
  const packagesRoot = join(workspaceRoot, 'packages')
  const packages = new Map()
  for (const family of await readdir(packagesRoot, { withFileTypes: true })) {
    if (!family.isDirectory()) continue
    const familyDir = join(packagesRoot, family.name)
    for (const entry of await readdir(familyDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const dir = join(familyDir, entry.name)
      if (!existsSync(join(dir, 'package.json'))) continue
      const manifest = await readManifest(dir)
      const id = normalizePath(relative(workspaceRoot, dir))
      packages.set(id, {
        id,
        name: manifest.name,
        dir,
        manifest,
        dependencies: dependencyNames(manifest),
        bundle: isBundleManifest(manifest),
        external: false,
      })
    }
  }
  return packages
}

export async function resolveExternalBundles(inputs, cwd = process.cwd(), workspacePackages = new Map()) {
  const bundles = []
  const seen = new Set()
  for (const input of inputs) {
    const dir = await realpath(resolve(cwd, input))
    const info = await stat(dir)
    if (!info.isDirectory()) throw new Error(`external plugin is not a directory: ${basename(dir)}`)
    const manifest = await readManifest(dir)
    if (!isBundleManifest(manifest)) throw new Error(`${manifest.name} declares no dsh.bundle.patch`)
    if ([...workspacePackages.values()].some(pkg => pkg.name === manifest.name)) throw new Error(`${manifest.name} already exists in this workspace; edit that package directly`)
    if (seen.has(manifest.name)) throw new Error(`duplicate external plugin: ${manifest.name}`)
    seen.add(manifest.name)
    bundles.push({
      name: manifest.name,
      dir,
      manifest,
      dependencies: dependencyNames(manifest),
      bundle: true,
      external: true,
    })
  }
  return bundles
}

export function workspaceBundles(packages) {
  return [...packages.values()].filter(pkg => pkg.bundle).sort((a, b) => a.name.localeCompare(b.name))
}

export function buildDependencyGraph(packages) {
  const byName = new Map()
  for (const pkg of packages.values()) {
    const candidates = byName.get(pkg.name) ?? []
    candidates.push(pkg.id)
    byName.set(pkg.name, candidates)
  }
  const dependents = new Map([...packages.keys()].map(id => [id, new Set()]))
  for (const pkg of packages.values()) {
    for (const dependency of pkg.dependencies) {
      for (const dependencyId of byName.get(dependency) ?? []) {
        if (dependencyId !== pkg.id) dependents.get(dependencyId)?.add(pkg.id)
      }
    }
  }
  return dependents
}

function closure(start, neighbors) {
  const result = new Set()
  const queue = [...start]
  while (queue.length > 0) {
    const name = queue.shift()
    if (result.has(name)) continue
    result.add(name)
    for (const next of neighbors(name)) if (!result.has(next)) queue.push(next)
  }
  return result
}

export function dependencyClosure(packages, names) {
  const byName = new Map()
  for (const pkg of packages.values()) {
    const candidates = byName.get(pkg.name) ?? []
    candidates.push(pkg.id)
    byName.set(pkg.name, candidates)
  }
  return closure(names, id => {
    const pkg = packages.get(id)
    if (pkg === undefined) return []
    return [...pkg.dependencies].flatMap(dependency => byName.get(dependency) ?? []).filter(candidate => candidate !== id)
  })
}

export function dependentClosure(packages, names) {
  const dependents = buildDependencyGraph(packages)
  return closure(names, name => dependents.get(name) ?? [])
}

export function createHmrPatch(workspaceRoot, externalBundles = [], workspacePackages = new Map()) {
  const dshHome = resolve(process.env.DSH_HOME ?? join(homedir(), '.dsh'))
  const sourceRoot = join(dshHome, 'sources', 'deepseek-harness')
  const localPackages = [...workspacePackages.values(), ...externalBundles]
  const runtimeRoots = localPackages.flatMap(packageRuntimeRoots)
  const roots = [
    ...(runtimeRoots.length === 0 ? [resolve(workspaceRoot)] : runtimeRoots),
    ...(existsSync(sourceRoot) ? [sourceRoot] : []),
  ]
  return [{
    id: 'hmr',
    disabled: false,
    config: {
      root: [...new Set(roots)],
      debounce: 120,
      // These are real checkout paths. Following pnpm/profile links can make
      // chokidar traverse the dependency graph and starve DSH during startup.
      followSymlinks: false,
      ignored: [
        '**/node_modules/**',
        '**/node_modules',
        '**/.git/**',
        '**/tests/**',
        '**/coverage/**',
        '**/temp/**',
        '**/docs/**',
        '**/openspec/**',
        '**/*.map',
      ],
    },
  }]
}

export async function writeHmrPatch(workspaceRoot, profile, externalBundles = [], workspacePackages = new Map()) {
  const dir = join(workspaceRoot, 'temp', 'dsh-dev', profile)
  const filename = join(dir, 'hmr.patch.yml')
  await mkdir(dir, { recursive: true })
  await writeFile(filename, `${JSON.stringify(createHmrPatch(workspaceRoot, externalBundles, workspacePackages), null, 2)}\n`, 'utf8')
  return filename
}

export function parseDevArgs(argv) {
  const options = {
    profile: 'web',
    plugins: [],
    check: false,
    prepareOnly: false,
    skipBuild: false,
    skipInstall: false,
    help: false,
    appArgs: [],
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--') continue
    if (argument === '--help' || argument === '-h') { options.help = true; continue }
    if (argument === '--check') { options.check = true; continue }
    if (argument === '--prepare-only') { options.prepareOnly = true; continue }
    if (argument === '--skip-build') { options.skipBuild = true; continue }
    if (argument === '--skip-install') { options.skipInstall = true; continue }
    if (argument === '--profile' || argument === '--plugin') {
      const value = argv[index + 1]
      if (value === undefined || value.startsWith('--')) throw new Error(`${argument} requires a value`)
      index += 1
      if (argument === '--profile') options.profile = value
      else options.plugins.push(value)
      continue
    }
    options.appArgs.push(argument)
  }
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(options.profile)) throw new Error('profile name is invalid')
  if (options.check && options.prepareOnly) throw new Error('--check and --prepare-only are mutually exclusive')
  return options
}

export function classifyChangedPath(path) {
  const normalized = normalizePath(path)
  const parts = normalized.split('/')
  if (parts.some(part => IGNORED_PARTS.has(part))) return 'ignore'
  const file = basename(normalized)
  if (CONFIG_FILES.has(file)) return 'config'
  if (!WATCH_EXTENSION.test(file)) return 'ignore'
  return 'source'
}

async function run(command, args, options = {}) {
  const { cwd = DEFAULT_WORKSPACE_ROOT, capture = false, env = process.env } = options
  return await new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      shell: false,
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    })
    let stdout = ''
    let stderr = ''
    if (capture) {
      child.stdout.setEncoding('utf8')
      child.stderr.setEncoding('utf8')
      child.stdout.on('data', chunk => { stdout += chunk })
      child.stderr.on('data', chunk => { stderr += chunk })
    }
    child.once('error', reject)
    child.once('exit', (code, signal) => resolvePromise({ code: code ?? 1, signal, stdout, stderr }))
  })
}

async function requireTool(command, args = ['--version']) {
  let result
  try {
    result = await run(command, args, { capture: true })
  } catch (error) {
    if (error?.code === 'ENOENT') throw new Error(`${command} is not available on PATH`)
    throw error
  }
  if (result.code !== 0) throw new Error(`${command} check failed`)
  return result.stdout.trim() || result.stderr.trim()
}

function packageFilters(names) {
  return [...names].sort().flatMap(name => ['--filter', name])
}

async function buildWorkspacePackages(workspaceRoot, packages, names) {
  const selected = [...new Set([...names]
    .map(id => packages.get(id))
    .filter(pkg => pkg?.manifest.scripts?.build !== undefined)
    .map(pkg => pkg.name))]
  if (selected.length === 0) return
  process.stdout.write(`[dsh-dev] building ${selected.length} workspace packages\n`)
  const result = await run('pnpm', ['-r', ...packageFilters(selected), '--if-present', 'run', 'build'], { cwd: workspaceRoot })
  if (result.code !== 0) throw new Error('workspace build failed')
}

async function buildExternalBundles(bundles) {
  for (const bundle of bundles) {
    if (bundle.manifest.scripts?.build === undefined) continue
    process.stdout.write(`[dsh-dev] building external ${bundle.name}\n`)
    const result = await run('pnpm', ['run', 'build'], { cwd: bundle.dir })
    if (result.code !== 0) throw new Error(`external build failed: ${bundle.name}`)
  }
}

function runtimeEntries(value, result = new Set()) {
  if (typeof value === 'string') {
    if (RUNTIME_EXTENSION.test(value)) result.add(value)
    return result
  }
  if (Array.isArray(value)) {
    for (const entry of value) runtimeEntries(entry, result)
    return result
  }
  if (value !== null && typeof value === 'object') {
    for (const entry of Object.values(value)) runtimeEntries(entry, result)
  }
  return result
}

export function declaredRuntimeArtifacts(pkg) {
  const entries = new Set()
  const manifest = pkg.manifest ?? {}
  runtimeEntries(manifest.main, entries)
  runtimeEntries(manifest.module, entries)
  runtimeEntries(manifest.exports, entries)
  return [...entries].map(entry => resolve(pkg.dir, entry)).filter(filename => existsSync(filename))
}

function packageRuntimeRoots(pkg) {
  const roots = new Set(declaredRuntimeArtifacts(pkg).map(dirname))
  for (const outputDir of ['lib', 'dist', 'build']) {
    const candidate = join(pkg.dir, outputDir)
    if (existsSync(candidate)) roots.add(candidate)
  }
  if (roots.size === 0) roots.add(resolve(pkg.dir))
  return [...roots]
}

async function pulsePackages(packages, names) {
  const now = new Date()
  let count = 0
  for (const id of names) {
    const pkg = packages.get(id)
    if (pkg === undefined) continue
    for (const filename of declaredRuntimeArtifacts(pkg)) {
      await utimes(filename, now, now)
      count += 1
    }
  }
  process.stdout.write(`[dsh-dev] pulsed ${count} runtime artifacts for HMR\n`)
}

async function syncProfile(profile, bundles, workspaceRoot) {
  // DSH deliberately recognizes local bundle paths through `link:`. Runtime
  // peers must therefore also exist in the workspace package graph.
  const specs = bundles.map(bundle => `link:${bundle.dir}`)
  if (specs.length === 0) throw new Error('no DSH bundles discovered')
  process.stdout.write(`[dsh-dev] syncing ${specs.length} bundles into profile ${profile}\n`)
  const result = await run('dsh', ['plugin', '--profile', profile, 'add', ...specs], { cwd: workspaceRoot })
  if (result.code !== 0) throw new Error('dsh plugin synchronization failed')
}

async function probeComposedConfig(profile, patchFile, workspaceRoot) {
  const result = await run('dsh', ['--profile', profile, '--patch', patchFile, '--dump-config'], { cwd: workspaceRoot, capture: true })
  if (result.code !== 0) {
    process.stderr.write(result.stderr)
    throw new Error('composed DSH config is invalid')
  }
}

function helpText() {
  return `Usage: pnpm dsh:dev -- [dev options] [DSH web options]\n\nDev options:\n  --profile <name>       target profile (default: web)\n  --plugin <path>        add and watch an external bundle; repeatable\n  --check                validate tools and bundle manifests without writes\n  --prepare-only         build, install and validate, then exit\n  --skip-build           reuse current build artifacts\n  --skip-install         do not reconcile profile dependencies\n  -h, --help             show this help\n\nExamples:\n  pnpm dsh:dev\n  pnpm dsh:dev -- --no-open --port 8080\n  pnpm dsh:dev -- --plugin ../my-dsh-plugin --no-open\n  pnpm dsh:dev -- --check\n  pnpm dsh:dev -- --prepare-only\n`
}

async function discoverState(workspaceRoot, pluginInputs, cwd) {
  const packages = await discoverWorkspacePackages(workspaceRoot)
  const external = await resolveExternalBundles(pluginInputs, cwd, packages)
  const bundles = [...workspaceBundles(packages), ...external].sort((a, b) => a.name.localeCompare(b.name))
  return { packages, external, bundles }
}

class DevRuntime {
  constructor(workspaceRoot, options, state, patchFile) {
    this.workspaceRoot = workspaceRoot
    this.options = options
    this.state = state
    this.patchFile = patchFile
    this.watchers = []
    this.pendingPackages = new Set()
    this.pendingExternal = new Set()
    this.pendingConfig = false
    this.timer = undefined
    this.queue = Promise.resolve()
    this.child = undefined
    this.stopping = false
    this.intentionalExit = false
    this.suppressUntil = 0
    this.recoveryTimer = undefined
    this.stableTimer = undefined
    this.restartFailures = 0
  }

  async startChild() {
    if (this.stopping || this.child !== undefined) return
    const args = ['--profile', this.options.profile, '--patch', this.patchFile, ...this.options.appArgs]
    process.stdout.write(`[dsh-dev] starting DSH profile ${this.options.profile}\n`)
    const child = spawn('dsh', args, { cwd: this.workspaceRoot, env: process.env, shell: false, stdio: 'inherit' })
    this.child = child
    clearTimeout(this.stableTimer)
    this.stableTimer = setTimeout(() => {
      if (this.child === child) this.restartFailures = 0
    }, 5000)
    child.once('error', error => {
      this.child = undefined
      process.stderr.write(`[dsh-dev] DSH start failed: ${error.message}\n`)
    })
    child.once('exit', (code, signal) => {
      if (this.child === child) this.child = undefined
      clearTimeout(this.stableTimer)
      if (this.stopping || this.intentionalExit) return
      this.restartFailures += 1
      if (this.restartFailures > 3) {
        process.stderr.write(`[dsh-dev] DSH exited (${signal ?? code}); automatic restart paused after 3 failures\n`)
        return
      }
      process.stderr.write(`[dsh-dev] DSH exited (${signal ?? code}); restarting (${this.restartFailures}/3)\n`)
      clearTimeout(this.recoveryTimer)
      this.recoveryTimer = setTimeout(() => {
        this.recoveryTimer = undefined
        void this.startChild()
      }, 500)
    })
  }

  async stopChild() {
    const child = this.child
    if (child === undefined) return
    this.intentionalExit = true
    child.kill('SIGTERM')
    const exited = new Promise(resolvePromise => child.once('exit', resolvePromise))
    await Promise.race([exited, sleep(3000)])
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
    await Promise.race([exited, sleep(1000)])
    if (this.child === child) this.child = undefined
    this.intentionalExit = false
  }

  async restartChild() {
    await this.stopChild()
    await this.startChild()
  }

  scheduleWorkspace(relativeFilename) {
    if (this.stopping || Date.now() < this.suppressUntil) return
    const kind = classifyChangedPath(relativeFilename)
    if (kind === 'ignore') return
    const normalized = normalizePath(relativeFilename)
    const parts = normalized.split('/')
    if (parts.length < 3) {
      this.pendingConfig ||= kind === 'config'
      this.arm()
      return
    }
    const dir = resolve(this.workspaceRoot, 'packages', parts[0], parts[1])
    const pkg = [...this.state.packages.values()].find(candidate => candidate.dir === dir)
    if (pkg !== undefined) this.pendingPackages.add(pkg.id)
    else if (kind === 'config') this.pendingConfig = true
    if (kind === 'config') this.pendingConfig = true
    this.arm()
  }

  scheduleExternal(bundle, relativeFilename) {
    if (this.stopping || Date.now() < this.suppressUntil) return
    const kind = classifyChangedPath(relativeFilename)
    if (kind === 'ignore') return
    this.pendingExternal.add(bundle.name)
    if (kind === 'config') this.pendingConfig = true
    this.arm()
  }

  arm() {
    clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = undefined
      const workspace = new Set(this.pendingPackages)
      const external = new Set(this.pendingExternal)
      const config = this.pendingConfig
      this.pendingPackages.clear()
      this.pendingExternal.clear()
      this.pendingConfig = false
      this.queue = this.queue.then(() => this.processChanges(workspace, external, config)).catch(error => {
        process.stderr.write(`[dsh-dev] update failed: ${error.message}\n`)
      })
    }, 140)
  }

  async processChanges(changedWorkspace, changedExternal, configChanged) {
    if (this.stopping) return
    let nextState = this.state
    if (configChanged) nextState = await discoverState(this.workspaceRoot, this.options.plugins, process.cwd())
    const affected = dependentClosure(nextState.packages, changedWorkspace)
    this.suppressUntil = Number.POSITIVE_INFINITY
    try {
      if (!this.options.skipBuild) {
        await buildWorkspacePackages(this.workspaceRoot, nextState.packages, affected)
        await buildExternalBundles(nextState.external.filter(bundle => changedExternal.has(bundle.name)))
      }
    } catch (error) {
      this.suppressUntil = Date.now() + 350
      throw error
    }
    this.suppressUntil = Date.now() + 350
    await pulsePackages(nextState.packages, affected)
    for (const bundle of nextState.external.filter(candidate => changedExternal.has(candidate.name))) {
      await pulsePackages(new Map([[bundle.name, bundle]]), new Set([bundle.name]))
    }
    if (configChanged) {
      if (!this.options.skipInstall) await syncProfile(this.options.profile, nextState.bundles, this.workspaceRoot)
      this.patchFile = await writeHmrPatch(this.workspaceRoot, this.options.profile, nextState.external, nextState.packages)
      await probeComposedConfig(this.options.profile, this.patchFile, this.workspaceRoot)
      this.state = nextState
      this.resetWatchers()
      await this.restartChild()
    } else if (this.child === undefined) {
      await this.startChild()
    }
  }

  resetWatchers() {
    for (const watcher of this.watchers) watcher.close()
    this.watchers = []
    const packagesRoot = join(this.workspaceRoot, 'packages')
    this.watchers.push(watch(packagesRoot, { recursive: true }, (_event, filename) => {
      if (filename !== null) this.scheduleWorkspace(String(filename))
    }))
    for (const bundle of this.state.external) {
      this.watchers.push(watch(bundle.dir, { recursive: true }, (_event, filename) => {
        if (filename !== null) this.scheduleExternal(bundle, String(filename))
      }))
    }
  }

  async run() {
    this.resetWatchers()
    await this.startChild()
    await new Promise(resolvePromise => {
      const stop = async signal => {
        if (this.stopping) return
        this.stopping = true
        process.stdout.write(`[dsh-dev] stopping on ${signal}\n`)
        clearTimeout(this.timer)
        clearTimeout(this.recoveryTimer)
        clearTimeout(this.stableTimer)
        for (const watcher of this.watchers) watcher.close()
        await this.queue.catch(() => {})
        await this.stopChild()
        resolvePromise()
      }
      process.once('SIGINT', () => { void stop('SIGINT') })
      process.once('SIGTERM', () => { void stop('SIGTERM') })
    })
  }
}

export async function main(argv = process.argv.slice(2), workspaceRoot = DEFAULT_WORKSPACE_ROOT) {
  const options = parseDevArgs(argv)
  if (options.help) {
    process.stdout.write(helpText())
    return 0
  }
  const [dshVersion, pnpmVersion] = await Promise.all([requireTool('dsh'), requireTool('pnpm')])
  const state = await discoverState(workspaceRoot, options.plugins, process.cwd())
  process.stdout.write(`[dsh-dev] dsh ${dshVersion}; pnpm ${pnpmVersion}; ${state.bundles.length} bundles discovered\n`)
  if (state.bundles.length === 0) throw new Error('no DSH bundles discovered')
  if (options.check) return 0

  if (!options.skipBuild) {
    const initialNames = dependencyClosure(state.packages, workspaceBundles(state.packages).map(bundle => bundle.id))
    await buildWorkspacePackages(workspaceRoot, state.packages, initialNames)
    await buildExternalBundles(state.external)
  }
  if (!options.skipInstall) await syncProfile(options.profile, state.bundles, workspaceRoot)
  const patchFile = await writeHmrPatch(workspaceRoot, options.profile, state.external, state.packages)
  await probeComposedConfig(options.profile, patchFile, workspaceRoot)
  process.stdout.write(`[dsh-dev] profile ${options.profile} is ready with ${state.bundles.length} local bundles\n`)
  if (options.prepareOnly) return 0

  const runtime = new DevRuntime(workspaceRoot, options, state, patchFile)
  await runtime.run()
  return 0
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === SCRIPT_FILE) {
  main().then(code => { process.exitCode = code }).catch(error => {
    process.stderr.write(`[dsh-dev] ${error.message}\n`)
    process.exitCode = 1
  })
}
