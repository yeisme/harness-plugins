/**
 * @yeisme/dsh-provider-presets bundle root（Host face）。
 *
 * 本插件没有 host 逻辑（全部读写经上游已暴露的 remote namespaces），host 半
 * 是空 apply——web 行只承载 client face 注册（dsh-pentest 的 web 行模式）。
 *
 * @module @yeisme/dsh-provider-presets
 */

import type { Context } from '@deepseek-ai/cordis'

export const name = 'dsh-provider-presets'
export const inject: readonly string[] = []

export function apply(_ctx: Context): void {
  // no-op host face: client 行（./client）承载渠道市场注册
}

const DshProviderPresetsPlugin = { name, inject, apply }
export default DshProviderPresetsPlugin
