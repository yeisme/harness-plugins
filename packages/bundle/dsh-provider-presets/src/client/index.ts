/**
 * @yeisme/dsh-provider-presets bundle client face。
 *
 * 直接 re-export Client 包的 probe-gated apply：缺 `settings.models.footer`
 * slot 或 `remote.settings/credentials/llm` 任一子命名空间（0.1.2-rc.1 起）
 * 时零注册（诚实降级），面齐备时在 Models 设置页 footer 注册「渠道市场」。
 *
 * @module @yeisme/dsh-provider-presets/client
 */

export { apply, inject, name } from '@yeisme/dsh-client-ui-provider-presets/client'
export { PROVIDER_PRESETS, presetCatalogViolations } from '@yeisme/dsh-client-ui-provider-presets/client'
