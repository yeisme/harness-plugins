/**
 * URL Session codec（纯函数，零 Cordis、零 window 访问）。
 *
 * 不变量（复杂解析规则以中文注释固化）：
 * - path `/s/<id>` 恒优于 query `s`；path 形式一旦出现（pathname 以 `/s/` 开头），
 *   结果只由 path 决定——即使 path 的 id 非法也不回退 query，query 一律忽略且不报错。
 * - `sessionId` 使用既有 SessionId 字面量：先做一次标准 URL 解码（容忍手工粘贴的
 *   percent-encoding），再用保守字符集校验；空/非法 id 一律视为「未指定会话」（null）。
 * - 生成的 URL 只含 origin 与 sessionId；origin 不得携带 userinfo、query 或 hash，
 *   sessionId 校验失败视为调用方契约错误（抛 TypeError），不产出半合法 URL。
 *
 * @module @yeisme/dsh-client-ui-url-session/codec
 */

/** 可解析的地址形状：接受 URL 实例或仅含 protocol/pathname/search 的普通对象。 */
export interface SessionLocationLike {
  readonly protocol?: string | undefined
  readonly pathname?: string | undefined
  readonly search?: string | undefined
}

/** 解析结果：`sessionId === null` 表示该地址未指定会话。 */
export interface SessionLocation {
  readonly sessionId: string | null
  /** 命中来源：path 主形式或 query 别名；未指定会话时为 null。 */
  readonly source: 'path' | 'query' | null
}

/** 会话 URL 生成入参。 */
export interface SessionUrlInput {
  readonly origin: string
  readonly sessionId: string
  /** `canonical` = `/s/<id>`（默认）；`alias` = `/?s=<id>`（无 SPA fallback 时可用）。 */
  readonly form?: 'canonical' | 'alias' | undefined
}

/** 既有 SessionId 字面量的保守字符集与长度界。 */
const SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
/** 主形式路径前缀；仅接受单段 id。 */
const SESSION_PATH_PREFIX = '/s/'
/** Prompt 内 mention 规范前缀。 */
const MENTION_PREFIX = 'dsh-session:'

/** 单次标准解码后再校验；任何失败都视为未指定，绝不猜测或二次变换。 */
function decodeSessionId(raw: string): string | null {
  let literal: string
  try {
    literal = decodeURIComponent(raw)
  } catch {
    return null
  }
  return SESSION_ID.test(literal) ? literal : null
}

/** 从 `?a=1&s=<id>&b=2` 形状的 search 中取首个 `s` 值（可为空 → null）。 */
function querySessionId(search: string | undefined): string | null {
  if (typeof search !== 'string' || search.length === 0) return null
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const value = params.get('s')
  if (value === null || value.length === 0) return null
  return decodeSessionId(value)
}

/** 解析一个地址中的会话身份；不读取 window/location，输入即全部状态。 */
export function parseSessionLocation(location: SessionLocationLike | URL): SessionLocation {
  const pathname = typeof location.pathname === 'string' ? location.pathname : ''
  const search = typeof location.search === 'string' ? location.search : undefined
  // path 形式出现即独占判定：`/s/<id>` 必须是恰好两段的路径，`/s/`、`/s/<id>/`、
  // `/s/<id>/<extra>` 都不合法（返回未指定），且此时 query 别名被忽略。
  if (pathname.startsWith(SESSION_PATH_PREFIX)) {
    const raw = pathname.slice(SESSION_PATH_PREFIX.length)
    if (raw.length === 0 || raw.includes('/')) return { sessionId: null, source: null }
    return { sessionId: decodeSessionId(raw), source: decodeSessionId(raw) === null ? null : 'path' }
  }
  const fromQuery = querySessionId(search)
  return fromQuery === null ? { sessionId: null, source: null } : { sessionId: fromQuery, source: 'query' }
}

/** 生成会话 URL；origin 携带 userinfo/query/hash 或 sessionId 非法视为契约错误。 */
export function sessionUrl(input: SessionUrlInput): string {
  const { origin, sessionId } = input
  const form = input.form ?? 'canonical'
  if (typeof origin !== 'string' || origin.length === 0) throw new TypeError('sessionUrl requires a non-empty origin')
  // URL 不含 secret：origin 里的 userinfo、query、hash 都不允许进入生成的链接。
  if (/[/@?#]/.test(origin.replace(/^https?:\/\/|^file:\/\//, '').replace(/\/+$/, '').split('/').pop() ?? '')) {
    throw new TypeError('sessionUrl origin must not carry userinfo, query, or hash')
  }
  if (/^https?:\/\/[^/]*@/.test(origin)) throw new TypeError('sessionUrl origin must not carry userinfo')
  if (typeof sessionId !== 'string' || !SESSION_ID.test(sessionId)) throw new TypeError(`sessionUrl received an invalid sessionId: ${String(sessionId)}`)
  // `file:` 空 host 需先归一为 `file://`，再拼接第三道斜杠的 path（file:///s/<id>）。
  const trimmed = origin.endsWith('/') ? origin.slice(0, -1) : origin
  const base = /^file:\/?\/?$/.test(trimmed) || trimmed === 'file:' ? 'file://' : trimmed
  const path = form === 'alias' ? `/?s=${encodeURIComponent(sessionId)}` : `/s/${encodeURIComponent(sessionId)}`
  return `${base}${path}`
}

/** 从 `dsh-session:<id>` mention 抽出 SessionId；非规范形式返回 null（P4 内跳复用）。 */
export function mentionSessionId(uri: string): string | null {
  if (typeof uri !== 'string' || !uri.startsWith(MENTION_PREFIX)) return null
  const raw = uri.slice(MENTION_PREFIX.length)
  if (raw.length === 0) return null
  return decodeSessionId(raw)
}
