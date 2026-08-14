/** Read-only grammar and reference validation owned by the `/ordo` command. */

/** A reference accepted by the command's narrow, non-URL grammar. */
export type SafeOrdoRef = string & { readonly __safeOrdoRef: unique symbol }

/** Parsed `/ordo` request before it reads any owner projection. */
export type OrdoCommand =
  | { readonly kind: 'overview' }
  | { readonly kind: 'help' }
  | { readonly kind: 'status'; readonly ref?: SafeOrdoRef }
  | { readonly kind: 'preview'; readonly ref: SafeOrdoRef }
  | { readonly kind: 'capacity' }
  | { readonly kind: 'invalid'; readonly error: 'unknown' | 'missing-ref' | 'extra-arguments' | 'unsafe-ref' }

const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/u

/**
 * Accept one opaque reference only when it cannot be interpreted as a path, URL, or omitted token.
 * @param value - one whitespace-delimited argument.
 * @returns a branded reference, or `undefined` when the input is unsafe.
 */
export function parseSafeOrdoRef(value: string): SafeOrdoRef | undefined {
  if (!SAFE_REF.test(value)) return undefined
  if (value.toLowerCase() === 'undefined') return undefined
  return value as SafeOrdoRef
}

/**
 * Parse the complete text after `/ordo` without accepting any action grammar.
 * @param rawInput - verbatim command input from `dsh-commands`.
 * @returns a read-only request or a precise syntax failure.
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
