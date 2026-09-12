import { cp, mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
import { Context } from '@deepseek-ai/cordis'
import { expect, it, vi } from 'vitest'

it('applies strict scope to actual Session owners while preserving legacy fallback and partial catalog truth', async () => {
  const artifacts = process.env.DSH_REFERENCE_READER_ARTIFACTS
  if (!artifacts) throw new Error('Run the integration evidence entry point with --host')
  const project = resolve(import.meta.dirname, '../../../..')
  const original = resolve(project, 'temp/dsh-unified-host-source/packages/api/session-controller')
  await mkdir(artifacts, { recursive: true })
  const isolated = await mkdtemp(join(artifacts, 'session-scope-'))
  const target = join(isolated, 'packages/api/session-controller/src')
  await cp(join(original, 'src'), target, { recursive: true })
  await symlink(join(original, 'node_modules'), join(isolated, 'node_modules'), 'dir')
  const packet = resolve(project, 'upstream-prs/session-catalog-scope-v1')
  execFileSync('bash', [join(packet, 'apply.sh'), isolated, '--check'])
  execFileSync('bash', [join(packet, 'apply.sh'), isolated])
  const roots = ['tool-catalog.ts', 'skill-catalog.ts'].map(file => join(target, file))
  const ambient = join(isolated, 'owner-ambient.ts')
  await writeFile(ambient, "import type {} from '@deepseek-ai/dsh-agent'\nimport type {} from '@deepseek-ai/dsh-agent-presets'\nimport type {} from '@deepseek-ai/dsh-tools'\n")
  const program = ts.createProgram([...roots, ambient], { target: ts.ScriptTarget.ES2024, module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler, noEmit: true, strict: true, skipLibCheck: true,
    noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true, allowImportingTsExtensions: true, esModuleInterop: true,
    paths: {
      '@deepseek-ai/dsh-tools': [resolve(project, 'temp/dsh-unified-host-source/packages/core/tools/lib/types/index.d.ts')],
      '@deepseek-ai/dsh-util-values': [resolve(project, 'temp/dsh-unified-host-source/packages/util/values/lib/types/index.d.ts')],
    } })
  expect(ts.getPreEmitDiagnostics(program).map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))).toEqual([])
  const root = new Context()
  let preset: string | undefined = 'chosen'
  let unavailable = true
  const scoped = { fixtureScope: true }
  const createAgent = vi.fn(), loadBody = vi.fn(), disposed = vi.fn()
  const schemas = vi.fn((scope: unknown) => [{ name: scope ? 'scoped-read' : 'global-read' }])
  const skill = { name: 'review', description: 'Guide', invocation: { userInvocable: true, modelInvocable: true } }
  const list = vi.fn(async () => [skill]), snapshot = vi.fn(async () => ({ skills: [skill], complete: false }))
  root.provide('agents' as never, { get: () => undefined, create: createAgent } as never)
  root.provide('sessionQuery' as never, { observeSession: async () => ({ header: { cwd: 'fixture-workspace' }, projections: { values: { agentPreset: preset } }, [Symbol.dispose]: disposed }) } as never)
  root.provide('tools' as never, { schemas } as never)
  root.provide('skills' as never, { list, snapshot, get: loadBody } as never)
  const removePresets = root.provide('agentPresets' as never, { standingKeyFor: async () => { if (unavailable) throw new Error('private preset detail'); return scoped } } as never)
  try {
    for (const file of roots) {
      const output = ts.transpileModule(await readFile(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
      const filename = join(isolated, file.endsWith('tool-catalog.ts') ? 'tools.mjs' : 'skills.mjs')
      await writeFile(filename, output)
      const Owner = (await import(pathToFileURL(filename).href)).default
      const owner = new Owner(root)
      const legacy = await owner.list({ sessionId: 'a', includeModelInvocable: true }, new AbortController().signal)
      expect(legacy).not.toHaveProperty('scopeResolved')
      if ('skills' in legacy) expect(legacy.catalogComplete).toBe(true)
      const invalidFlag = await owner.list({ sessionId: 'a', requireResolvedScope: 'true' }, new AbortController().signal)
      expect(invalidFlag).not.toHaveProperty('scopeResolved')
      const before = schemas.mock.calls.length + list.mock.calls.length + snapshot.mock.calls.length
      await expect(owner.list({ sessionId: 'a', requireResolvedScope: true }, new AbortController().signal)).rejects.toMatchObject({ details: { reason: 'session_scope_unavailable' } })
      expect(schemas.mock.calls.length + list.mock.calls.length + snapshot.mock.calls.length).toBe(before)
      unavailable = false
      const strict = await owner.list({ sessionId: 'a', requireResolvedScope: true, includeModelInvocable: true }, new AbortController().signal)
      expect(strict.scopeResolved).toBe(true)
      if ('tools' in strict) expect(strict.tools).toEqual([{ name: 'scoped-read' }])
      else expect(strict.catalogComplete).toBe(false)
      unavailable = true
    }
    removePresets()
    const Owner = (await import(pathToFileURL(join(isolated, 'tools.mjs')).href)).default
    const toolsOwner = root.get('sessionToolCatalog' as never) as unknown as InstanceType<typeof Owner>
    await expect(toolsOwner.list({ sessionId: 'a', requireResolvedScope: true }, new AbortController().signal)).rejects.toMatchObject({ details: { reason: 'session_scope_unavailable' } })
    preset = undefined
    expect(await toolsOwner.list({ sessionId: 'a', requireResolvedScope: true }, new AbortController().signal)).toMatchObject({ scopeResolved: true, tools: [{ name: 'global-read' }] })
    expect(createAgent).not.toHaveBeenCalled(); expect(loadBody).not.toHaveBeenCalled()
    expect(disposed).toHaveBeenCalled()
  } finally {
    await root.fiber.dispose()
    execFileSync('git', ['-C', isolated, 'apply', '--reverse', join(packet, 'changes.patch')])
    for (const file of ['types.ts', 'tool-catalog.ts', 'skill-catalog.ts']) expect(await readFile(join(target, file), 'utf8')).toBe(await readFile(join(original, 'src', file), 'utf8'))
  }
})
