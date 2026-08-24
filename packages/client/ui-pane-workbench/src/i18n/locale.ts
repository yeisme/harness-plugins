/**
 * Pane Workbench Locale System
 *
 * V4 i18n foundation for DSH Pane Workspace.
 * Provides locale namespace `paneWorkbench` with zh/en support,
 * DSH LocaleRuntime integration, and safe fallback chains.
 *
 * Locale priority: active locale → language base → English → descriptor fallback
 * Locale hot-switch only updates presentation; never changes layout ids, Tab order,
 * selection, or draft state.
 */

// Locale type definitions
export type Locale = 'zh' | 'en' | 'pseudo-long' | 'pseudo-rtl'

// Locale base mapping (for fallback chains)
const LOCALE_BASES: Record<string, string> = {
  zh: 'zh',
  'zh-CN': 'zh',
  'zh-TW': 'zh',
  en: 'en',
  'en-US': 'en',
  'en-GB': 'en',
  'pseudo-long': 'en',
  'pseudo-rtl': 'en',
}

/**
 * Extracts locale base from full locale string (e.g., 'zh-CN' → 'zh')
 */
export function getLocaleBase(locale: string): string {
  return LOCALE_BASES[locale] ?? locale.split('-')[0]
}

/**
 * Determines if a locale is RTL (Right-to-Left)
 * V4 uses pseudo-RTL for layout testing; real RTL support requires dedicated copy/QA evidence.
 */
export function isRTL(locale: string): boolean {
  return locale === 'pseudo-rtl' || locale.startsWith('ar') || locale.startsWith('he')
}

/**
 * Locale resource bundle type
 */
export interface LocaleBundle {
  locale: Locale
  resources: Record<string, string>
  // plurals: Record<string, (n: number) => string>  // Future: plural rules
}

// English base bundle (fallback default)
const EN_BUNDLE: LocaleBundle = {
  locale: 'en',
  resources: {
    // Activity Rail
    'rail.explorer': 'Explorer',
    'rail.sourceControl': 'Source Control',
    'rail.terminal': 'Terminal',
    'rail.agents': 'Agents',
    'rail.customize': 'Customize Workspace',

    // View Picker
    'picker.title': 'Open View',
    'picker.search.placeholder': 'Search views...',
    'picker.group.open': 'Open',
    'picker.group.available': 'Available',

    // Tab states
    'tab.preview': 'Preview',
    'tab.dirty': 'Unsaved changes',
    'tab.attention': 'Needs attention',
    'tab.offline': 'Offline',
    'tab.orphaned': 'Unavailable',
    'tab.conflict': 'Conflict',
    'tab.close': 'Close',
    'tab.closeOthers': 'Close Others',
    'tab.closeRight': 'Close to Right',
    'tab.closeUnpinned': 'Close Unpinned',
    'tab.closeGroup': 'Close All in Group',
    'tab.pin': 'Pin',
    'tab.unpin': 'Unpin',
    'tab.moreTabs': 'More Tabs',

    // Group controls
    'group.split': 'Split',
    'group.move': 'Move to',
    'group.maximize': 'Maximize',
    'group.restore': 'Restore',
    'group.closeGroup': 'Close Group',

    // Drag and drop
    'drag.unavailable': 'Drop unavailable',
    'drag.invalidRegion': 'Cannot drop here',
    'drag.layoutUpdated': 'Layout updated',
    'drag.tabMoved': 'Tab moved',

    // Loading/Empty/Error states
    'state.loading': 'Loading...',
    'state.empty': 'No views open',
    'state.error': 'Error loading view',
    'state.retry': 'Retry',
    'state.offline': 'Offline',
    'state.stale': 'Content may be stale',
    'state.conflict': 'Conflict detected',
    'state.permission': 'Permission denied',
    'state.unsupported': 'Not supported',

    // Explorer
    'explorer.root': 'Workspace',
    'explorer.newFile': 'New File',
    'explorer.newFolder': 'New Folder',
    'explorer.openFile': 'Open File',
    'explorer.collapseAll': 'Collapse All',
    'explorer.refresh': 'Refresh',

    // Source Control
    'git.repository': 'Repository',
    'git.branch': 'Branch',
    'git.commit': 'Commit',
    'git.changes': 'Changes',
    'git.staged': 'Staged Changes',
    'git.untracked': 'Untracked',
    'git.merge': 'Merge Changes',
    'git.commitMessage': 'Commit message',
    'git.stage': 'Stage',
    'git.unstage': 'Unstage',
    'git.discard': 'Discard',
    'git.push': 'Push',
    'git.pull': 'Pull',
    'git.clean': 'Working tree clean',

    // Workspace Designer
    'designer.title': 'Workspace Designer',
    'designer.scope.session': 'Session',
    'designer.scope.workspace': 'Workspace',
    'designer.scope.profile': 'Profile',
    'designer.apply': 'Apply',
    'designer.discard': 'Discard',
    'designer.saveAs': 'Save As Preset',
    'designer.undo': 'Undo',
    'designer.redo': 'Redo',
    'designer.rebase': 'Rebase Draft',
    'designer.validation.errors': 'errors',
    'designer.validation.warnings': 'warnings',
    'designer.validation.applyWarning': 'Apply changes will move {count} views',

    // Accessibility
    'a11y.region': 'Region',
    'a11y.group': 'Group',
    'a11y.tabList': 'Tabs',
    'a11y.tab': 'Tab',
    'a11y.activeTab': 'Active tab',
    'a11y.closeTab': 'Close tab',
    'a11y.dragHandle': 'Drag to move',
  }
}

