import { createHash } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { createLocalAuctraAdapter, localAuctraConfigSchema } from '../src/local-auctra.ts'
import { LocalStudioCLI, saveLocalStudioConfig } from '../src/local-cli.ts'
import type { CreatorStudioContextV1 } from '../src/types.ts'

const context: CreatorStudioContextV1 = { tenantRef: 'tenant:test', workspaceRef: 'workspace:test', projectRef: 'project:test', sessionRef: 'session:test', principalRef: 'principal:test',
  membershipRevision: '1', installationRef: 'installation:test', pluginDigest: 'digest:test', policyRevision: '1', runtimeGeneration: '1', revision: '1' }
const body = 'Auctra 正文😀\r\n'
const digest = createHash('sha256').update(body).digest('hex')
const workingCopy = { schema_version: 'auctra.text_working_copy.v1alpha1', working_copy_ref: 'twc-test', project_ref: '/fixture/owner-project', unit_ref: 'text:note',
  format: 'plain_text', working_revision: 2, content_digest: digest, content_length: new TextEncoder().encode(body).byteLength, status: 'editing' }
const envelope = data => ({ schema_version: 'auctra.api.envelope.v1', status: 'success', data })
const openResponse = () => Response.json(envelope({ body, compatibility_projection: false, working_copy: workingCopy }))
const unitsResponse = () => Response.json(envelope([{ id: 'note', kind: 'xhs_note', title: '小红书笔记', status: 'editing' }]))
const statusResponse = () => Response.json(envelope({ ...workingCopy, allowed_actions: ['apply'] }))
const unavailable = () => new Response('{}', { status: 404 })

const directories: string[] = []
afterEach(async () => { for (const dir of directories.splice(0)) await rm(dir, { recursive: true, force: true }) })
async function fixture(token = 'connection-token') {
  const dir = await mkdtemp(join(tmpdir(), 'local-auctra-')); directories.push(dir)
  const connectionFile = join(dir, 'studio-connection.json')
  await writeFile(connectionFile, JSON.stringify({ schema_version: 'auctra.service.connection.v1', base_url: 'http://127.0.0.1:4317', token, project_ref: '/fixture/owner-project' }))
  return { dir, connectionFile }
}
const fetcherFor = () => {
  const calls: Array<{ url: string; authorization: string }> = []
  const fetcher: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), authorization: (init?.headers as Headers | undefined)?.get('Authorization') ?? '' })
    const path = String(url)
    if (path.endsWith('/text-working-copies/open?major=1')) return openResponse()
    if (path.endsWith('/text-units?major=1')) return unitsResponse()
    if (/\/text-working-copies\/twc-test\?major=1$/u.test(path)) return statusResponse()
    return unavailable()
  }
  return { fetcher, calls }
}

it('serves the configured unit read-only by default and never projects the token', async () => {
  const { connectionFile } = await fixture()
  const { fetcher, calls } = fetcherFor()
  const snapshot = await createLocalAuctraAdapter({ connectionFile, unit: 'text:note' }, fetcher).snapshot(context)
  expect(snapshot.status).toBe('attention_required')
  expect(snapshot.resources.some(item => item.title === 'Working Copy' && item.version === `2:${digest}`)).toBe(true)
  expect(snapshot.actions).toEqual([])
  expect(JSON.stringify(snapshot)).not.toMatch(/connection-token|owner-project|Auctra 正文/u)
  expect(calls[0]?.authorization).toBe('Bearer connection-token')
})

it('publishes save and candidate actions only when write admission is explicit', async () => {
  const { connectionFile } = await fixture()
  const { fetcher } = fetcherFor()
  const snapshot = await createLocalAuctraAdapter({ connectionFile, unit: 'text:note', write: true }, fetcher).snapshot(context)
  expect(snapshot.status).toBe('ready')
  expect(snapshot.actions.map(action => action.actionId)).toEqual(['working-copy.save', 'working-copy.candidate.create', 'working-copy.checkpoint.create'])
})

it('re-reads the connection file so a restarted auctra serve token applies without reload', async () => {
  const { connectionFile } = await fixture('token-one')
  const { fetcher, calls } = fetcherFor()
  const adapter = createLocalAuctraAdapter({ connectionFile, unit: 'text:note' }, fetcher)
  await adapter.snapshot(context)
  await writeFile(connectionFile, JSON.stringify({ schema_version: 'auctra.service.connection.v1', base_url: 'http://127.0.0.1:4317', token: 'token-two', project_ref: '/fixture/owner-project' }))
  await adapter.snapshot(context)
  expect(calls.at(-1)?.authorization).toBe('Bearer token-two')
})

it('stays honestly unavailable when the connection file is unreadable', async () => {
  const { fetcher, calls } = fetcherFor()
  const snapshot = await createLocalAuctraAdapter({ connectionFile: '/nonexistent/studio-connection.json', unit: 'text:note' }, fetcher).snapshot(context)
  expect(snapshot.status).toBe('attention_required')
  expect(snapshot.summary).toBe('Auctra is unavailable. No text body is shown.')
  expect(calls).toHaveLength(0)
})

it('rejects incomplete or invalid configuration without any owner request', () => {
  expect(localAuctraConfigSchema.safeParse({ unit: 'text:note' }).success).toBe(false)
  expect(localAuctraConfigSchema.safeParse({ connectionFile: '/tmp/c.json' }).success).toBe(false)
  expect(localAuctraConfigSchema.safeParse({ baseURL: 'http://127.0.0.1:4317', token: 't', ownerProjectRef: 'p', unit: 'note!' }).success).toBe(false)
  expect(localAuctraConfigSchema.safeParse({ connectionFile: '/tmp/c.json', connection: 'extra' }).success).toBe(false)
})

it('mounts through LocalStudioCLI user configuration only when the auctra section exists', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'local-cli-')); directories.push(dir)
  const config = join(dir, 'config.json')
  await saveLocalStudioConfig({ version: 1, workingDirectory: dir, auctra: { connectionFile: join(dir, 'c.json'), unit: 'text:note' } }, config)
  expect((await LocalStudioCLI.open(dir, config)).auctraAdapter()).toBeDefined()
  await saveLocalStudioConfig({ version: 1, workingDirectory: dir }, config)
  expect((await LocalStudioCLI.open(dir, config)).auctraAdapter()).toBeUndefined()
})
