/**
 * Optional official Settings/Page adapter. Plugins must not reach a private
 * router, DOM selector, or overlay inject to simulate a settings page.
 */
export const PANE_WORKSPACE_SETTINGS_PAGE_ADAPTER = 'PaneWorkspaceSettingsPageAdapterV1' as const

export interface PaneWorkspaceSettingsPageAdapterV1 {
  readonly version: typeof PANE_WORKSPACE_SETTINGS_PAGE_ADAPTER
  readonly open?: (draftId?: string) => void
  readonly close?: () => void
}

export interface PaneWorkspaceSettingsPageProbeV1 {
  readonly available: boolean
  readonly reason: string
}

export function isPaneWorkspaceSettingsPageAdapter(value: unknown): value is PaneWorkspaceSettingsPageAdapterV1 {
  if (value === null || typeof value !== 'object') return false
  const candidate = value as Partial<PaneWorkspaceSettingsPageAdapterV1>
  if (candidate.version !== PANE_WORKSPACE_SETTINGS_PAGE_ADAPTER) return false
  if (candidate.open !== undefined && typeof candidate.open !== 'function') return false
  if (candidate.close !== undefined && typeof candidate.close !== 'function') return false
  return true
}

export function probeWorkspaceSettingsPageAdapter(adapter: unknown): PaneWorkspaceSettingsPageProbeV1 {
  if (adapter === undefined) {
    return { available: false, reason: 'settings page adapter is absent; Core View remains the delivery path' }
  }
  if (!isPaneWorkspaceSettingsPageAdapter(adapter)) {
    return { available: false, reason: 'settings page adapter contract mismatch' }
  }
  return { available: true, reason: 'official settings page adapter is available' }
}

export function openWorkspaceDesignerDelivery(
  openCoreView: () => void,
  adapter?: unknown,
): { readonly path: 'core-view' | 'settings-page'; readonly probe: PaneWorkspaceSettingsPageProbeV1 } {
  const probe = probeWorkspaceSettingsPageAdapter(adapter)
  if (probe.available && isPaneWorkspaceSettingsPageAdapter(adapter) && typeof adapter.open === 'function') {
    adapter.open()
    return { path: 'settings-page', probe }
  }
  openCoreView()
  return { path: 'core-view', probe }
}
