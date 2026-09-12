import { join, resolve } from 'node:path'
import { copyFile, mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
import { Context } from '@deepseek-ai/cordis'
import { expect, it, vi } from 'vitest'
import { SkillReferenceReader, type SkillReferenceOwner } from '../src/reference-reader.ts'

// Apply the reviewed additive packet to an isolated copy of the real owner.
it('uses the real Skills registry and respects winning-provider changes without reading runtime bodies', async () => {
  const project = resolve(import.meta.dirname, '../../../..')
  const artifacts = process.env.DSH_REFERENCE_READER_ARTIFACTS
  if (!artifacts) throw new Error('Run the existing integration evidence entry point with --host')
  await mkdir(artifacts, { recursive: true })
  const isolated = await mkdtemp(join(artifacts, 'skill-owner-'))
  const ownerPackage = resolve(project, 'temp/dsh-unified-host-source/packages/skill/skill')
  const relativeSource = 'packages/skill/skill/src/index.ts'
  await mkdir(join(isolated, 'packages/skill/skill/src'), { recursive: true })
  await copyFile(join(ownerPackage, 'src/index.ts'), join(isolated, relativeSource))
  const patch = resolve(project, 'upstream-prs/skill-document-reader-v1/apply.sh')
  execFileSync('bash', [patch, isolated, '--check'])
  execFileSync('bash', [patch, isolated])
  await symlink(join(ownerPackage, 'node_modules'), join(isolated, 'node_modules'), 'dir')
  const program = ts.createProgram([join(isolated, relativeSource)], { target: ts.ScriptTarget.ES2024, module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler, noEmit: true, strict: true, skipLibCheck: true,
    noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true, allowImportingTsExtensions: true, esModuleInterop: true })
  expect(ts.getPreEmitDiagnostics(program).map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))).toEqual([])
  const compiled = ts.transpileModule(await readFile(join(isolated, relativeSource), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, experimentalDecorators: true },
  })
  await writeFile(join(isolated, 'owner.mjs'), compiled.outputText)
  const module = await import(pathToFileURL(join(isolated, 'owner.mjs')).href)
  const root = new Context()
  try {
    await root.plugin(module.default)
    const owner = root.get('skills' as never) as unknown as SkillReferenceOwner & { registerProvider(factory: () => unknown): () => void; register(value: unknown): () => void }
    const candidate = { name: 'review', description: 'Readable review guide', source: 'user-agents', provider: 'filesystem', rank: 600,
      invocation: { modelInvocable: true, userInvocable: true }, resourceBase: { kind: 'directory', path: 'controlled-package-root' }, locator: 'review' }
    const readFileProvider = vi.fn(async () => ({ ...candidate, content: '# Review guide\n中文文档' }))
    const removeFile = owner.registerProvider(() => ({ name: 'filesystem', list: async () => [candidate], get: readFileProvider }))
    const reader = new SkillReferenceReader(() => root.get('skills' as never) as unknown as SkillReferenceOwner)
    const input = { itemId: 'skill:review', source: 'user-agents', scope: 'profile' as const }
    expect(await reader.readSkill(input, new AbortController().signal)).toMatchObject({ status: 'ready', content: '# Review guide\n中文文档' })
    expect(readFileProvider).toHaveBeenCalledTimes(1)
    // Runtime contributions can carry copied file metadata; only the owner knows their origin.
    const removeDisguisedRuntime = owner.register({ ...candidate, content: 'Runtime-only fixture content' })
    expect(await reader.readSkill(input, new AbortController().signal)).toMatchObject({ status: 'denied', reason: 'document_not_readable' })
    expect(readFileProvider).toHaveBeenCalledTimes(1)
    removeDisguisedRuntime()
    const runtimeGet = vi.fn()
    const removeRuntime = owner.registerProvider(() => ({ name: 'runtime-fixture', list: async () => [{ ...candidate, source: 'runtime', provider: 'runtime-fixture', rank: 0 }], get: runtimeGet }))
    expect(await reader.readSkill(input, new AbortController().signal)).toMatchObject({ status: 'denied', reason: 'source_not_readable' })
    expect(runtimeGet).not.toHaveBeenCalled()
    removeRuntime()
    removeFile()
    expect(await reader.readSkill(input, new AbortController().signal)).toMatchObject({ status: 'denied' })
  } finally {
    await root.fiber.dispose()
    execFileSync('git', ['-C', isolated, 'apply', '--reverse', resolve(project, 'upstream-prs/skill-document-reader-v1/changes.patch')])
    expect(await readFile(join(isolated, relativeSource), 'utf8')).toBe(await readFile(join(ownerPackage, 'src/index.ts'), 'utf8'))
  }
})
