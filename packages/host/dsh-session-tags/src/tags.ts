/**
 * V1 标签的最小字符串模型：纯函数，无 I/O。
 *
 * 规范化规则（proposal/design 冻结）：
 * - 每个标签先做 Unicode NFKC 规范化，再去除首尾空白（trim）；
 * - 大小写保持区分（`UI` 与 `ui` 是不同标签）；
 * - 同一 Session 内重复标签去重，保留首次出现顺序；
 * - 单 Session 最多 12 个标签；单标签最多 64 UTF-8 bytes；
 * - 拒绝 NUL 与任何 C0/C1 控制字符，拒绝空标签。
 *
 * @module @yeisme/dsh-session-tags-host/tags
 */

/** 单 Session 允许的最大标签数。 */
export const MAX_TAGS_PER_SESSION = 12

/** 单标签允许的最大 UTF-8 字节数。 */
export const MAX_TAG_BYTES = 64

/**
 * 码位级控制字符判定：C0（U+0000–U+001F）、DEL（U+007F）、C1（U+0080–U+009F）。
 * 逐码位比较而不是正则，避免源文件与产物中出现真实控制字节。
 */
function isControlCodePoint(code: number): boolean {
  return (code >= 0x00 && code <= 0x1f) || code === 0x7f || (code >= 0x80 && code <= 0x9f)
}

/** 单个标签的 UTF-8 字节数（TextEncoder 输出长度）。 */
export function tagUtf8Bytes(tag: string): number {
  return new TextEncoder().encode(tag).length
}

/**
 * 规范化单个标签：NFKC → trim。
 * 返回空字符串表示输入在规范化后为空（非法）。
 */
export function normalizeTagText(raw: string): string {
  return raw.normalize('NFKC').trim()
}

/** 单标签校验失败原因（typed，供 `tags-invalid` 详情使用）。 */
export type TagInvalidReason =
  | 'empty'
  | 'control-character'
  | 'too-long'

/**
 * 校验一个已规范化的标签；合法返回 `undefined`，否则返回 typed 原因。
 */
export function validateNormalizedTag(tag: string): TagInvalidReason | undefined {
  if (tag === '') return 'empty'
  for (let i = 0; i < tag.length; i += 1) {
    if (isControlCodePoint(tag.charCodeAt(i))) return 'control-character'
  }
  if (tagUtf8Bytes(tag) > MAX_TAG_BYTES) return 'too-long'
  return undefined
}

/** 标签集合的校验结果。 */
export type NormalizeTagsResult =
  | { readonly ok: true; readonly tags: readonly string[] }
  | { readonly ok: false; readonly reasons: readonly (TagInvalidReason | 'too-many')[] }

/**
 * 规范化整份目标标签集合：逐个 NFKC+trim、校验、去重（保留首次顺序）。
 *
 * 去重发生在规范化之后：`"ui"` 与 `" ui "` 折叠为同一标签时只保留首次出现。
 * 数量上限按“规范化去重后”的集合判定，与持久化行的形态一致。
 */
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

/** 逐元素比较两份已规范化的标签集合是否材料相同（顺序敏感）。 */
export function tagsMaterialEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false
  }
  return true
}
