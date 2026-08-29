/** Host plugin for bounded AST/LSP projections and same-origin Monaco assets. */

import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { basename, dirname, extname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  FILE_OPAQUE_REF_HOST_CONTEXT_KEY,
  createFileWorkspaceEditHost,
  type FilesApiRequest,
  type FilesApiResponse,
  type OpaqueFileRefRegistry,
  type NodeFileWorkspaceEditHost,
  readWorkspaceText,
} from '@yeisme/dsh-file-host/node'
import {
  LANGUAGE_INTELLIGENCE_CONTEXT_KEY,
  type LanguageDocumentChangeV1,
  type LanguageDocumentRefV1,
  type LanguageQueryV1,
  type TextPositionV1,
  type WorkspaceTextEditDraftV1,
  type WorkspaceTextEditV1,
} from '@yeisme/dsh-language-intelligence-host'
import {
  createNodeLanguageIntelligenceHost,
  type NodeLanguageDocumentSourceV1,
} from '@yeisme/dsh-language-intelligence-host/node'

export const name = 'dsh-semantic-file-editor'
export const inject = ['webServer', 'sessions', FILE_OPAQUE_REF_HOST_CONTEXT_KEY]

const API_PREFIX = '/yeisme-language/api/'
const ASSET_PREFIX = '/yeisme-language/assets/vs/'
const MAX_BODY_BYTES = 2 * 1024 * 1024

interface WebServerFace {
  register(route: {
    kind: 'prefix' | 'exact'
    path: string
    handler: (req: unknown, res: unknown) => Promise<void> | void
  }): () => void
}

interface SessionStoreFace {
  get?(sessionId: string): { header?: { cwd?: string } } | undefined
}

interface PluginContextFace {
  webServer?: WebServerFace
  sessions?: SessionStoreFace
  get?(name: string): unknown
  provide?(name: string, service: unknown): (() => void) | void
  effect?(factory: () => () => void, label?: string): void
}

interface AssetResponse extends FilesApiResponse {
  end(body?: string | Uint8Array): void
}

function sessionCwd(ctx: PluginContextFace, sessionId: string): string {
  const sessions = (ctx.sessions ?? ctx.get?.('sessions')) as SessionStoreFace | undefined
  const cwd = sessions?.get?.(sessionId)?.header?.cwd
  if (typeof cwd !== 'string' || cwd === '') throw new Error('session workspace is unavailable')
  return cwd
}

function monacoRoot(): string {
  const require = createRequire(import.meta.url)
  return dirname(require.resolve('monaco-editor'))
}

function assetMediaType(path: string): string {
  const ext = extname(path).toLowerCase()
  if (ext === '.js') return 'text/javascript; charset=utf-8'
  if (ext === '.css') return 'text/css; charset=utf-8'
  if (ext === '.json') return 'application/json; charset=utf-8'
  if (ext === '.svg') return 'image/svg+xml'
  if (ext === '.ttf') return 'font/ttf'
  if (ext === '.wasm') return 'application/wasm'
  return 'application/octet-stream'
}

function within(base: string, target: string): boolean {
  const path = relative(base, target)
  return path === '' || (!path.startsWith('..') && !path.includes(`..${process.platform === 'win32' ? '\\' : '/'}`))
}

async function readJson(req: FilesApiRequest): Promise<unknown> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk)
    total += buffer.length
    if (total > MAX_BODY_BYTES) throw new Error('request body exceeds the semantic API budget')
    chunks.push(buffer)
  }
  const source = Buffer.concat(chunks).toString('utf8')
  return source.trim() === '' ? {} : JSON.parse(source) as unknown
}

