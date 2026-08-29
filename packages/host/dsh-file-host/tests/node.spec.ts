import { mkdtemp, writeFile, mkdir, readFile, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createFileWorkspaceEditHost, createGitCompareSession, createOpaqueFileRefRegistry, handleYeismeFilesApi, listWorkspaceTree, readGitDiffWindowV2, readGitHistoryWindow, readGitRepositoryContexts, readGitStatus, readGitStatusWindow, readWorkspaceBinary, readWorkspaceText, writeWorkspaceText } from '../src/node.ts'

describe('@yeisme/dsh-file-host/node', () => {
  it('lists files and directories in one workspace level', async () => {
    const root = await mkdtemp(join(tmpdir(), 'yeisme-files-'))
    await mkdir(join(root, 'src'))
    await writeFile(join(root, 'README.md'), '# title\n')
    await writeFile(join(root, '.hidden'), 'x')
    const listing = await listWorkspaceTree(root)
    expect(listing.entries.map(entry => entry.name)).toEqual(['src', '.hidden', 'README.md'])
    expect(listing.entries.find(entry => entry.name === 'src')?.isDir).toBe(true)
    expect(listing.entries.find(entry => entry.name === 'README.md')?.isDir).toBe(false)
  })

  it('reads bounded utf8 text and refuses directory reads', async () => {
    const root = await mkdtemp(join(tmpdir(), 'yeisme-files-'))
    const file = join(root, 'notes.txt')
    await writeFile(file, 'hello pane')
    await expect(readWorkspaceText(file)).resolves.toMatchObject({ content: 'hello pane', binary: false })
    await expect(readWorkspaceText(root)).rejects.toThrow(/directory/)
  })

  it('reads bounded binary files and reports an honest oversized state', async () => {
    const root = await mkdtemp(join(tmpdir(), 'yeisme-files-'))
    const file = join(root, 'draft.docx')
    await writeFile(file, Buffer.from([80, 75, 3, 4]))
    const binary = await readWorkspaceBinary(file)
    expect([...binary.bytes]).toEqual([80, 75, 3, 4])
    expect(binary).toMatchObject({ size: 4, truncated: false })
    const oversized = await readWorkspaceBinary(file, 2)
    expect([...oversized.bytes]).toEqual([])
    expect(oversized).toMatchObject({ size: 4, truncated: true })
  })

  it('writes text only when the read version still matches', async () => {
    const root = await mkdtemp(join(tmpdir(), 'yeisme-files-'))
    const file = join(root, 'notes.txt')
    await writeFile(file, 'old')
    const opened = await readWorkspaceText(file)
    const saved = await writeWorkspaceText(file, 'new', opened.version!)
    expect(saved.status).toBe('ok')
    await expect(readWorkspaceText(file)).resolves.toMatchObject({ content: 'new' })
    await expect(writeWorkspaceText(file, 'stale overwrite', opened.version!)).resolves.toMatchObject({ status: 'conflict' })
  })

  it('previews and atomically applies bounded opaque multi-file edits', async () => {
    const root = await mkdtemp(join(tmpdir(), 'yeisme-workspace-edit-'))
    await writeFile(join(root, 'a.txt'), 'alpha')
    await writeFile(join(root, 'b.txt'), 'beta')
    const refs = createOpaqueFileRefRegistry()
    const entries = await refs.list(root)
    const a = entries.find(entry => entry.name === 'a.txt')!
    const b = entries.find(entry => entry.name === 'b.txt')!
    const aRead = await readWorkspaceText(join(root, 'a.txt'))
    const bRead = await readWorkspaceText(join(root, 'b.txt'))
    const host = createFileWorkspaceEditHost(root, refs)
    const preview = await host.preview({ targets: [
      { ref: a.id, expectedVersion: aRead.version!, edits: [{ start: 0, end: 5, newText: 'ALPHA' }] },
      { ref: b.id, expectedVersion: bRead.version!, edits: [{ start: 4, end: 4, newText: '!' }] },
    ] })
    expect(preview.files).toEqual([
      expect.objectContaining({ ref: a.id, editCount: 1, diff: expect.stringContaining('ALPHA') }),
      expect.objectContaining({ ref: b.id, editCount: 1, diff: expect.stringContaining('beta!') }),
    ])
    expect(JSON.stringify(preview)).not.toContain(root)
    await expect(host.apply(preview.previewId)).resolves.toMatchObject({ status: 'ok' })
    await expect(readFile(join(root, 'a.txt'), 'utf8')).resolves.toBe('ALPHA')
    await expect(readFile(join(root, 'b.txt'), 'utf8')).resolves.toBe('beta!')
  })

  it('rejects a workspace edit when a target changes after preview', async () => {
    const root = await mkdtemp(join(tmpdir(), 'yeisme-workspace-edit-'))
    const path = join(root, 'a.txt')
    await writeFile(path, 'alpha')
    const refs = createOpaqueFileRefRegistry()
    const entry = (await refs.list(root))[0]!
    const opened = await readWorkspaceText(path)
    const host = createFileWorkspaceEditHost(root, refs)
    const preview = await host.preview({ targets: [{ ref: entry.id, expectedVersion: opened.version!, edits: [{ start: 0, end: 5, newText: 'ALPHA' }] }] })
    await writeFile(path, 'external')
    await expect(host.apply(preview.previewId)).resolves.toMatchObject({ status: 'conflict' })
    await expect(readFile(path, 'utf8')).resolves.toBe('external')
  })

  it('serves fs.tree and fs.read through the yeisme-files API', async () => {
    const root = await mkdtemp(join(tmpdir(), 'yeisme-files-'))
    await writeFile(join(root, 'a.ts'), 'export {}\n')
    const treeReq = {
      method: 'POST',
      url: '/yeisme-files/api/fs.tree',
      async *[Symbol.asyncIterator]() {
        yield Buffer.from(JSON.stringify({ cwd: root }))
      },
    }
    let treeBody = ''
    const treeRes = {
      writeHead() {},
      end(body: string) { treeBody = body },
    }
    await handleYeismeFilesApi(treeReq, treeRes, { sessionCwd: (_id, cwd) => cwd ?? root })
    const tree = JSON.parse(treeBody) as { ok: boolean; value: { entries: Array<{ name: string; isDir: boolean }> } }
    expect(tree.ok).toBe(true)
    expect(tree.value.entries.some(entry => entry.name === 'a.ts' && entry.isDir === false)).toBe(true)

    const readReq = {
      method: 'POST',
      url: '/yeisme-files/api/fs.read',
      async *[Symbol.asyncIterator]() {
        yield Buffer.from(JSON.stringify({ cwd: root, path: join(root, 'a.ts') }))
      },
    }
    let readBody = ''
    const readRes = {
      writeHead() {},
      end(body: string) { readBody = body },
    }
    await handleYeismeFilesApi(readReq, readRes, { sessionCwd: (_id, cwd) => cwd ?? root })
    const read = JSON.parse(readBody) as { ok: boolean; value: { content: string; version: string } }
    expect(read.value.content).toContain('export')

    const writeReq = {
      method: 'POST',
      url: '/yeisme-files/api/fs.write',
      async *[Symbol.asyncIterator]() {
        yield Buffer.from(JSON.stringify({ cwd: root, path: join(root, 'a.ts'), content: 'export const value = 1\n', expectedVersion: read.value.version }))
      },
    }
    let writeBody = ''
    const writeRes = { writeHead() {}, end(body: string) { writeBody = body } }
    await handleYeismeFilesApi(writeReq, writeRes, { sessionCwd: (_id, cwd) => cwd ?? root })
    expect(JSON.parse(writeBody)).toMatchObject({ ok: true, value: { status: 'ok' } })

    const binaryReq = {
      method: 'POST',
      url: '/yeisme-files/api/fs.binary',
      async *[Symbol.asyncIterator]() {
        yield Buffer.from(JSON.stringify({ cwd: root, path: join(root, 'a.ts') }))
      },
    }
    let binaryBody = ''
    const binaryRes = { writeHead() {}, end(body: string) { binaryBody = body } }
    await handleYeismeFilesApi(binaryReq, binaryRes, { sessionCwd: (_id, cwd) => cwd ?? root })
    expect(JSON.parse(binaryBody)).toMatchObject({ ok: true, value: { base64: Buffer.from('export const value = 1\n').toString('base64'), truncated: false } })
  })

  it('serves opaque V2 refs without returning or accepting client paths', async () => {
    const root = await mkdtemp(join(tmpdir(), 'yeisme-files-v2-'))
    const other = await mkdtemp(join(tmpdir(), 'yeisme-files-v2-other-'))
    const outside = await mkdtemp(join(tmpdir(), 'yeisme-files-v2-outside-'))
    await writeFile(join(root, 'app.ts'), 'export const value = 1\n')
    await writeFile(join(outside, 'secret.ts'), 'secret\n')
    await symlink(join(outside, 'secret.ts'), join(root, 'escape.ts'))
    const opaqueRefs = createOpaqueFileRefRegistry()
    const call = async (method: string, body: Record<string, unknown>) => {
      const req = {
        method: 'POST',
        url: `/yeisme-files/api/${method}`,
        async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify(body)) },
      }
      let responseBody = ''
      const res = { writeHead() {}, end(value: string) { responseBody = value } }
      await handleYeismeFilesApi(req, res, { sessionCwd: () => root, opaqueRefs })
      return JSON.parse(responseBody) as { ok: boolean; value?: unknown; error?: { code: string } }
    }
    const tree = await call('fs.treeV2', { sessionId: 'session-1' })
    expect(tree.ok).toBe(true)
    expect(JSON.stringify(tree)).not.toContain(root)
    const entries = tree.value as Array<{ id: string; name: string }>
    const entry = entries.find(item => item.name === 'app.ts')!
    expect(entry.id).toMatch(/^file-/)
    expect(entries.some(item => item.name === 'escape.ts')).toBe(false)
    await expect(opaqueRefs.resolve(other, entry.id)).rejects.toThrow('unavailable')

    const read = await call('fs.readV2', { sessionId: 'session-1', ref: entry.id })
    expect(read).toMatchObject({ ok: true, value: { content: 'export const value = 1\n', binary: false } })
    const opened = read.value as { version: string }
    await writeFile(join(root, 'app.ts'), 'external\n')
    const staleWrite = await call('fs.writeV2', { sessionId: 'session-1', ref: entry.id, content: 'overwrite\n', expectedVersion: opened.version })
    expect(staleWrite).toMatchObject({ ok: true, value: { status: 'conflict' } })
    const rejected = await call('fs.readV2', { sessionId: 'session-1', cwd: root, ref: entry.id })
    expect(rejected).toMatchObject({ ok: false, error: { code: 'forbidden' } })
  })

  it('reads git porcelain status for the workspace', async () => {
    const status = await readGitStatus(process.cwd())
    expect(status.branch.length).toBeGreaterThan(0)
    expect(Array.isArray(status.files)).toBe(true)
  })

  it('serves git.status through the yeisme-files API', async () => {
    const req = {
      method: 'POST',
      url: '/yeisme-files/api/git.status',
      async *[Symbol.asyncIterator]() {
        yield Buffer.from(JSON.stringify({ cwd: process.cwd() }))
      },
    }
    let body = ''
    const res = {
      writeHead() {},
      end(text: string) { body = text },
    }
    await handleYeismeFilesApi(req, res, { sessionCwd: () => process.cwd() })
    const parsed = JSON.parse(body) as { ok: boolean; value: { branch: string; files: unknown[] } }
    expect(parsed.ok).toBe(true)
    expect(parsed.value.branch.length).toBeGreaterThan(0)
  })

  it('serves typed git.stage and git.diff inside a disposable workspace', async () => {
    const { execFile } = await import('node:child_process')
    const { promisify } = await import('node:util')
    const execFileAsync = promisify(execFile)
    const root = await mkdtemp(join(tmpdir(), 'yeisme-git-'))
    await execFileAsync('git', ['init'], { cwd: root })
    await execFileAsync('git', ['config', 'user.email', 'dev@example.invalid'], { cwd: root })
    await execFileAsync('git', ['config', 'user.name', 'dev'], { cwd: root })
    await writeFile(join(root, 'README.md'), '# title\n')
    const stageReq = {
      method: 'POST',
      url: '/yeisme-files/api/git.stage',
      async *[Symbol.asyncIterator]() {
        yield Buffer.from(JSON.stringify({ cwd: root, path: 'README.md' }))
      },
    }
    let stageBody = ''
    const stageRes = { writeHead() {}, end(body: string) { stageBody = body } }
    await handleYeismeFilesApi(stageReq, stageRes, { sessionCwd: () => root })
    expect(JSON.parse(stageBody)).toMatchObject({ ok: true, value: { status: 'ok', actionId: 'stage' } })

    const diffReq = {
      method: 'POST',
      url: '/yeisme-files/api/git.diff',
      async *[Symbol.asyncIterator]() {
        yield Buffer.from(JSON.stringify({ cwd: root, path: 'README.md' }))
      },
    }
    let diffBody = ''
    const diffRes = { writeHead() {}, end(body: string) { diffBody = body } }
    await handleYeismeFilesApi(diffReq, diffRes, { sessionCwd: () => root })
    expect(JSON.parse(diffBody).ok).toBe(true)
  })

  it('runs the additive Git review window and mutation flow in a disposable repository', async () => {
    const { execFile } = await import('node:child_process')
    const { promisify } = await import('node:util')
    const execFileAsync = promisify(execFile)
    const root = await mkdtemp(join(tmpdir(), 'yeisme-git-review-'))
    await execFileAsync('git', ['init'], { cwd: root })
    await execFileAsync('git', ['config', 'user.email', 'dev@example.invalid'], { cwd: root })
    await execFileAsync('git', ['config', 'user.name', 'dev'], { cwd: root })
    await writeFile(join(root, 'README.md'), '# first\n')
    await execFileAsync('git', ['add', 'README.md'], { cwd: root })
    await execFileAsync('git', ['commit', '-m', 'initial'], { cwd: root })
    await writeFile(join(root, 'README.md'), '# changed\n')

    const [context] = await readGitRepositoryContexts(root)
    const status = await readGitStatusWindow(root, { repositoryRef: context.repositoryRef, worktreeRef: context.worktreeRef, limit: 200 })
    expect(status).toMatchObject({ freshness: 'fresh', total: 1, counts: { changes: 1 } })
    const file = status.files[0]!
    const diff = await readGitDiffWindowV2(root, { repositoryRef: context.repositoryRef, worktreeRef: context.worktreeRef, fileRef: file.fileRef, layout: 'unified', limit: 200 })
    expect(diff.hunks[0]?.lines.join('\n')).toContain('# changed')
    expect(JSON.stringify(diff)).not.toContain(root)

    const history = await readGitHistoryWindow(root, { repositoryRef: context.repositoryRef, worktreeRef: context.worktreeRef, limit: 200 })
    expect(history.total).toBe(1)
    expect(history.commits[0]?.message).toBe('initial')
    const compare = await createGitCompareSession(root, { repositoryRef: context.repositoryRef, worktreeRef: context.worktreeRef, baseRef: history.commits[0]!.commitRef, targetRef: history.commits[0]!.commitRef, revision: history.revision, layout: 'unified', pinned: true })
    expect(compare.sessionRef).toMatch(/^compare:/)
    expect(JSON.stringify(compare)).not.toContain(root)

    const api = async (method: string, body: Record<string, unknown>): Promise<{ ok: boolean; value: Record<string, unknown> }> => {
      const req = { method: 'POST', url: `/yeisme-files/api/${method}`, async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify({ cwd: root, ...body })) } }
      let response = ''
      await handleYeismeFilesApi(req, { writeHead() {}, end(text: string) { response = text } }, { sessionCwd: () => root })
      return JSON.parse(response) as { ok: boolean; value: Record<string, unknown> }
    }
    const discardIntent = { action: 'discard.preflight', repositoryRef: context.repositoryRef, worktreeRef: context.worktreeRef, expectedRevision: status.revision, fileRefs: [file.fileRef], idempotencyKey: 'idempotency:discard' }
    const discardPreflight = await api('git.mutation.preflight', { intent: discardIntent })
    expect(discardPreflight.value).toMatchObject({ allowed: true, risks: ['working_tree_data_loss', 'owner_backup_required'] })
    const discarded = await api('git.mutation.execute', { intent: { ...discardIntent, action: 'discard.execute', previewDigest: discardPreflight.value.previewDigest } })
    expect(discarded.value).toMatchObject({ status: 'ok', action: 'discard.execute' })
    expect(String(discarded.value.backupRef)).toMatch(/^backup:/)
    expect(await readFile(join(root, 'README.md'), 'utf8')).toBe('# first\n')
    const clean = await readGitStatusWindow(root, { repositoryRef: context.repositoryRef, worktreeRef: context.worktreeRef, limit: 200 })
    const undoIntent = { action: 'discard.undo', repositoryRef: context.repositoryRef, worktreeRef: context.worktreeRef, expectedRevision: clean.revision, backupRef: discarded.value.backupRef, idempotencyKey: 'idempotency:undo' }
    const undoPreflight = await api('git.mutation.preflight', { intent: undoIntent })
    const undone = await api('git.mutation.execute', { intent: { ...undoIntent, previewDigest: undoPreflight.value.previewDigest } })
    expect(undone.value).toMatchObject({ status: 'ok', action: 'discard.undo' })
    expect(await readFile(join(root, 'README.md'), 'utf8')).toBe('# changed\n')

    const baseIntent = { action: 'stage.all', repositoryRef: context.repositoryRef, worktreeRef: context.worktreeRef, expectedRevision: status.revision, idempotencyKey: 'idempotency:stage' }
    const preflight = await api('git.mutation.preflight', { intent: baseIntent })
    expect(preflight.value).toMatchObject({ allowed: true, targetCount: 1 })
    const staged = await api('git.mutation.execute', { intent: { ...baseIntent, previewDigest: preflight.value.previewDigest } })
    expect(staged.value).toMatchObject({ status: 'ok', action: 'stage.all' })
    const reconciled = await api('git.mutation.reconcile', { idempotencyKey: 'idempotency:stage' })
    expect(reconciled.value).toMatchObject({ receiptRef: staged.value.receiptRef })
  })

  it('rejects paths that escape the session workspace', async () => {
    const root = await mkdtemp(join(tmpdir(), 'yeisme-files-'))
    const req = {
      method: 'POST',
      url: '/yeisme-files/api/fs.tree',
      async *[Symbol.asyncIterator]() {
        yield Buffer.from(JSON.stringify({ cwd: root, path: '/etc' }))
      },
    }
    let body = ''
    let status = 0
    const res = {
      writeHead(code: number) { status = code },
      end(text: string) { body = text },
    }
    await handleYeismeFilesApi(req, res, { sessionCwd: () => root })
    expect(status).toBe(403)
    expect(body).toContain('forbidden')
  })

  it('rejects a write through a symlink that escapes the workspace', async () => {
    const root = await mkdtemp(join(tmpdir(), 'yeisme-files-'))
    const outside = await mkdtemp(join(tmpdir(), 'yeisme-outside-'))
    const target = join(outside, 'secret.txt')
    await writeFile(target, 'outside')
    const link = join(root, 'escape.txt')
    await symlink(target, link)
    const opened = await readWorkspaceText(target)
    const req = {
      method: 'POST', url: '/yeisme-files/api/fs.write',
      async *[Symbol.asyncIterator]() {
        yield Buffer.from(JSON.stringify({ cwd: root, path: link, content: 'overwrite', expectedVersion: opened.version }))
      },
    }
    let status = 0
    let body = ''
    const res = { writeHead(code: number) { status = code }, end(text: string) { body = text } }
    await handleYeismeFilesApi(req, res, { sessionCwd: () => root })
    expect(status).toBe(403)
    expect(body).toContain('file link escapes')
  })
})
