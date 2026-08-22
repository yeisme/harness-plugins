#!/usr/bin/env node
/**
 * Minimal Workbench module generator.
 *
 * Usage:
 *   node packages/bundle/dsh-workbench-core/scripts/generate-module.mjs my-module
 *   node packages/bundle/dsh-workbench-core/scripts/generate-module.mjs my-module --with-panel
 *   node packages/bundle/dsh-workbench-core/scripts/generate-module.mjs my-module --with-openapi
 *   node packages/bundle/dsh-workbench-core/scripts/generate-module.mjs my-module --with-panel --with-openapi
 *   node packages/bundle/dsh-workbench-core/scripts/generate-module.mjs my-module --out-dir /tmp/out
 *
 * Creates packages/bundle/dsh-<name>/ with a Workbench Core module skeleton.
 * This is an evaluation scaffold, not a full package manager replacement.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const args = process.argv.slice(2)
const flags = new Set()
let name
let outDir

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index]
  if (arg === '--with-panel' || arg === '--with-openapi') {
    flags.add(arg)
  } else if (arg === '--out-dir') {
    outDir = args[index + 1]
    index += 1
  } else if (name === undefined) {
    name = arg
  } else {
    console.error(`Unknown argument: ${arg}`)
    process.exit(1)
  }
}

if (!name || !/^[a-z0-9][a-z0-9-]{1,63}$/.test(name)) {
  console.error('Usage: node generate-module.mjs <module-name> [--with-panel] [--with-openapi] [--out-dir <dir>]')
  process.exit(1)
}

const repoRoot = resolve(import.meta.dirname, '..', '..', '..', '..')
const dir = outDir === undefined
  ? resolve(repoRoot, 'packages', 'bundle', `dsh-${name}`)
  : resolve(outDir, `dsh-${name}`)
const pkgName = `@yeisme/dsh-${name}`
const pascalName = name.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('')
const withPanel = flags.has('--with-panel')
const withOpenapi = flags.has('--with-openapi')

const files = {
  'package.json': JSON.stringify({
    name: pkgName,
    version: '0.1.0-rc.1',
    description: `DSH Workbench module: ${name}`,
    type: 'module',
    main: 'lib/index.js',
    types: 'lib/types/index.d.ts',
    scripts: {
      typecheck: 'tsc -p tsconfig.json --noEmit',
      test: 'vitest run',
      build: 'tsc -p tsconfig.json && tsdown',
    },
    dependencies: {
      '@yeisme/dsh-workbench-core': 'workspace:*',
      react: '^18.2.0',
    },
    devDependencies: {
      typescript: '^5.6.0',
      tsdown: '^0.22.2',
      vitest: '^3.0.0',
      '@types/react': '~18.3.1',
    },
  }, null, 2),
  'tsconfig.json': JSON.stringify({
    extends: '../../../tsconfig.base.client.json',
    compilerOptions: { rootDir: 'src', outDir: 'lib/types' },
    include: ['src'],
  }, null, 2),
  'src/module.ts': `import type { WorkbenchModuleDefinitionV1 } from '@yeisme/dsh-workbench-core'

export const module: WorkbenchModuleDefinitionV1 = {
  id: 'dsh-${name}',
  version: '0.1.0-rc.1',
  title: '${name}',
  requiredCapabilities: [],
  tabs: [
    { id: '${name}', moduleId: 'dsh-${name}', title: '${name}', order: 0, closable: true, scope: 'session-maybe' },
  ],
  commands: [],
}
`,
  'src/index.ts': `export { module } from './module.ts'
`,
  'tests/module.spec.ts': `import { describe, expect, it } from 'vitest'
import { WorkbenchRegistry } from '@yeisme/dsh-workbench-core'
import { module } from '../src/module.ts'

describe('${name} module', () => {
  it('registers into Workbench Core', () => {
    const registry = new WorkbenchRegistry()
    registry.register(module)
    expect(registry.snapshot().modules.map(item => item.id)).toEqual(['dsh-${name}'])
  })
})
`,
  'README.md': `# ${pkgName}

DSH Workbench module generated from the Workbench Core scaffold.

## Development

\`\`\`bash
pnpm --filter ${pkgName} run typecheck
pnpm --filter ${pkgName} run test
pnpm --filter ${pkgName} run build
\`\`\`
`,
}

if (withPanel) {
  files['src/client/index.ts'] = `export { ${pascalName}Panel } from './${name}-panel.tsx'
`
  files[`src/client/${name}-panel.tsx`] = `/**
 * ${name} Workbench panel.
 *
 * This generated panel is a local UI placeholder. Domain state stays with the
 * owning DSH/domain seam.
 *
 * @module ${pkgName}/client
 */

export interface ${pascalName}PanelProps {
  /** Optional safe summary shown while no domain projection is connected. */
  summary?: string | undefined
}

export function ${pascalName}Panel({ summary }: ${pascalName}PanelProps) {
  return (
    <section aria-label="${name}" data-dsh-${name}-panel>
      <h3>${name}</h3>
      <p>{summary ?? '${name} panel placeholder.'}</p>
    </section>
  )
}

export default ${pascalName}Panel
`
}

if (withOpenapi) {
  files['openapi.yaml'] = `openapi: 3.0.3
info:
  title: ${pkgName}
  version: 0.1.0-rc.1
  description: Generated DSH Workbench module OpenAPI skeleton.
paths: {}
`
}

await mkdir(resolve(dir, 'src'), { recursive: true })
if (withPanel) await mkdir(resolve(dir, 'src', 'client'), { recursive: true })
await mkdir(resolve(dir, 'tests'), { recursive: true })
for (const [file, content] of Object.entries(files)) {
  await writeFile(resolve(dir, file), content)
}
console.log(`Created ${dir}${withPanel ? ' (with panel)' : ''}${withOpenapi ? ' (with openapi)' : ''}`)