// Chinese bundle
const ZH_BUNDLE: LocaleBundle = {
  locale: 'zh',
  resources: {
    // Activity Rail
    'rail.explorer': '资源管理器',
    'rail.sourceControl': '源代码管理',
    'rail.terminal': '终端',
    'rail.agents': '代理',
    'rail.customize': '自定义工作区',

    // View Picker
    'picker.title': '打开视图',
    'picker.search.placeholder': '搜索视图...',
    'picker.group.open': '已打开',
    'picker.group.available': '可用',

    // Tab states
    'tab.preview': '预览',
    'tab.dirty': '未保存的更改',
    'tab.attention': '需要关注',
    'tab.offline': '离线',
    'tab.orphaned': '不可用',
    'tab.conflict': '冲突',
    'tab.close': '关闭',
    'tab.closeOthers': '关闭其他',
    'tab.closeRight': '关闭右侧',
    'tab.closeUnpinned': '关闭未固定',
    'tab.closeGroup': '关闭组内全部',
    'tab.pin': '固定',
    'tab.unpin': '取消固定',
    'tab.moreTabs': '更多标签页',

    // Group controls
    'group.split': '拆分',
    'group.move': '移动到',
    'group.maximize': '最大化',
    'group.restore': '还原',
    'group.closeGroup': '关闭组',

    // Drag and drop
    'drag.unavailable': '不可放置',
    'drag.invalidRegion': '无法放置在此处',
    'drag.layoutUpdated': '布局已更新',
    'drag.tabMoved': '标签页已移动',

    // Loading/Empty/Error states
    'state.loading': '加载中...',
    'state.empty': '无打开的视图',
    'state.error': '加载视图时出错',
    'state.retry': '重试',
    'state.offline': '离线',
    'state.stale': '内容可能已过期',
    'state.conflict': '检测到冲突',
    'state.permission': '权限被拒绝',
    'state.unsupported': '不支持',

    // Explorer
    'explorer.root': '工作区',
    'explorer.newFile': '新建文件',
    'explorer.newFolder': '新建文件夹',
    'explorer.openFile': '打开文件',
    'explorer.collapseAll': '全部折叠',
    'explorer.refresh': '刷新',

    // Source Control
    'git.repository': '仓库',
    'git.branch': '分支',
    'git.commit': '提交',
    'git.changes': '更改',
    'git.staged': '已暂存',
    'git.untracked': '未跟踪',
    'git.merge': '合并更改',
    'git.commitMessage': '提交消息',
    'git.stage': '暂存',
    'git.unstage': '取消暂存',
    'git.discard': '丢弃',
    'git.push': '推送',
    'git.pull': '拉取',
    'git.clean': '工作区干净',

    // Workspace Designer
    'designer.title': '工作区设计器',
    'designer.scope.session': '会话',
    'designer.scope.workspace': '工作区',
    'designer.scope.profile': '配置文件',
    'designer.apply': '应用',
    'designer.discard': '放弃',
    'designer.saveAs': '另存为预设',
    'designer.undo': '撤销',
    'designer.redo': '重做',
    'designer.rebase': '变基草稿',
    'designer.validation.errors': '错误',
    'designer.validation.warnings': '警告',
    'designer.validation.applyWarning': '应用更改将移动 {count} 个视图',

    // Accessibility
    'a11y.region': '区域',
    'a11y.group': '组',
    'a11y.tabList': '标签页列表',
    'a11y.tab': '标签页',
    'a11y.activeTab': '当前标签页',
    'a11y.closeTab': '关闭标签页',
    'a11y.dragHandle': '拖动以移动',
  }
}

