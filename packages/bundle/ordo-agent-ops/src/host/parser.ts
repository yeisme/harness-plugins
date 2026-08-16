/** `/ordo` 的只读语法与不透明 ref 校验。 */

/** 可由命令显示的窄范围不透明引用。 */
export type SafeOrdoRef = string & { readonly __safeOrdoRef: unique symbol }

/** 在读取任何 Owner 投影前得到的已解析命令。 */
export type OrdoCommand =
  | { readonly kind: 'overview' }
  | { readonly kind: 'help' }
  | { readonly kind: 'status'; readonly ref?: SafeOrdoRef }
  | { readonly kind: 'preview'; readonly ref: SafeOrdoRef }
  | { readonly kind: 'capacity' }
  | { readonly kind: 'invalid'; readonly error: 'unknown' | 'missing-ref' | 'extra-arguments' | 'unsafe-ref' }

const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/u

/**
 * 只接受不会被解释为路径、URL 或缺省 token 的单个引用。
 * @param value - 一个以空白分隔的参数。
 * @returns 安全引用；不安全时为 undefined。
 */
export function parseSafeOrdoRef(value: string): SafeOrdoRef | undefined {
  if (!SAFE_REF.test(value)) return undefined
  if (value.toLowerCase() === 'undefined') return undefined
  return value as SafeOrdoRef
}

/**
 * 解析 `/ordo` 后的完整文本；该 grammar 不接受任何写操作。
 * @param rawInput - dsh-commands 提供的原始输入。
 * @returns 只读请求或精确语法失败。
 */
export function parseOrdoCommand(rawInput: string): OrdoCommand {
  const tokens = rawInput.trim().split(/\s+/u)
  if (tokens[0] === '') return { kind: 'overview' }
  const command = tokens[0]?.toLowerCase()
  const argument = tokens[1]
  if (command === 'help') return tokens.length === 1 ? { kind: 'help' } : { kind: 'invalid', error: 'extra-arguments' }
  if (command === 'capacity') return tokens.length === 1 ? { kind: 'capacity' } : { kind: 'invalid', error: 'extra-arguments' }
  if (command === 'status') {
    if (tokens.length === 1) return { kind: 'status' }
    if (tokens.length > 2) return { kind: 'invalid', error: 'extra-arguments' }
    const ref = argument === undefined ? undefined : parseSafeOrdoRef(argument)
    return ref === undefined ? { kind: 'invalid', error: 'unsafe-ref' } : { kind: 'status', ref }
  }
  if (command === 'preview') {
    if (tokens.length === 1) return { kind: 'invalid', error: 'missing-ref' }
    if (tokens.length > 2) return { kind: 'invalid', error: 'extra-arguments' }
    const ref = argument === undefined ? undefined : parseSafeOrdoRef(argument)
    return ref === undefined ? { kind: 'invalid', error: 'unsafe-ref' } : { kind: 'preview', ref }
  }
  return { kind: 'invalid', error: 'unknown' }
}
