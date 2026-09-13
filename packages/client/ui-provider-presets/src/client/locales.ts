/**
 * 渠道市场双语文案。zh 为主语言（用户 locale preference: zh），en 为完整回退。
 *
 * @module @yeisme/dsh-client-ui-provider-presets/client/locales
 */

/** 字典命名空间（全仓唯一）。 */
export const NS = 'provider.presets' as const

/** 文案键（`t(key, params?)` 的键空间）。 */
export interface ProviderPresetsKey {
  readonly 'section.title': '渠道市场'
  readonly 'section.description': '从预设渠道快速接入 API provider，或添加自定义 OpenAI 兼容端点。'
  readonly 'section.loading': '正在读取渠道目录…'
  readonly 'section.empty': '尚无已配置渠道；选择下方预设开始接入。'
  readonly 'section.error': '渠道目录读取失败'
  readonly 'section.retry': '重试'
  readonly 'overview.title': '已配置渠道'
  readonly 'overview.live': '在线'
  readonly 'overview.dormant': '未激活'
  readonly 'overview.default': '默认'
  readonly 'overview.setDefault': '设为默认'
  readonly 'overview.setDefaultBusy': '写入中…'
  readonly 'overview.keyConfigured': '密钥已配置'
  readonly 'overview.keyMissing': '密钥未配置'
  readonly 'overview.noModels': '该渠道无可用模型'
  readonly 'preset.add': '添加'
  readonly 'preset.custom': '自定义'
  readonly 'dialog.title': '添加渠道'
  readonly 'dialog.field.displayName': '显示名称'
  readonly 'dialog.field.route': 'Route key（llm-pi-ai.providers 字典键）'
  readonly 'dialog.field.protocol': '协议'
  readonly 'dialog.field.baseURL': 'Base URL'
  readonly 'dialog.field.credentialRef': '凭证引用名（API key 的环境变量名）'
  readonly 'dialog.field.apiKey': 'API Key'
  readonly 'dialog.field.apiKeyHint': '明文只进 host 凭证存储，浏览器不留存。'
  readonly 'dialog.models.title': '模型'
  readonly 'dialog.models.fetch': '拉取模型'
  readonly 'dialog.models.refetch': '重新拉取'
  readonly 'dialog.models.fetching': '拉取中…'
  readonly 'dialog.models.fetched': '已拉取 {count} 个模型（{ms}ms）'
  readonly 'dialog.models.empty': '端点未返回模型；可手填或检查 Base URL。'
  readonly 'dialog.models.unlistable': '该协议无自动模型列表；已填入预设种子模型，可增改。'
  readonly 'dialog.models.capacityMissing': '容量未披露，按渠道默认'
  readonly 'dialog.models.manualAdd': '手填模型 id，回车添加'
  readonly 'dialog.models.noneSelected': '至少勾选一个模型'
  readonly 'dialog.setDefault': '保存后设为默认'
  readonly 'dialog.setDefaultModel': '默认模型'
  readonly 'dialog.save': '保存渠道'
  readonly 'dialog.saving': '保存中…'
  readonly 'dialog.cancel': '取消'
  readonly 'dialog.close': '关闭'
  readonly 'dialog.saved': '已保存渠道「{name}」（route: {route}）'
  readonly 'dialog.savedDefault': '已设为默认模型'
  readonly 'error.routeConflict': 'route key「{route}」已存在；请改名。'
  readonly 'error.routeInvalid': 'route key 需为非空小写 kebab-case。'
  readonly 'error.refInvalid': '凭证引用名需为 POSIX 环境变量名（大写字母/数字/下划线）。'
  readonly 'error.baseURLRequired': '请填写 Base URL。'
  readonly 'error.keyRequired': '请填写 API Key（拉取与保存都需要）。'
  readonly 'error.fetchFailed': '拉取失败'
  readonly 'error.saveFailed': '保存失败'
  readonly 'error.conflict': '设置已被其他修改更新；正在重读目录，请重试保存。'
  readonly 'error.credentialFailed': '密钥写入失败'
}

