#!/usr/bin/env node
/** Disposable offline histories, authored by the official persistence service. Never calls a model. */
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdir } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'

const root = resolve(import.meta.dirname, '..')
const source = resolve(root, 'temp/dsh-unified-host-source')
const load = path => import(pathToFileURL(resolve(source, path)).href)
const { Context } = await load('vendor/cordis/lib/index.js')
const { default: Sessions, Session, SessionId, SESSION_FORMAT_VERSION } = await load('packages/core/session/lib/index.js')
const { default: Persistence } = await load('packages/session/session-persistence-jsonl/lib/index.js')
const { createUserMessage, createMessage } = await load('packages/llm/llm/lib/index.js')
const ctx = new Context()
try {
  await ctx.plugin(Sessions)
  await ctx.plugin(Persistence, { root: resolve(root, 'temp/dsh-unified-home/sessions') })
  for (const name of ['A', 'B']) {
    const cwd = resolve(root, `temp/unified-browser/project-${name.toLowerCase()}`)
    await mkdir(cwd, { recursive: true })
    const id = SessionId(`acceptance-trace-${name.toLowerCase()}-${randomUUID()}`)
    const session = Session.create(id)
    session.append('turn/start', { turn: 1 })
    session.append('user/message', createUserMessage({ content: [{ type: 'text', text: `Offline acceptance conversation ${name}` }], source: { kind: 'user' } }), { surfaceOp: 'append' })
    session.append('step/start', { turn: 1, step: 1 })
    session.append('assistant/message', { turn: 1, step: 1, message: createMessage({ role: 'assistant', content: [{ type: 'text', text: `Offline recorded response ${name}; no model request was made.` }], source: { kind: 'model', provider: 'fixture', model: 'offline' } }) }, { surfaceOp: 'append' })
    session.append('step/end', { turn: 1, step: 1 })
    session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
    await ctx.sessionPersistence.create({ version: SESSION_FORMAT_VERSION, id, createdAt: Date.now(), cwd, isSeeded: false })
    await ctx.sessionPersistence.append(id, session.snapshotEvents())
    console.log(`Created offline fixture ${name}: ${id}`)
  }
} finally { await ctx.fiber.dispose() }
