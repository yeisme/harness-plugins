import assert from 'node:assert/strict'
import { mkdtemp, rm, mkdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import { checkWorkbenchRuntime, workbenchCommand } from './workbench-runtime.mjs'

test('boot, profile installation and config probing use the same CLI independently of PATH', () => {
  const root = resolve('fixture workbench')
  const commands = [
    ['--profile', 'web', '--port', '40869'],
    ['plugin', '--profile', 'web', 'add', 'link:fixture'],
    ['--profile', 'web', '--dump-config'],
  ].map(args => workbenchCommand(root, args))
  for (const command of commands) {
    assert.equal(command.command, process.execPath)
    assert.equal(command.args[0], join(root, 'temp/dsh-unified-host-source/apps/cli/lib/bin.js'))
  }
  assert.deepEqual(commands[0].args.slice(1), ['--profile', 'web', '--port', '40869'])
})

test('missing staging fails with a recovery command instead of using installed dsh', async () => {
  const root = await mkdtemp(join(tmpdir(), 'workbench-runtime-'))
  try { assert.throws(() => checkWorkbenchRuntime(root), /checkout is missing.*pnpm dsh:workbench/) }
  finally { await rm(root, { recursive: true, force: true }) }
})

test('a different release checkout is rejected before any browser artifacts are accepted', async () => {
  const root = await mkdtemp(join(tmpdir(), 'workbench-release-'))
  try {
    const source = join(root, 'temp/dsh-unified-host-source')
    await mkdir(source, { recursive: true })
    execFileSync('git', ['init', '--quiet', source])
    execFileSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '--allow-empty', '-m', 'fixture release'], { cwd: source })
    assert.throws(() => checkWorkbenchRuntime(root), /release base does not match/)
  } finally { await rm(root, { recursive: true, force: true }) }
})