// Pseudo-long bundle for text expansion testing (~200% expansion)
const PSEUDO_LONG_BUNDLE: LocaleBundle = {
  locale: 'pseudo-long',
  resources: Object.fromEntries(
    Object.entries(EN_BUNDLE.resources).map(([key, value]) => [
      key,
      `${value} ${value}`  // Duplicate text for ~200% expansion
    ])
  )
}

// Locale bundle registry
const LOCALE_BUNDLES: Record<Locale, LocaleBundle> = {
  en: EN_BUNDLE,
  zh: ZH_BUNDLE,
  'pseudo-long': PSEUDO_LONG_BUNDLE,
  'pseudo-rtl': EN_BUNDLE,  // Reuse English with RTL layout
}

/**
 * Current active locale (default: English)
 * In production, this would be synchronized with DSH LocaleRuntime
 */
let activeLocale: Locale = 'en'

/**
 * Gets the current active locale
 */
export function getActiveLocale(): Locale {
  return activeLocale
}

/**
 * Sets the active locale (hot-switch support)
 * Only updates presentation; never changes layout ids, Tab order, selection, or draft.
 */
export function setActiveLocale(locale: Locale): void {
  const baseLocale = getLocaleBase(locale) as Locale
  if (LOCALE_BUNDLES[baseLocale] !== undefined) {
    activeLocale = baseLocale
  }
}

/**
 * Gets a translated string for the given key
 * Fallback chain: active locale → language base → English → key itself
 */
export function t(key: string, options?: { count?: number }): string {
  const bundle = LOCALE_BUNDLES[activeLocale] ?? EN_BUNDLE
  const fallbackBundle = LOCALE_BUNDLES['en'] ?? EN_BUNDLE

  let result = bundle.resources[key] ?? fallbackBundle.resources[key] ?? key

  // Handle simple pluralization (future: proper plural rules per locale)
  if (options?.count !== undefined) {
    const pluralKey = `${key}.${options.count === 1 ? 'one' : 'other'}`
    result = bundle.resources[pluralKey] ?? fallbackBundle.resources[pluralKey] ?? result
  }

  return result
}

/**
 * Formats a localized string with parameters
 * Simple placeholder replacement: {key} with {param}
 */
export function formatT(key: string, params: Record<string, string | number>): string {
  let result = t(key)
  for (const [param, value] of Object.entries(params)) {
    result = result.replace(`{${param}}`, String(value))
  }
  return result
}

/**
 * Safe fallback formatter for missing translations
 * Returns the descriptor label when locale resources are unavailable
 */
export function tWithFallback(localeKey: string | undefined, descriptorLabel: string): string {
  if (localeKey) {
    const translated = t(localeKey)
    // If translation equals the key, it's missing - use descriptor fallback
    if (translated !== localeKey) {
      return translated
    }
  }
  return descriptorLabel
}

/**
 * Locale resource bundle for DSH LocaleRuntime integration
 * This will be registered with DSH when the capability is available
 */
export const PANE_WORKBENCH_LOCALE_RESOURCES = {
  namespace: 'paneWorkbench',
  version: '1.0.0',
  locales: Object.keys(LOCALE_BUNDLES),
  resources: LOCALE_BUNDLES,
}
