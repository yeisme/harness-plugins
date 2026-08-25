/**
 * Local preview renderer registry (V3 3.2). Resolution is deterministic:
 * valid Open With preference, then exact MIME type, then structured suffix
 * (`type/*`), then family, then the `binary` fallback family. Heavy
 * renderers register a lazy loader; nothing static ever imports them.
 *
 * @module @yeisme/dsh-rich-media/preview
 */

import type {
  PreviewFamily,
  PreviewRendererDescriptorV1,
} from './types.ts'

export interface PreviewResolveInput {
  mediaType: string
  family: PreviewFamily
  /** User-chosen Open With preference; ignored when it does not accept the resource. */
  preference?: string | undefined
}

function mediaTypeSuffix(mediaType: string): string {
  const slash = mediaType.indexOf('/')
  return slash <= 0 ? mediaType : `${mediaType.slice(0, slash)}/*`
}

function accepts(descriptor: PreviewRendererDescriptorV1, mediaType: string, family: PreviewFamily): boolean {
  if (descriptor.families.includes(family)) return true
  const exact = descriptor.mediaTypes?.includes(mediaType.toLowerCase()) === true
  return exact && descriptor.families.includes('binary') ? true : exact
}

/** Registry of preview renderer descriptors with deterministic resolution. */
export class PreviewRendererRegistry {
  private readonly descriptors = new Map<string, PreviewRendererDescriptorV1>()

  /** Register one renderer; returns a disposer (HMR-safe). */
  register(descriptor: PreviewRendererDescriptorV1): () => void {
    if (typeof descriptor.id !== 'string' || descriptor.id.length === 0 || !descriptor.id.includes(':')) {
      throw new Error('preview renderer id must be a namespaced string like "pkg:kind"')
    }
    if (typeof descriptor.load !== 'function') throw new Error('preview renderer requires a lazy load()')
    if (!Array.isArray(descriptor.families) || descriptor.families.length === 0) {
      throw new Error('preview renderer must declare at least one family')
    }
    this.descriptors.set(descriptor.id, descriptor)
    let disposed = false
    return () => {
      if (disposed) return
      disposed = true
      if (this.descriptors.get(descriptor.id) === descriptor) this.descriptors.delete(descriptor.id)
    }
  }

  /** Deterministic resolution: preference → exact MIME → suffix → family → binary fallback. */
  resolve(input: PreviewResolveInput): PreviewRendererDescriptorV1 | undefined {
    const mediaType = input.mediaType.toLowerCase()
    const candidates = [...this.descriptors.values()]
    const byStage = (stage: (d: PreviewRendererDescriptorV1) => boolean): PreviewRendererDescriptorV1 | undefined => {
      const matching = candidates.filter(stage)
      if (matching.length === 0) return undefined
      return matching.sort((left, right) =>
        (right.priority ?? 0) - (left.priority ?? 0) || left.id.localeCompare(right.id))[0]
    }
    if (input.preference !== undefined) {
      const preferred = candidates.find(d => d.id === input.preference)
      if (preferred !== undefined && accepts(preferred, mediaType, input.family)) return preferred
    }
    const suffix = mediaTypeSuffix(mediaType)
    return byStage(d => d.mediaTypes?.includes(mediaType) === true)
      ?? byStage(d => d.mediaTypes?.includes(suffix) === true)
      ?? byStage(d => d.families.includes(input.family))
      ?? byStage(d => d.families.includes('binary'))
  }

  /** Open With listing: every renderer accepting the resource, deterministic order. */
  openWith(input: PreviewResolveInput): readonly PreviewRendererDescriptorV1[] {
    const mediaType = input.mediaType.toLowerCase()
    return [...this.descriptors.values()]
      .filter(d => accepts(d, mediaType, input.family))
      .sort((left, right) =>
        (right.priority ?? 0) - (left.priority ?? 0) || left.id.localeCompare(right.id))
  }

  has(id: string): boolean { return this.descriptors.has(id) }
  size(): number { return this.descriptors.size }

  /**
   * Load the resolved renderer. A failed lazy import may fall back only to the
   * next compatible descriptor; it never MIME-probes by execution.
   */
  async loadBest(input: PreviewResolveInput): Promise<PreviewRendererDescriptorV1 | undefined> {
    const failed = new Set<string>()
    while (true) {
      const next = this.resolveExcluding(input, failed)
      if (next === undefined) return undefined
      try {
        await next.load()
        return next
      } catch {
        failed.add(next.id)
      }
    }
  }

  private resolveExcluding(input: PreviewResolveInput, failed: ReadonlySet<string>): PreviewRendererDescriptorV1 | undefined {
    if (input.preference !== undefined && !failed.has(input.preference)) {
      const preferred = this.resolve(input)
      if (preferred !== undefined && preferred.id === input.preference) return preferred
    }
    const remaining = new PreviewRendererRegistry()
    for (const descriptor of this.descriptors.values()) {
      if (!failed.has(descriptor.id)) remaining.register(descriptor)
    }
    return remaining.resolve({ ...input, preference: undefined })
  }
}
