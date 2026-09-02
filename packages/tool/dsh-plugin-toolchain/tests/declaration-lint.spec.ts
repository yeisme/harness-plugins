import { afterEach, describe, expect, it } from 'vitest'
import { dirname, join } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { runDeclarationLint } from '../src/checkers/declaration-lint.js'
import { bundlePackageJson, cleanupWorkspace, makeWorkspace } from './helpers.js'

const roots: string[] = []
afterEach(() => {
  for (const root of roots) cleanupWorkspace(root)
  roots.length = 0
})

function workspace(files: Record<string, string>): string {
  const root = makeWorkspace(files)
  roots.push(root)
  return root
}

const GOOD_PATCH = [
  '# fixture comment',
  '- insert:',
  '  - id: dsh-fixture-bundle',
  "    name: '@yeisme/dsh-fixture-bundle'",
  '',
].join('\n')

describe('declaration-lint', () => {
  it('accepts an explicitly declared composition bundle with sibling targets', async () => {
    const root = workspace({
      'packages/bundle/dsh-command-experience/package.json': bundlePackageJson({ name: '@yeisme/dsh-command-experience' }),
      'packages/bundle/dsh-command-experience/cordis.patch.yml': "- insert:\n  - id: dsh-command-experience\n    name: '@yeisme/dsh-command-experience'\n",
    })
    const manifestPath = join(root, 'packages/bundle/dsh-composition/package.json')
    const patchPath = join(root, 'packages/bundle/dsh-composition/cordis.patch.yml')
    await mkdir(dirname(manifestPath), { recursive: true })
    await writeFile(manifestPath, JSON.stringify({
      name: '@yeisme/dsh-composition',
      version: '0.1.0',
      exports: { './cordis.patch.yml': './cordis.patch.yml', './package.json': './package.json' },
      dsh: { bundle: { patch: './cordis.patch.yml', composition: true } },
      dependencies: { '@yeisme/dsh-command-experience': 'workspace:*' },
    }))
    await writeFile(patchPath, '- insert:\n    - id: dsh-command-experience\n      name: \'@yeisme/dsh-command-experience\'\n')
    const result = runDeclarationLint(root)
    expect(result.findings.some(finding => finding.code === 'DECL/ID_DUPLICATE')).toBe(false)
    expect(result.findings.some(finding => finding.code === 'DECL/NAME_NOT_EXPORTED')).toBe(false)
    expect(result.findings.some(finding => finding.code === 'DECL/UNKNOWN_COMPOSITION_TARGET')).toBe(false)
  })
  it('passes a consistent bundle declaration', () => {
    const root = workspace({
      'packages/bundle/fixture/package.json': bundlePackageJson({}),
      'packages/bundle/fixture/cordis.patch.yml': GOOD_PATCH,
    })
    const result = runDeclarationLint(root)
    expect(result.status).toBe('pass')
    expect(result.checkedCount).toBe(1)
  })

  it('accepts subpath row names that are real exports (dsh-terminal/host form)', () => {
    const root = workspace({
      'packages/bundle/fixture/package.json': bundlePackageJson({ exports: ['.', './client', './host'] }),
      'packages/bundle/fixture/cordis.patch.yml': [
        '- insert:',
        '  - id: dsh-fixture-bundle',
        "    name: '@yeisme/dsh-fixture-bundle/host'",
        '',
      ].join('\n'),
    })
    const result = runDeclarationLint(root)
    expect(result.findings).toEqual([])
  })

  it('reds when row name is not an export of the package', () => {
    const root = workspace({
      'packages/bundle/fixture/package.json': bundlePackageJson({}),
      'packages/bundle/fixture/cordis.patch.yml': [
        '- insert:',
        '  - id: dsh-fixture-bundle',
        "    name: '@yeisme/some-other-package'",
        '',
      ].join('\n'),
    })
    const result = runDeclarationLint(root)
    expect(result.findings.map(finding => finding.code)).toContain('DECL/NAME_NOT_EXPORTED')
  })

  it('reds on duplicate insert ids across bundles and unparsed lines', () => {
    const root = workspace({
      'packages/bundle/a/package.json': bundlePackageJson({ name: '@yeisme/dsh-a' }),
      'packages/bundle/a/cordis.patch.yml': '- insert:\n  - id: shared-id\n    name: \'@yeisme/dsh-a\'\n',
      'packages/bundle/b/package.json': bundlePackageJson({ name: '@yeisme/dsh-b' }),
      'packages/bundle/b/cordis.patch.yml': '- insert:\n  - id: shared-id\n    name: \'@yeisme/dsh-b\'\n  weird-key: 1\n',
    })
    const result = runDeclarationLint(root)
    const codes = result.findings.map(finding => finding.code)
    expect(codes).toContain('DECL/ID_DUPLICATE')
    expect(codes).toContain('DECL/PATCH_UNPARSED')
  })

  it('reds on internal dependency that does not resolve to a repo package', () => {
    const root = workspace({
      'packages/bundle/fixture/package.json': bundlePackageJson({ deps: { '@yeisme/dsh-ghost': 'workspace:*' } }),
      'packages/bundle/fixture/cordis.patch.yml': GOOD_PATCH,
    })
    const result = runDeclarationLint(root)
    expect(result.findings.map(finding => finding.code)).toContain('DECL/UNKNOWN_INTERNAL_DEP')
  })

  it('notes (not reds) published-version internal pins and preset bundles without patch', () => {
    const root = workspace({
      'packages/client/ui-real/package.json': JSON.stringify({ name: '@yeisme/dsh-client-ui-real', version: '0.1.0-rc.1' }),
      'packages/bundle/fixture/package.json': bundlePackageJson({ deps: { '@yeisme/dsh-client-ui-real': '0.1.0-rc.1' } }),
      'packages/bundle/fixture/cordis.patch.yml': GOOD_PATCH,
      'packages/bundle/data-only/package.json': JSON.stringify({ name: '@yeisme/dsh-data-only', private: true }),
    })
    const result = runDeclarationLint(root)
    expect(result.status).toBe('pass')
    const notes = result.notes.join(' ')
    expect(notes).toContain('published 0.1.0-rc.1')
    expect(notes).toContain('preset/data bundle without cordis.patch.yml')
  })

  it('reds on host→client layer violation; notes bundle→bundle as established composition form', () => {
    const root = workspace({
      'packages/client/ui-x/package.json': JSON.stringify({ name: '@yeisme/dsh-client-ui-x' }),
      'packages/host/h/package.json': JSON.stringify({ name: '@yeisme/dsh-h', dependencies: { '@yeisme/dsh-client-ui-x': 'workspace:*' } }),
      'packages/bundle/two/package.json': bundlePackageJson({ name: '@yeisme/dsh-two' }),
      'packages/bundle/two/cordis.patch.yml': '- insert:\n  - id: two\n    name: \'@yeisme/dsh-two\'\n',
      'packages/bundle/one/package.json': bundlePackageJson({
        name: '@yeisme/dsh-one',
        deps: { '@yeisme/dsh-two': 'workspace:*' },
      }),
      'packages/bundle/one/cordis.patch.yml': '- insert:\n  - id: one\n    name: \'@yeisme/dsh-one\'\n',
    })
    const result = runDeclarationLint(root)
    expect(result.findings.map(finding => finding.code)).toContain('DECL/LAYER_HOST_TO_CLIENT')
    expect(result.findings.map(finding => finding.code)).not.toContain('DECL/LAYER_BUNDLE_TO_BUNDLE')
    expect(result.notes.join('\n')).toContain('bundle→bundle dep @yeisme/dsh-two（既定组合形态')
  })
})
