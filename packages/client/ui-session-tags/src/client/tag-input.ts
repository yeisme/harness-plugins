/**
 * 标签输入的 Client 侧镜像规则（ advisory only：Host 是权威校验者）。
 *
 * 与 Host `@yeisme/dsh-session-tags-host` 的 tags 模型逐条对应
 * （bundle 层 sync 测试钉住两侧对同一语料产出一致）：
 * NFKC → trim、大小写区分、首现去重、12×64bytes、控制字符拒绝。
 * 编辑器用它即时反馈非法输入，但保存仍以 Host 的 `tags-invalid` 为准。
 *
 * @module @yeisme/dsh-client-ui-session-tags/client/tag-input
 */

export const MAX_TAGS_PER_SESSION = 12
export const MAX_TAG_BYTES = 64

function isControlCodePoint(code: number): boolean {
  return (code >= 0x00 && code <= 0x1f) || code === 0x7f || (code >= 0x80 && code <= 0x9f)
}

export function tagUtf8Bytes(tag: string): number {
  return new TextEncoder().encode(tag).length
}

export function normalizeTagText(raw: string): string {
  return raw.normalize('NFKC').trim()
}

export type TagInvalidReason = 'empty' | 'control-character' | 'too-long'

export function validateNormalizedTag(tag: string): TagInvalidReason | undefined {
  if (tag === '') return 'empty'
  for (let i = 0; i < tag.length; i += 1) {
    if (isControlCodePoint(tag.charCodeAt(i))) return 'control-character'
  }
  if (tagUtf8Bytes(tag) > MAX_TAG_BYTES) return 'too-long'
  return undefined
}

export type NormalizeTagsResult =
  | { readonly ok: true; readonly tags: readonly string[] }
  | { readonly ok: false; readonly reasons: readonly (TagInvalidReason | 'too-many')[] }

export function normalizeTags(raw: readonly string[]): NormalizeTagsResult {
  const reasons = new Set<TagInvalidReason | 'too-many'>()
  const seen = new Set<string>()
  const tags: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') {
      reasons.add('empty')
      continue
    }
    const tag = normalizeTagText(item)
    const reason = validateNormalizedTag(tag)
    if (reason !== undefined) {
      reasons.add(reason)
      continue
    }
    if (seen.has(tag)) continue
    seen.add(tag)
    tags.push(tag)
  }
  if (tags.length > MAX_TAGS_PER_SESSION) reasons.add('too-many')
  if (reasons.size > 0) return { ok: false, reasons: [...reasons] }
  return { ok: true, tags: Object.freeze(tags) }
}