/** 英文字典（宿主未提供 zh 时回退）。 */
export const en: Readonly<Record<keyof ProviderPresetsKey, string>> = {
  'section.title': 'Provider presets',
  'section.description': 'Add an API provider from a preset channel, or register a custom OpenAI-compatible endpoint.',
  'section.loading': 'Reading provider directory…',
  'section.empty': 'No configured providers yet; pick a preset below to get started.',
  'section.error': 'Failed to read the provider directory',
  'section.retry': 'Retry',
  'overview.title': 'Configured providers',
  'overview.live': 'live',
  'overview.dormant': 'dormant',
  'overview.default': 'default',
  'overview.setDefault': 'Set as default',
  'overview.setDefaultBusy': 'Writing…',
  'overview.keyConfigured': 'key configured',
  'overview.keyMissing': 'key missing',
  'overview.noModels': 'no models on this route',
  'preset.add': 'Add',
  'preset.custom': 'Custom',
  'dialog.title': 'Add provider',
  'dialog.field.displayName': 'Display name',
  'dialog.field.route': 'Route key (llm-pi-ai.providers dict key)',
  'dialog.field.protocol': 'Protocol',
  'dialog.field.baseURL': 'Base URL',
  'dialog.field.credentialRef': 'Credential ref (env name for the API key)',
  'dialog.field.apiKey': 'API Key',
  'dialog.field.apiKeyHint': 'The plaintext goes to the host credential store only; the browser keeps nothing.',
  'dialog.models.title': 'Models',
  'dialog.models.fetch': 'Fetch models',
  'dialog.models.refetch': 'Refetch',
  'dialog.models.fetching': 'Fetching…',
  'dialog.models.fetched': 'Fetched {count} models ({ms}ms)',
  'dialog.models.empty': 'The endpoint returned no models; add by hand or check the Base URL.',
  'dialog.models.unlistable': 'This protocol has no auto listing; preset seed models are filled in and editable.',
  'dialog.models.capacityMissing': 'capacities not disclosed; route defaults apply',
  'dialog.models.manualAdd': 'Type a model id and press Enter to add',
  'dialog.models.noneSelected': 'Select at least one model',
  'dialog.setDefault': 'Set as default after saving',
  'dialog.setDefaultModel': 'Default model',
  'dialog.save': 'Save provider',
  'dialog.saving': 'Saving…',
  'dialog.cancel': 'Cancel',
  'dialog.close': 'Close',
  'dialog.saved': 'Saved provider "{name}" (route: {route})',
  'dialog.savedDefault': 'Set as the default model',
  'error.routeConflict': 'Route key "{route}" already exists; pick another name.',
  'error.routeInvalid': 'Route key must be non-empty lowercase kebab-case.',
  'error.refInvalid': 'Credential ref must be a POSIX env name (uppercase/digits/underscore).',
  'error.baseURLRequired': 'Base URL is required.',
  'error.keyRequired': 'API key is required for fetch and save.',
  'error.fetchFailed': 'Fetch failed',
  'error.saveFailed': 'Save failed',
  'error.conflict': 'Settings changed elsewhere; the directory is being reloaded — retry the save.',
  'error.credentialFailed': 'Failed to store the API key',
}

/** 中文字典。 */
export const zh: Readonly<Record<keyof ProviderPresetsKey, string>> = {
  'section.title': '渠道市场',
  'section.description': '从预设渠道快速接入 API provider，或添加自定义 OpenAI 兼容端点。',
  'section.loading': '正在读取渠道目录…',
  'section.empty': '尚无已配置渠道；选择下方预设开始接入。',
  'section.error': '渠道目录读取失败',
  'section.retry': '重试',
  'overview.title': '已配置渠道',
  'overview.live': '在线',
  'overview.dormant': '未激活',
  'overview.default': '默认',
  'overview.setDefault': '设为默认',
  'overview.setDefaultBusy': '写入中…',
  'overview.keyConfigured': '密钥已配置',
  'overview.keyMissing': '密钥未配置',
  'overview.noModels': '该渠道无可用模型',
  'preset.add': '添加',
  'preset.custom': '自定义',
  'dialog.title': '添加渠道',
  'dialog.field.displayName': '显示名称',
  'dialog.field.route': 'Route key（llm-pi-ai.providers 字典键）',
  'dialog.field.protocol': '协议',
  'dialog.field.baseURL': 'Base URL',
  'dialog.field.credentialRef': '凭证引用名（API key 的环境变量名）',
  'dialog.field.apiKey': 'API Key',
  'dialog.field.apiKeyHint': '明文只进 host 凭证存储，浏览器不留存。',
  'dialog.models.title': '模型',
  'dialog.models.fetch': '拉取模型',
  'dialog.models.refetch': '重新拉取',
  'dialog.models.fetching': '拉取中…',
  'dialog.models.fetched': '已拉取 {count} 个模型（{ms}ms）',
  'dialog.models.empty': '端点未返回模型；可手填或检查 Base URL。',
  'dialog.models.unlistable': '该协议无自动模型列表；已填入预设种子模型，可增改。',
  'dialog.models.capacityMissing': '容量未披露，按渠道默认',
  'dialog.models.manualAdd': '手填模型 id，回车添加',
  'dialog.models.noneSelected': '至少勾选一个模型',
  'dialog.setDefault': '保存后设为默认',
  'dialog.setDefaultModel': '默认模型',
  'dialog.save': '保存渠道',
  'dialog.saving': '保存中…',
  'dialog.cancel': '取消',
  'dialog.close': '关闭',
  'dialog.saved': '已保存渠道「{name}」（route: {route}）',
  'dialog.savedDefault': '已设为默认模型',
  'error.routeConflict': 'route key「{route}」已存在；请改名。',
  'error.routeInvalid': 'route key 需为非空小写 kebab-case。',
  'error.refInvalid': '凭证引用名需为 POSIX 环境变量名（大写字母/数字/下划线）。',
  'error.baseURLRequired': '请填写 Base URL。',
  'error.keyRequired': '请填写 API Key（拉取与保存都需要）。',
  'error.fetchFailed': '拉取失败',
  'error.saveFailed': '保存失败',
  'error.conflict': '设置已被其他修改更新；正在重读目录，请重试保存。',
  'error.credentialFailed': '密钥写入失败',
}

/** `{param}` 插值。 */
export function interpolate(template: string, params: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => String(params[key] ?? match))
}
