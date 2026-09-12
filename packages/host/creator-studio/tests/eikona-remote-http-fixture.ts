import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import type { Duplex } from 'node:stream'
import type { BrowserContext } from '@playwright/test'

/** Real DSH Connection /api handler on an isolated loopback server; credentials stay in memory. */
export async function mountEikonaRemoteHTTP(ctx: Context, staging: string) {
  const records = new Map<unknown, unknown>()
  ctx.provide('credentials' as never, { async modifyRecord(key: unknown, mutate: (value: unknown) => Promise<unknown>) {
    const current = records.get(key), next = await mutate(current)
    if (next !== undefined) records.set(key, next)
    return next ?? current
  } } as never)
  type Route = { path: string; handler(request: IncomingMessage, response: ServerResponse): unknown }
  const routes: Route[] = []
  type Upgrade = { path: string; handler(request: IncomingMessage, socket: Duplex, head: Buffer): unknown }
  const upgrades: Upgrade[] = []
  ctx.provide('webServer' as never, { port: 0, tapIndex: () => () => {}, registerUpgrade(route: Upgrade) {
    upgrades.push(route)
    return () => { const index = upgrades.indexOf(route); if (index >= 0) upgrades.splice(index, 1) }
  }, register(route: Route) {
    routes.push(route)
    return () => { const index = routes.indexOf(route); if (index >= 0) routes.splice(index, 1) }
  } } as never)
  const connection = await import(pathToFileURL(resolve(staging, 'packages/client/connection/lib/index.js')).href)
  await ctx.plugin({ inject: [...connection.inject], apply: connection.apply })
  let frontendOrigin: string | undefined
  const server = createServer((request, response) => {
    if (!request.url?.startsWith('/api')) {
      if (!frontendOrigin || request.method !== 'GET') { response.writeHead(404); response.end(); return }
      void fetch(`${frontendOrigin}${request.url}`).then(async upstream => {
        response.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') ?? 'application/octet-stream' })
        response.end(Buffer.from(await upstream.arrayBuffer()))
      }).catch(() => { if (!response.headersSent) response.writeHead(502); response.end() })
      return
    }
    const route = routes.find(candidate => candidate.path === '/api')
    if (!route) { response.writeHead(404); response.end(); return }
    void Promise.resolve(route.handler(request, response)).catch(() => { if (!response.headersSent) response.writeHead(500); response.end() })
  })
  server.on('upgrade', (request, socket, head) => {
    const route = upgrades.find(candidate => candidate.path === request.url?.split('?')[0])
    if (!route) { socket.destroy(); return }
    route.handler(request, socket, head)
  })
  await new Promise<void>((ready, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', ready) })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Remote HTTP fixture did not bind loopback')
  const origin = `http://127.0.0.1:${address.port}`
  let cookie: string | undefined
  try {
    const handle = ctx.get('connection' as never) as { authenticatedUrl(origin: string): string; authorizeIndex(request: unknown, response: unknown): unknown }
    const target = new URL(handle.authenticatedUrl(origin))
    handle.authorizeIndex({ method: 'GET', url: `${target.pathname}${target.search}`, headers: { host: target.host } }, {
      writeHead(_status: number, headers: Record<string, string>) { cookie = headers?.['set-cookie']?.split(';', 1)[0] }, end() {},
    })
    if (!cookie) throw new Error('Remote HTTP fixture authorization did not complete')
  } catch (error) { server.closeAllConnections(); server.close(); throw error }
  let sequence = 0
  return {
    origin,
    async attachBrowser(browser: BrowserContext, frontend: string) {
      const target = new URL(frontend)
      if (target.hostname !== '127.0.0.1' || target.protocol !== 'http:') throw new Error('Remote fixture frontend must be loopback HTTP')
      frontendOrigin = target.origin
      const split = cookie!.indexOf('=')
      await browser.addCookies([{ name: cookie!.slice(0, split), value: cookie!.slice(split + 1), url: origin, httpOnly: true, sameSite: 'Strict' }])
    },
    async request(method: string, input?: unknown, authorized = true) {
      const rpcId = `eikona-http-${++sequence}`
      const response = await fetch(`${origin}/api/creatorStudio/${method}`, { method: 'POST',
        headers: { 'content-type': 'application/json', ...(authorized ? { cookie: cookie! } : {}) },
        body: JSON.stringify({ type: 'client-request', rpcId, method: `creatorStudio/${method}`, payload: { args: input === undefined ? {} : { input } } }),
      })
      if (response.status !== 200) { await response.arrayBuffer(); return { status: response.status, result: undefined } }
      const body = await response.json()
      if (response.status === 200 && (body.type !== 'server-response' || body.rpcId !== rpcId)) throw new Error('Remote HTTP fixture received an uncorrelated response')
      return { status: response.status, result: body.result }
    },
    async close() {
      cookie = undefined; records.clear()
      server.closeAllConnections()
      await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done()))
    },
  }
}
