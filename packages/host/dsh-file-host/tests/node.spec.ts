import { mkdtemp, writeFile, mkdir, readFile, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createFileWorkspaceEditHost, createGitCompareSession, createOpaqueFileRefRegistry, handleYeismeFilesApi, listWorkspaceTree, NodeFileResourceMutationOwner, NodeFileTransferOwner, readGitDiffWindowV2, readGitHistoryWindow, readGitRepositoryContexts, readGitStatus, readGitStatusWindow, readWorkspaceBinary, readWorkspaceText, writeWorkspaceText } from '../src/node.ts'

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

  it('projects hidden and unsafe symlinks in paginated V2 without exposing paths', async () => {
    const root = await mkdtemp(join(tmpdir(), 'yeisme-tree-v2-'))
    const outside = await mkdtemp(join(tmpdir(), 'yeisme-tree-v2-outside-'))
    await writeFile(join(root, '.env'), 'TOKEN=hidden')
    await writeFile(join(root, 'README.md'), '# visible')
    await writeFile(join(root, '.gitignore'), 'ignored.log\n')
    await writeFile(join(root, 'ignored.log'), 'ignored')
    await writeFile(join(outside, 'secret.txt'), 'outside')
    await symlink(join(outside, 'secret.txt'), join(root, 'escape.txt'))
    await symlink(join(root, 'missing.txt'), join(root, 'broken.txt'))
    const refs = createOpaqueFileRefRegistry()
    const first = await refs.listV2(root, { limit: 2 })
    expect(first).toMatchObject({ generation: 'local', loaded: 2, truncated: true })
    expect(first.nextCursor).toBeTruthy()
    const second = await refs.listV2(root, { cursor: first.nextCursor, limit: 10 })
    const nodes = [...first.nodes, ...second.nodes]
    expect(nodes.find(node => node.name === '.env')).toMatchObject({ hidden: true, sensitive: true })
    expect(nodes.find(node => node.name === 'ignored.log')).toMatchObject({ ignored: true })
    expect(nodes.find(node => node.name === 'escape.txt')).toMatchObject({ kind: 'symlink', symlink: { outOfScope: true }, availability: { preview: { state: 'unavailable' } } })
    expect(nodes.find(node => node.name === 'broken.txt')).toMatchObject({ kind: 'symlink', symlink: { broken: true } })
    expect(JSON.stringify(nodes)).not.toContain(root)
    expect(JSON.stringify(nodes)).not.toContain(outside)
  })

  it('rejects opaque V2 requests when the session owner cannot be resolved', async () => {
    const req = { method: 'POST', url: '/yeisme-files/api/fs.treePageV2', async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify({ sessionId: 'missing' })) } }
    let status = 0
    let body = ''
    await handleYeismeFilesApi(req, { writeHead(code: number) { status = code }, end(value: string | Uint8Array) { body = String(value) } }, { sessionCwd: () => undefined, opaqueRefs: createOpaqueFileRefRegistry() })
    expect(status).toBe(403)
    expect(body).toContain('session workspace owner is unavailable')
    expect(body).not.toContain(process.cwd())
  })

  it('preflights, executes, redirects and undoes local resource mutations with CAS', async () => {
    const root = await mkdtemp(join(tmpdir(), 'yeisme-mutation-v1-'))
    const trash = await mkdtemp(join(tmpdir(), 'yeisme-trash-v1-'))
    await writeFile(join(root, 'old.txt'), 'value')
    const refs = createOpaqueFileRefRegistry()
    const rootRef = await refs.refForPath(root, root)
    const oldRef = (await refs.list(root)).find(entry => entry.name === 'old.txt')!.id
    const owner = new NodeFileResourceMutationOwner(root, refs, { trashRoot: trash })
    const base = { workspaceRef: owner.workspaceRef, principalRef: 'local', generation: 'local', leaseRef: 'local', expectedRevision: 'discover', destinationRef: rootRef.ref, idempotencyKey: 'rename-1' }
    const discovery = await owner.preflight({ ...base, action: 'rename', targetRefs: [oldRef], name: 'new.txt' })
    const prepared = await owner.preflight({ ...base, expectedRevision: discovery.revision, action: 'rename', targetRefs: [oldRef], name: 'new.txt' })
    expect(prepared.allowed).toBe(true)
    const receipt = await owner.execute(prepared.proposalRef, { ...base, expectedRevision: prepared.revision, previewDigest: prepared.previewDigest, action: 'rename', targetRefs: [oldRef], name: 'new.txt' })
    expect(receipt).toMatchObject({ status: 'success', redirects: [{ oldRef }] })
    await expect(readFile(join(root, 'new.txt'), 'utf8')).resolves.toBe('value')
    expect(await owner.reconcile('rename-1')).toEqual(receipt)
    await expect(owner.undo(receipt.receiptRef)).resolves.toMatchObject({ status: 'rolled_back' })
    await expect(readFile(join(root, 'old.txt'), 'utf8')).resolves.toBe('value')

    const createDiscovery = await owner.preflight({ ...base, action: 'create-file', name: 'created.txt', idempotencyKey: 'create-1' })
    const createPrepared = await owner.preflight({ ...base, expectedRevision: createDiscovery.revision, action: 'create-file', name: 'created.txt', idempotencyKey: 'create-1' })
    await writeFile(join(root, 'drift.txt'), 'drift')
    await expect(owner.execute(createPrepared.proposalRef, { ...base, expectedRevision: createPrepared.revision, previewDigest: createPrepared.previewDigest, action: 'create-file', name: 'created.txt', idempotencyKey: 'create-1' })).resolves.toMatchObject({ status: 'revision_drift' })
  })

  it('requires an explicit sensitive reveal token bound to ref and version', async () => {
    const root = await mkdtemp(join(tmpdir(), 'yeisme-sensitive-v1-'))
    await writeFile(join(root, '.env'), 'TOKEN=secret')
    const refs = createOpaqueFileRefRegistry()
    const entry = (await refs.list(root))[0]!
    const blocked = await refs.inspectV2(root, entry.id)
    expect(blocked).toMatchObject({ sensitive: true, usable: false, reason: expect.stringContaining('confirmation') })
    await expect(refs.assertSensitiveAccess(root, entry.id)).rejects.toThrow('confirmation')
    const reveal = await refs.issueSensitiveReveal(root, entry.id, blocked.version)
    await expect(refs.assertSensitiveAccess(root, entry.id, reveal.token)).resolves.toBeUndefined()
    await expect(refs.inspectV2(root, entry.id, reveal.token)).resolves.toMatchObject({ sensitive: true, usable: true, state: 'ready' })
  })

  it('keeps both on an explicit name conflict without overwriting the original', async () => {
    const root = await mkdtemp(join(tmpdir(), 'yeisme-keep-both-v1-'))
    await writeFile(join(root, 'same.txt'), 'original')
    const refs = createOpaqueFileRefRegistry()
    const rootRef = await refs.refForPath(root, root)
    const owner = new NodeFileResourceMutationOwner(root, refs)
    const seed = { action: 'create-file' as const, workspaceRef: owner.workspaceRef, principalRef: 'local', generation: 'local', leaseRef: 'local', expectedRevision: 'discover', destinationRef: rootRef.ref, name: 'same.txt', conflict: 'keep-both' as const, idempotencyKey: 'keep-both-1' }
    const discovery = await owner.preflight(seed)
    const intent = { ...seed, expectedRevision: discovery.revision }
    const prepared = await owner.preflight(intent)
    const receipt = await owner.execute(prepared.proposalRef, { ...intent, previewDigest: prepared.previewDigest })
    expect(receipt.status).toBe('success')
    await expect(readFile(join(root, 'same.txt'), 'utf8')).resolves.toBe('original')
    await expect(readFile(join(root, 'same copy.txt'), 'utf8')).resolves.toBe('')
  })

  it('covers create directory, copy, move, trash/restore and import commit', async () => {
    const root = await mkdtemp(join(tmpdir(), 'yeisme-resource-actions-v1-'))
    const trash = await mkdtemp(join(tmpdir(), 'yeisme-resource-trash-v1-'))
    const staging = await mkdtemp(join(tmpdir(), 'yeisme-resource-upload-v1-'))
    await writeFile(join(root, 'a.txt'), 'alpha')
    await mkdir(join(root, 'dest'))
    const refs = createOpaqueFileRefRegistry()
    const rootRef = await refs.refForPath(root, root)
    const owner = new NodeFileResourceMutationOwner(root, refs, { trashRoot: trash })
    const execute = async (action: 'create-directory' | 'copy' | 'move' | 'trash' | 'import-commit', extra: Record<string, unknown>, key: string) => {
      const seed = { action, workspaceRef: owner.workspaceRef, principalRef: 'local', generation: 'local', leaseRef: 'local', expectedRevision: 'discover', idempotencyKey: key, ...extra }
      const discovery = await owner.preflight(seed as never)
      const intent = { ...seed, expectedRevision: discovery.revision }
      const prepared = await owner.preflight(intent as never)
      return owner.execute(prepared.proposalRef, { ...intent, previewDigest: prepared.previewDigest } as never)
    }
    await expect(execute('create-directory', { destinationRef: rootRef.ref, name: 'created' }, 'mkdir')).resolves.toMatchObject({ status: 'success' })
    const sourceRef = (await refs.refForPath(root, join(root, 'a.txt'))).ref
    const destRef = (await refs.refForPath(root, join(root, 'dest'))).ref
    await expect(execute('copy', { targetRefs: [sourceRef], destinationRef: destRef }, 'copy')).resolves.toMatchObject({ status: 'success' })
    await expect(readFile(join(root, 'dest', 'a.txt'), 'utf8')).resolves.toBe('alpha')
    const moveReceipt = await execute('move', { targetRefs: [sourceRef], destinationRef: destRef, name: 'moved.txt' }, 'move')
    expect(moveReceipt).toMatchObject({ status: 'success', redirects: [{ oldRef: sourceRef }] })
    const movedRef = (await refs.refForPath(root, join(root, 'dest', 'moved.txt'))).ref
    const trashReceipt = await execute('trash', { targetRefs: [movedRef] }, 'trash')
    expect(trashReceipt).toMatchObject({ status: 'success', undoRef: expect.stringMatching(/^undo-/) })
    await expect(readFile(join(root, 'dest', 'moved.txt'))).rejects.toThrow()
    await expect(owner.undo(trashReceipt.receiptRef)).resolves.toMatchObject({ status: 'rolled_back' })
    await expect(readFile(join(root, 'dest', 'moved.txt'), 'utf8')).resolves.toBe('alpha')

    const transfer = new NodeFileTransferOwner(root, refs, staging)
    const upload = await transfer.createUpload({ workspaceRef: owner.workspaceRef, generation: 'local', name: 'imported.bin', size: 3 })
    await transfer.uploadChunk(upload.sessionRef, 0, new Uint8Array([8, 9, 10]))
    const committed = await transfer.commitUpload(upload.sessionRef)
    await expect(execute('import-commit', { destinationRef: rootRef.ref, importRef: committed.importRef, name: 'imported.bin' }, 'import')).resolves.toMatchObject({ status: 'success' })
    await expect(readFile(join(root, 'imported.bin'))).resolves.toEqual(Buffer.from([8, 9, 10]))
  })

  it('rejects transfer offset/digest errors, cancellation and expiry', async () => {
    const root = await mkdtemp(join(tmpdir(), 'yeisme-transfer-negative-v1-'))
    const refs = createOpaqueFileRefRegistry()
    const transfer = new NodeFileTransferOwner(root, refs, await mkdtemp(join(tmpdir(), 'yeisme-transfer-negative-stage-v1-')))
    const workspaceRef = (await refs.listV2(root)).workspaceRef
    const first = await transfer.createUpload({ workspaceRef, generation: 'local', name: 'a.bin', size: 2 })
    await expect(transfer.uploadChunk(first.sessionRef, 1, new Uint8Array([1]))).rejects.toThrow('contiguous')
    await expect(transfer.uploadChunk(first.sessionRef, 0, new Uint8Array([1]), 'bad')).rejects.toThrow('digest')
    await transfer.cancelUpload(first.sessionRef)
    await expect(transfer.uploadChunk(first.sessionRef, 0, new Uint8Array([1]))).rejects.toThrow('unavailable')
    const now = Date.now()
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now)
    const expired = await transfer.createUpload({ workspaceRef, generation: 'local', name: 'b.bin', size: 1 })
    clock.mockReturnValue(now + 31 * 60_000)
    await expect(transfer.uploadChunk(expired.sessionRef, 0, new Uint8Array([1]))).rejects.toThrow('unavailable')
    clock.mockRestore()
  })

  it('uploads binary chunks and consumes a version-bound download ticket once', async () => {
    const root = await mkdtemp(join(tmpdir(), 'yeisme-transfer-v1-'))
    await writeFile(join(root, 'download.bin'), Buffer.from([1, 2, 3]))
    const refs = createOpaqueFileRefRegistry()
    const entry = (await refs.list(root)).find(item => item.name === 'download.bin')!
    const transfer = new NodeFileTransferOwner(root, refs, await mkdtemp(join(tmpdir(), 'yeisme-upload-v1-')))
    const workspaceRef = (await refs.listV2(root)).workspaceRef
    const upload = await transfer.createUpload({ workspaceRef, generation: 'local', name: 'import.bin', size: 4 })
    await expect(transfer.uploadChunk(upload.sessionRef, 0, new Uint8Array([4, 5]))).resolves.toEqual({ received: 2, complete: false })
    await expect(transfer.uploadChunk(upload.sessionRef, 2, new Uint8Array([6, 7]))).resolves.toEqual({ received: 4, complete: true })
    await expect(transfer.commitUpload(upload.sessionRef)).resolves.toMatchObject({ size: 4, digest: expect.stringMatching(/^[a-f0-9]{64}$/) })
    const proof = await refs.inspectV2(root, entry.id)
    const ticket = await transfer.issueDownloadTicket(entry.id, proof.version)
    await expect(transfer.consumeDownloadTicket(ticket.ticket)).resolves.toEqual(new Uint8Array([1, 2, 3]))
    await expect(transfer.consumeDownloadTicket(ticket.ticket)).rejects.toThrow('unavailable')
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
