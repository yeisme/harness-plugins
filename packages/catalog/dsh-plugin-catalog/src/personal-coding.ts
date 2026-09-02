import type { CatalogBundleEntry, PluginCatalog } from './schema.js'

export type PersonalCodingPackResolutionV1 =
  | { readonly ok: true; readonly bundles: readonly CatalogBundleEntry[] }
  | { readonly ok: false; readonly code: 'pack.unknown' | 'pack.uninstallable' | 'pack.missing_dependency'; readonly packId: string; readonly availableIds: readonly string[] }

export function listPersonalCodingPacks(catalog: PluginCatalog): readonly CatalogBundleEntry[] {
  return catalog.bundles
    .filter(entry => entry.personalCoding !== undefined)
    .sort((left, right) => (left.personalCoding?.tier === right.personalCoding?.tier
      ? (left.personalCoding?.packId ?? '').localeCompare(right.personalCoding?.packId ?? '')
      : left.personalCoding?.tier === 'base' ? -1 : 1))
}

/** 解析 base + 显式 packs；未知/不可安装/依赖缺失均零部分结果。 */
export function resolvePersonalCodingPacks(catalog: PluginCatalog, requestedPackIds: readonly string[]): PersonalCodingPackResolutionV1 {
  const packs = listPersonalCodingPacks(catalog)
  const availableIds = packs.filter(entry => entry.installable).map(entry => entry.personalCoding?.packId ?? entry.id)
  const base = packs.find(entry => entry.personalCoding?.tier === 'base')
  const requested = [...new Set(requestedPackIds)]
  const selected: CatalogBundleEntry[] = []
  if (base !== undefined) selected.push(base)
  for (const packId of requested) {
    const entry = packs.find(candidate => candidate.personalCoding?.packId === packId)
    if (entry === undefined) return { ok: false, code: 'pack.unknown', packId, availableIds }
    if (!entry.installable) return { ok: false, code: 'pack.uninstallable', packId, availableIds }
    selected.push(entry)
  }
  for (const entry of selected) {
    if (!entry.installable) return { ok: false, code: 'pack.uninstallable', packId: entry.personalCoding?.packId ?? entry.id, availableIds }
    for (const dependency of entry.personalCoding?.dependencies ?? []) {
      if (!selected.some(candidate => candidate.personalCoding?.packId === dependency)) {
        return { ok: false, code: 'pack.missing_dependency', packId: entry.personalCoding?.packId ?? entry.id, availableIds }
      }
    }
  }
  return { ok: true, bundles: [...new Map(selected.map(entry => [entry.id, entry])).values()] }
}
