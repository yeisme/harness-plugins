/** 旧叶包在兼容窗口内使用的无敏感弃用诊断。 */

type RootCarrier = { readonly root: object }

const LEGACY_WARNING_ROOTS = Symbol.for('yeisme.dsh-ordo-agent-ops.legacy-warning-roots.v1')

function warningRoots(): WeakMap<object, Set<string>> {
  const globalStore = globalThis as typeof globalThis & Record<symbol, unknown>
  const existing = globalStore[LEGACY_WARNING_ROOTS]
  if (existing instanceof WeakMap) return existing as WeakMap<object, Set<string>>
  const created = new WeakMap<object, Set<string>>()
  globalStore[LEGACY_WARNING_ROOTS] = created
  return created
}

/** 每个 runtime、每个旧 package 只提示一次，且不记录用户数据或 Host 细节。 */
export function warnLegacyPackage(ctx: RootCarrier, legacyPackage: string): void {
  const roots = warningRoots()
  const warned = roots.get(ctx.root) ?? new Set<string>()
  if (warned.has(legacyPackage)) return
  warned.add(legacyPackage)
  roots.set(ctx.root, warned)
  console.warn(`[DEPRECATED] ${legacyPackage} is a compatibility shim in 0.1.0-rc.7; migrate to @yeisme/dsh-ordo-agent-ops before 0.1.0-rc.8.`)
}