function json(res: AssetResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

function stringField(value: unknown, key: string): string {
  const field = (value as Record<string, unknown> | null)?.[key]
  if (typeof field !== 'string' || field === '') throw new Error(`missing or invalid ${key}`)
  return field
}

function textField(value: unknown, key: string): string {
  const field = (value as Record<string, unknown> | null)?.[key]
  if (typeof field !== 'string') throw new Error(`missing or invalid ${key}`)
  return field
}

function numberField(value: unknown, key: string): number {
  const field = (value as Record<string, unknown> | null)?.[key]
  if (typeof field !== 'number' || !Number.isSafeInteger(field) || field < 0) throw new Error(`missing or invalid ${key}`)
  return field
}

function positionOffset(source: string, position: TextPositionV1): number {
  let line = 0
  let offset = 0
  while (line < position.line && offset < source.length) {
    const next = source.indexOf('\n', offset)
    if (next < 0) return source.length
    offset = next + 1
    line += 1
  }
  return Math.max(offset, Math.min(source.length, offset + position.character))
}

function createSource(ctx: PluginContextFace, refs: OpaqueFileRefRegistry): NodeLanguageDocumentSourceV1 {
  return {
    async resolve(input) {
      const cwd = sessionCwd(ctx, input.sessionId)
      const target = await refs.resolve(cwd, input.ref)
      if (target.directory) throw new Error('directories do not support language intelligence')
      const read = await readWorkspaceText(target.target, 1024 * 1024)
      if (read.binary) throw new Error('binary resources do not support language intelligence')
      if (read.version === undefined) throw new Error('file version is unavailable')
      return {
        sessionId: input.sessionId,
        ref: input.ref,
        workspacePath: target.workspace,
        path: target.target,
        title: basename(target.target),
        text: read.content,
        truncated: read.truncated,
        readOnly: false,
        version: read.version,
      }
    },
    async resolveTarget(sessionId, uri) {
      let targetPath: string
      try {
        const parsed = new URL(uri)
        if (parsed.protocol !== 'file:') return undefined
        targetPath = fileURLToPath(parsed)
      } catch {
        return undefined
      }
      try {
        const cwd = sessionCwd(ctx, sessionId)
        const record = await refs.refForPath(cwd, targetPath)
        if (record.directory) return undefined
        const read = await readWorkspaceText(record.target, 1024 * 1024)
        return read.version === undefined ? { ref: record.ref } : { ref: record.ref, version: read.version }
      } catch {
        return undefined
      }
    },
  }
}

async function serveAsset(req: FilesApiRequest, res: AssetResponse, pathname: string): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    json(res, 405, { ok: false, error: { code: 'method-error', message: 'method not allowed' } })
    return
  }
  const root = monacoRoot()
  let relativePath: string
  try {
    relativePath = decodeURIComponent(pathname.slice(ASSET_PREFIX.length))
  } catch {
    json(res, 400, { ok: false, error: { code: 'bad-request', message: 'invalid asset path' } })
    return
  }
  const target = resolve(root, relativePath)
  if (relativePath === '' || !within(root, target)) {
    json(res, 404, { ok: false, error: { code: 'not-found', message: 'asset is unavailable' } })
    return
  }
  const info = await stat(target).catch(() => undefined)
  if (info === undefined || !info.isFile()) {
    json(res, 404, { ok: false, error: { code: 'not-found', message: 'asset is unavailable' } })
    return
  }
  res.writeHead(200, {
    'content-type': assetMediaType(target),
    'content-length': String(info.size),
    'cache-control': 'public, max-age=31536000, immutable',
    'x-content-type-options': 'nosniff',
  })
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  await new Promise<void>((resolveStream, reject) => {
    const stream = createReadStream(target)
    const writable = res as unknown as NodeJS.WritableStream
    stream.once('error', reject)
    writable.once?.('error', reject)
    writable.once?.('finish', resolveStream)
    stream.pipe(writable)
  })
}

