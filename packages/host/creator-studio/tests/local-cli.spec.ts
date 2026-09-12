import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { LocalStudioCLI, saveLocalStudioConfig } from '../src/local-cli.ts'

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }))
vi.mock('node:child_process', async () => {
  const { promisify } = await import('node:util')
  return { execFile: Object.assign(() => {}, { [promisify.custom]: execute }) }
})
const directories: string[] = []
afterEach(async () => { execute.mockReset(); for (const dir of directories.splice(0)) await rm(dir, { recursive: true, force: true }) })
async function fixture() { const dir = await mkdtemp(join(tmpdir(), 'creator-local-')); directories.push(dir); return { dir, config: join(dir, 'config.json') } }

it('uses a fixed executable and argument array, preserves user configuration and redacts projections', async () => {
  const { dir, config } = await fixture()
  await saveLocalStudioConfig({ version: 1, workingDirectory: dir, eikona: { executable: '/owner/bin/eikona', config: '/user/private-config', project: 'p1' } }, config)
  execute.mockImplementation(async (_file, args) => ({ stdout: JSON.stringify(args[0] === 'list'
    ? { data: { runs: [{ run_id: 'run_one', project_id: 'p1', status: 'succeeded', model_ref: 'openai/gpt-5.4-image-2', prompt: 'must-not-project', path: '/private/image' }] } }
    : { data: { projects: [{ project_id: 'p1', root_path: dir }] } }), stderr: '' }))
  const local = await LocalStudioCLI.open(dir, config)
  const snapshot = await local.adapter('eikona').snapshot(local.context)
  expect(snapshot.resources.some(item => item.ref === 'eikona:run:run_one')).toBe(true)
  expect(JSON.stringify(snapshot)).not.toMatch(/must-not-project|private-config|\/private\/image/)
  expect(execute.mock.calls.find(call => call[1][0] === 'list')).toMatchObject(['/owner/bin/eikona', ['list', '--limit', '40', '--full', '--project', 'p1', '--json', '--config', '/user/private-config'], { cwd: dir, windowsHide: true }])
  expect(execute.mock.calls[0]![2]).not.toHaveProperty('shell')
  expect(JSON.parse(await readFile(config, 'utf8')).eikona.project).toBe('p1')
})

it('rejects invalid user configuration and never executes owner-provided command text', async () => {
  const { dir, config } = await fixture()
  await writeFile(config, '{"version":1,"command":"rm -rf anything"}')
  await expect(LocalStudioCLI.open(dir, config)).rejects.toThrow('Invalid user-level')
  expect(execute).not.toHaveBeenCalled()
})

it('maps the canonical Scaena Items envelope and rejects malformed responses instead of showing an empty success', async () => {
  const { dir, config } = await fixture()
  const local = await LocalStudioCLI.open(dir, config)
  execute.mockResolvedValue({ stdout: JSON.stringify({ data: { Items: [{ session_ref: 'session:one', version: 4, episode_ref: 'episode:one', status: 'running' }] } }), stderr: '' })
  const snapshot = await local.adapter('scaena').snapshot(local.context)
  expect(snapshot.resources[0]).toMatchObject({ ref: 'session:one', version: '4', title: 'episode:one' })
  execute.mockResolvedValue({ stdout: JSON.stringify({ data: { unexpected: [] } }), stderr: '' })
  expect((await local.adapter('scaena').snapshot(local.context)).status).toBe('offline')
})
