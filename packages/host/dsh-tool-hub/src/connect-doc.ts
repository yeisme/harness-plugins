/**
 * `gateway_connect_doc.v1` read-only host projection (additive capability).
 *
 * The Gateway owner owns connect-doc truth; this reader only validates and
 * re-shapes what an approved binding already projects. Until the Gateway-side
 * projection lands (root tasks 6.4/G4), every read degrades honestly to
 * `connect-doc-unavailable` with a reason — never a fabricated doc.
 *
 * @module @yeisme/dsh-tool-hub-host/connect-doc
 */

import type { ToolHubConnectDocAnswerV1, ToolHubConnectDocOkV1, ToolHubConnectFaceV1 } from './wire.ts'

/** digest_sha256_16: exactly 16 lowercase hex characters. */
const DOC_DIGEST = /^[0-9a-f]{16}$/
const SAFE_FACE_TEXT = /^[A-Za-z0-9_.:-]{1,120}$/
const MAX_FACES = 64

/** Opaque source of the owner projection; shape is validated here, never trusted. */
export interface ToolHubConnectDocSource {
  read(): Promise<unknown | undefined>
}

function face(candidate: unknown): ToolHubConnectFaceV1 | undefined {
  if (typeof candidate !== 'object' || candidate === null) return undefined
  const source = candidate as { id?: unknown; publicName?: unknown; kind?: unknown; toolCount?: unknown }
  if (typeof source.id !== 'string' || !SAFE_FACE_TEXT.test(source.id)) return undefined
  if (typeof source.publicName !== 'string' || source.publicName.length === 0 || source.publicName.length > 120) return undefined
  if (typeof source.kind !== 'string' || !SAFE_FACE_TEXT.test(source.kind)) return undefined
  if (source.toolCount !== undefined && (typeof source.toolCount !== 'number' || !Number.isInteger(source.toolCount) || source.toolCount < 0)) return undefined
  return { id: source.id, publicName: source.publicName, kind: source.kind, ...(source.toolCount !== undefined ? { toolCount: source.toolCount } : {}) }
}

export function parseConnectDoc(raw: unknown): ToolHubConnectDocOkV1 | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const source = raw as { docDigest?: unknown; observedAt?: unknown; faces?: unknown }
  if (typeof source.docDigest !== 'string' || !DOC_DIGEST.test(source.docDigest)) return undefined
  if (typeof source.observedAt !== 'number' || !Number.isFinite(source.observedAt) || source.observedAt < 0) return undefined
  if (!Array.isArray(source.faces) || source.faces.length > MAX_FACES) return undefined
  const faces: ToolHubConnectFaceV1[] = []
  for (const entry of source.faces) {
    const parsed = face(entry)
    if (parsed === undefined) return undefined
    faces.push(parsed)
  }
  return { ok: true, docDigest: source.docDigest, observedAt: source.observedAt, faces }
}

const UNAVAILABLE_NO_SOURCE = 'gateway_connect_doc.v1 is not projected by any approved binding (Gateway owner change pending)'

/** Fail-closed reader: any missing source, transport error, or invalid shape degrades with a reason. */
export class ToolHubConnectDocReader {
  private readonly source: ToolHubConnectDocSource | undefined

  constructor(source?: ToolHubConnectDocSource) {
    this.source = source
  }

  async read(): Promise<ToolHubConnectDocAnswerV1> {
    if (this.source === undefined) return { ok: false, code: 'connect-doc-unavailable', message: UNAVAILABLE_NO_SOURCE }
    let raw: unknown
    try {
      raw = await this.source.read()
    } catch {
      return { ok: false, code: 'connect-doc-unavailable', message: 'connect doc projection transport failed' }
    }
    if (raw === undefined) return { ok: false, code: 'connect-doc-unavailable', message: UNAVAILABLE_NO_SOURCE }
    const parsed = parseConnectDoc(raw)
    if (parsed === undefined) return { ok: false, code: 'connect-doc-unavailable', message: 'connect doc projection failed validation' }
    return parsed
  }
}

export function createConnectDocReader(source?: ToolHubConnectDocSource): ToolHubConnectDocReader {
  return new ToolHubConnectDocReader(source)
}