export function apply(ctx: PluginContextFace): () => void {
  const webServer = (ctx.webServer ?? ctx.get?.('webServer')) as WebServerFace | undefined
  const refs = ctx.get?.(FILE_OPAQUE_REF_HOST_CONTEXT_KEY) as OpaqueFileRefRegistry | undefined
  if (webServer === undefined || typeof webServer.register !== 'function' || refs === undefined) return () => {}
  const host = createNodeLanguageIntelligenceHost(createSource(ctx, refs))
  const editHosts = new Map<string, NodeFileWorkspaceEditHost>()
  const editHost = (sessionId: string): NodeFileWorkspaceEditHost => {
    const cwd = sessionCwd(ctx, sessionId)
    const key = `${sessionId}\0${cwd}`
    let current = editHosts.get(key)
    if (current === undefined) {
      current = createFileWorkspaceEditHost(cwd, refs)
      editHosts.set(key, current)
    }
    return current
  }
  const unprovide = ctx.provide?.(LANGUAGE_INTELLIGENCE_CONTEXT_KEY, host)
  const route: Parameters<WebServerFace['register']>[0] = {
    kind: 'prefix',
    path: '/yeisme-language',
    handler: async (rawReq, rawRes) => {
      const req = rawReq as FilesApiRequest
      const res = rawRes as AssetResponse
      const pathname = new URL(req.url ?? '/', 'http://dsh.internal').pathname
      if (pathname.startsWith(ASSET_PREFIX)) {
        try {
          await serveAsset(req, res, pathname)
        } catch {
          json(res, 500, { ok: false, error: { code: 'internal', message: 'asset request failed' } })
        }
        return
      }
      if (!pathname.startsWith(API_PREFIX) || pathname.slice(API_PREFIX.length).includes('/')) {
        json(res, 404, { ok: false, error: { code: 'not-found', message: 'semantic endpoint is unavailable' } })
        return
      }
      if (req.method !== 'POST') {
        json(res, 405, { ok: false, error: { code: 'method-error', message: 'method not allowed' } })
        return
      }
      try {
        const payload = await readJson(req)
        const method = pathname.slice(API_PREFIX.length)
        if (method === 'probe') {
          const input: LanguageDocumentRefV1 = { sessionId: stringField(payload, 'sessionId'), ref: stringField(payload, 'ref') }
          json(res, 200, { ok: true, value: await host.probe(input) })
          return
        }
        if (method === 'open') {
          const input: LanguageDocumentRefV1 = { sessionId: stringField(payload, 'sessionId'), ref: stringField(payload, 'ref') }
          json(res, 200, { ok: true, value: await host.open(input) })
          return
        }
        if (method === 'change') {
          const input: LanguageDocumentChangeV1 = {
            handleId: stringField(payload, 'handleId'),
            documentVersion: numberField(payload, 'documentVersion'),
            text: textField(payload, 'text'),
          }
          json(res, 200, { ok: true, value: await host.change(input) })
          return
        }
        if (method === 'query') {
          const query = (payload as Record<string, unknown>).query as LanguageQueryV1
          if (typeof query !== 'object' || query === null || typeof query.kind !== 'string') throw new Error('missing or invalid query')
          json(res, 200, { ok: true, value: await host.query(stringField(payload, 'handleId'), numberField(payload, 'documentVersion'), query) })
          return
        }
        if (method === 'workspaceEditPreview') {
          const sessionId = stringField(payload, 'sessionId')
          const draft = (payload as Record<string, unknown>).draft as WorkspaceTextEditDraftV1
          if (typeof draft !== 'object' || draft === null || !Array.isArray(draft.files) || draft.rejectedReason !== undefined) throw new Error('workspace edit draft is invalid')
          const cwd = sessionCwd(ctx, sessionId)
          const targets = []
          for (const file of draft.files) {
            if (file.expectedVersion === undefined) throw new Error('workspace edit version is missing')
            const target = await refs.resolve(cwd, file.ref)
            if (target.directory) throw new Error('workspace edit targets a directory')
            const read = await readWorkspaceText(target.target, 1024 * 1024)
            if (read.binary || read.truncated) throw new Error('workspace edit target is not editable')
            targets.push({
              ref: file.ref,
              expectedVersion: file.expectedVersion,
              edits: file.edits.map((edit: WorkspaceTextEditV1['edits'][number]) => ({ start: positionOffset(read.content, edit.range.start), end: positionOffset(read.content, edit.range.end), newText: edit.newText })),
            })
          }
          json(res, 200, { ok: true, value: await editHost(sessionId).preview({ targets }) })
          return
        }
        if (method === 'workspaceEditApply') {
          const sessionId = stringField(payload, 'sessionId')
          json(res, 200, { ok: true, value: await editHost(sessionId).apply(stringField(payload, 'previewId')) })
          return
        }
        if (method === 'didSave') {
          await host.didSave(stringField(payload, 'handleId'), stringField(payload, 'fileVersion'))
          json(res, 200, { ok: true, value: null })
          return
        }
        if (method === 'close') {
          await host.close(stringField(payload, 'handleId'))
          json(res, 200, { ok: true, value: null })
          return
        }
        json(res, 404, { ok: false, error: { code: 'not-found', message: 'semantic method is unavailable' } })
      } catch {
        json(res, 400, { ok: false, error: { code: 'bad-request', message: 'semantic request was rejected' } })
      }
    },
  }
  let disposeRoute: (() => void) | undefined
  if (typeof ctx.effect === 'function') ctx.effect(() => webServer.register(route), 'semantic-file-editor: /yeisme-language route')
  else disposeRoute = webServer.register(route)
  return () => {
    disposeRoute?.()
    host.dispose()
    editHosts.clear()
    if (typeof unprovide === 'function') unprovide()
  }
}

const SemanticFileEditorPlugin = { name, inject, apply }

export default SemanticFileEditorPlugin
