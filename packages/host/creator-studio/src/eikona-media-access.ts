import { createHash } from 'node:crypto'
import { CREATOR_ARTIFACT_IMAGE_MAX_BYTES } from './artifact-image.ts'
import { z } from 'zod'
const ref = z.string().regex(/^eikona:\/\/[A-Za-z0-9._:/-]{1,480}$/u)
const grant = z.object({ schema_version: z.literal('eikona.artifact_access_grant.v1'), artifact_uri: ref,
  url: z.string().max(2048), expires_at: z.string().datetime({ offset: true }), grant_id: z.string().regex(/^grant_[a-f0-9]{32}$/u),
  sha256: z.string().regex(/^[a-f0-9]{64}$/u), size_bytes: z.number().int().min(1).max(128 * 1024 * 1024),
}).strict()
/** Ephemeral Host-only access. Never put the returned bearer URL in snapshots or logs. */
export function inspectEikonaMediaAccess(input: unknown, expected: { artifactRef: string; contentDigest: string; mediaBaseURL: string }, now = Date.now()) {
  const parsed = grant.safeParse(input)
  if (!parsed.success || !Number.isFinite(now)) return undefined
  const value = parsed.data
  if (value.artifact_uri !== expected.artifactRef || value.sha256 !== expected.contentDigest) return undefined
  const expiry = Date.parse(value.expires_at)
  if (expiry <= now || expiry > now + 24 * 60 * 60 * 1000) return undefined
  try {
    const base = new URL(expected.mediaBaseURL), access = new URL(value.url)
    if (base.username || base.password || base.search || base.hash || !['https:', 'http:'].includes(base.protocol)
      || (base.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname))) return undefined
    const prefix = `${base.pathname.replace(/\/$/u, '')}/api/v1/artifact-access/`
    if (access.origin !== base.origin || access.username || access.password || access.search || access.hash
      || !access.pathname.startsWith(prefix) || !/^acc_[a-f0-9]{48}$/u.test(access.pathname.slice(prefix.length))) return undefined
    return { url: access.href, expiresAt: value.expires_at, byteLength: value.size_bytes, contentDigest: value.sha256, grantRef: value.grant_id }
  } catch { return undefined }
}

/** Read a previously validated grant without forwarding control-plane credentials. */
export async function readEikonaMediaBytes(access: NonNullable<ReturnType<typeof inspectEikonaMediaAccess>>, fetcher: typeof fetch = fetch, signal = AbortSignal.timeout(15000)) {
  if (Date.parse(access.expiresAt) <= Date.now() || access.byteLength > CREATOR_ARTIFACT_IMAGE_MAX_BYTES) return undefined
  try {
    const response = await fetcher(access.url, { method: 'GET', redirect: 'error', credentials: 'omit', signal })
    const mediaType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()
    if (!response.ok || !response.body || !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(mediaType ?? '')) { await response.body?.cancel(); return undefined }
    const chunks: Uint8Array[] = []; let length = 0
    const reader = response.body.getReader()
    try {
      while (true) {
        const part = await reader.read(); if (part.done) break
        length += part.value.byteLength
        if (length > access.byteLength || length > CREATOR_ARTIFACT_IMAGE_MAX_BYTES) { await reader.cancel(); return undefined }
        chunks.push(part.value)
      }
    } finally { reader.releaseLock() }
    if (length !== access.byteLength || Date.parse(access.expiresAt) <= Date.now() || signal.aborted) return undefined
    const bytes = new Uint8Array(length); let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    if (createHash('sha256').update(bytes).digest('hex') !== access.contentDigest) return undefined
    return { bytes, mediaType: mediaType as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' }
  } catch { return undefined }
}
