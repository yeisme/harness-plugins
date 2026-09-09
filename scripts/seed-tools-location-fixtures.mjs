#!/usr/bin/env node
/** Disposable offline tool-call histories, authored by the official persistence service. Never calls a model. */
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'

const root = resolve(import.meta.dirname, '..')
const source = resolve(root, 'temp/dsh-unified-host-source')
const load = path => import(pathToFileURL(resolve(source, path)).href)
const { Context } = await load('vendor/cordis/lib/index.js')
const { default: Sessions, Session, SessionId, SESSION_FORMAT_VERSION } = await load('packages/core/session/lib/index.js')
const { default: Persistence } = await load('packages/session/session-persistence-jsonl/lib/index.js')
const { createMessage, createToolResultMessage, createUserMessage, ToolCallId } = await load('packages/llm/llm/lib/index.js')

const FILLER_TURNS = 48
const sessionsRoot = process.env.DSH_SEED_HOME ? resolve(process.env.DSH_SEED_HOME, 'sessions') : resolve(root, 'temp/dsh-unified-home/sessions')
const ctx = new Context()
try {
  await ctx.plugin(Sessions)
  await ctx.plugin(Persistence, { root: sessionsRoot })

  const appendToolCall = (session, turn, callId, name, output, isError = false, error = undefined) => {
    session.append('tool/call', { turn, step: 1, callId: ToolCallId(callId), name, arguments: '{"query":"offline"}' })
    const data = { turn, step: 1, message: createToolResultMessage({ callId: ToolCallId(callId), content: [{ type: 'text', text: output }], isError }) }
    session.append('tool/result', error === undefined ? data : { ...data, error }, { surfaceOp: 'append' })
  }

  // Session A: short transcript with a same-name pair and one errored call.
  const aId = SessionId(`tools-location-a-${randomUUID()}`)
  const a = Session.create(aId)
  a.append('turn/start', { turn: 1 })
  a.append('user/message', createUserMessage({ content: [{ type: 'text', text: 'Tools location acceptance A' }], source: { kind: 'user' } }), { surfaceOp: 'append' })
  a.append('step/start', { turn: 1, step: 1 })
  a.append('assistant/message', { turn: 1, step: 1, message: createMessage({ role: 'assistant', content: [{ type: 'text', text: 'Offline recorded response A; no model request was made.' }], source: { kind: 'model', provider: 'fixture', model: 'offline' } }) }, { surfaceOp: 'append' })
  appendToolCall(a, 1, 'a-echo-1', 'mcp__demo__echo', 'offline echo 1')
  a.append('step/end', { turn: 1, step: 1 })
  a.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
  a.append('turn/start', { turn: 2 })
  a.append('user/message', createUserMessage({ content: [{ type: 'text', text: 'Second offline turn for the same-name pair' }], source: { kind: 'user' } }), { surfaceOp: 'append' })
  a.append('step/start', { turn: 2, step: 1 })
  appendToolCall(a, 2, 'a-echo-2', 'mcp__demo__echo', 'offline echo 2')
  a.append('step/end', { turn: 2, step: 1 })
  a.append('turn/end', { turn: 2, reason: { kind: 'completed' } })
  a.append('turn/start', { turn: 3 })
  a.append('user/message', createUserMessage({ content: [{ type: 'text', text: 'Third offline turn with an errored call' }], source: { kind: 'user' } }), { surfaceOp: 'append' })
  a.append('step/start', { turn: 3, step: 1 })
  appendToolCall(a, 3, 'a-fail-1', 'mcp__demo__fail', 'offline failure detail', true, { name: 'DemoError', code: 'DEMO_FAIL' })
  a.append('step/end', { turn: 3, step: 1 })
  a.append('turn/end', { turn: 3, reason: { kind: 'completed' } })
  await ctx.sessionPersistence.create({ version: SESSION_FORMAT_VERSION, id: aId, createdAt: Date.now(), cwd: resolve(root, 'temp/unified-browser/project-a'), isSeeded: false })
  await ctx.sessionPersistence.append(aId, a.snapshotEvents())

  // Session B: one early tool call buried under FILLER_TURNS offline turns so the
  // initial transcript window cannot contain it; reveal must page history by reference.
  const bId = SessionId(`tools-location-history-${randomUUID()}`)
  const b = Session.create(bId)
  b.append('turn/start', { turn: 1 })
  b.append('user/message', createUserMessage({ content: [{ type: 'text', text: 'Tools location history B' }], source: { kind: 'user' } }), { surfaceOp: 'append' })
  b.append('step/start', { turn: 1, step: 1 })
  appendToolCall(b, 1, 'b-echo-1', 'mcp__demo__echo', 'offline early echo')
  b.append('step/end', { turn: 1, step: 1 })
  b.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
  for (let turn = 2; turn <= FILLER_TURNS + 1; turn++) {
    b.append('turn/start', { turn })
    b.append('user/message', createUserMessage({ content: [{ type: 'text', text: `Offline filler turn ${turn} of ${FILLER_TURNS + 1}` }], source: { kind: 'user' } }), { surfaceOp: 'append' })
    b.append('step/start', { turn, step: 1 })
    b.append('assistant/message', { turn, step: 1, message: createMessage({ role: 'assistant', content: [{ type: 'text', text: `Offline filler response ${turn}; no model request was made.` }], source: { kind: 'model', provider: 'fixture', model: 'offline' } }) }, { surfaceOp: 'append' })
    b.append('step/end', { turn, step: 1 })
    b.append('turn/end', { turn, reason: { kind: 'completed' } })
  }
  await ctx.sessionPersistence.create({ version: SESSION_FORMAT_VERSION, id: bId, createdAt: Date.now(), cwd: resolve(root, 'temp/unified-browser/project-b'), isSeeded: false })
  await ctx.sessionPersistence.append(bId, b.snapshotEvents())

  const manifest = { sessionA: aId, sessionB: bId, fillerTurns: FILLER_TURNS, modelCalls: false, redacted: true }
  await writeFile(resolve(root, 'temp/tools-location-sessions.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(JSON.stringify(manifest))
} finally { await ctx.fiber.dispose() }
