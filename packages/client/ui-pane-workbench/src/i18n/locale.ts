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
  'pseudo-long': 'pseudo-long',
  'pseudo-rtl': 'pseudo-rtl',
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
    'picker.search.placeholder': 'Search views…',
    'picker.group.open': 'Open',
    'picker.group.available': 'Available',
    'management.title': 'Pane Center',
    'management.openMode': 'Open Pane',
    'management.manageMode': 'Manage Tabs',
    'management.manageTabs': 'Manage tabs',
    'management.search.placeholder': 'Search panes, tabs, titles, or history',
    'management.includeConversation': 'Include conversation content',
    'management.conversationUnavailable': 'Conversation search is unavailable in this host.',
    'management.currentScope': 'Current scope: {scope}',
    'management.scope.workspace': 'workspace',
    'management.scope.session': 'session',
    'management.group.favorites': 'Favorites',
    'management.group.recent': 'Recent',
    'management.group.development': 'Development',
    'management.group.agents': 'Agents',
    'management.group.creator': 'Creation',
    'management.group.knowledge': 'Knowledge',
    'management.group.system': 'System',
    'management.group.other': 'Other',
    'management.group.history': 'Closed history',
    'management.createGroup': 'Create group',
    'management.customGroups': 'Custom groups',
    'management.pinGroup': 'Pin or unpin group',
    'management.moveGroupUp': 'Move group up',
    'management.moveGroupDown': 'Move group down',
    'management.deleteGroup': 'Delete group',
    'management.groupName': 'Group name',
    'management.favorite': 'Favorite',
    'management.unfavorite': 'Remove favorite',
    'management.closeSelected': 'Close selected safely',
    'management.pinSelected': 'Pin selected',
    'management.unpinSelected': 'Unpin selected',
    'management.moveSelected': 'Move selected',
    'management.closeUnpinned': 'Close unpinned safely',
    'management.restore': 'Restore',
    'management.restoreLast': 'Restore last closed',
    'management.undo': 'Undo',
    'management.closedCount': '{count} tabs closed',
    'management.protectedCount': '{count} tabs need review',
    'management.protectedTitle': 'Protected tabs',
    'management.confirmClose': 'Close anyway',
    'management.protectedReason.dirty': 'Unsaved changes',
    'management.protectedReason.running': 'Work is running',
    'management.protectedReason.terminal': 'Terminal cannot be resumed',
    'management.protectedReason.confirm': 'Owner confirmation required',
    'management.protectedReason.deny': 'Owner prevents closing',
    'management.protectedReason.unknown': 'State is unavailable',
    'management.noResults': 'No matching panes or tabs.',
    'management.filters': 'Advanced filters',
    'management.filter.group': 'All groups',
    'management.filter.region': 'Right / Bottom',
    'management.filter.owner': 'All owners',
    'management.filter.type': 'All types',
    'management.filter.status': 'All states',
    'management.filter.pinned': 'Pinned state',
    'management.filter.onlyPinned': 'Pinned only',
    'management.filter.onlyUnpinned': 'Unpinned only',
    'management.filter.workspace': 'Workspace scope',
    'management.filter.currentWorkspace': 'Current workspace',
    'management.filter.allWorkspaces': 'All authorized workspaces',
    'management.loadMore': 'Load more',
    'management.target': 'Open target',
    'management.targetCurrent': 'Smart placement',
    'management.source.pane': 'Available panes',
    'management.source.tab': 'Open tabs',
    'management.source.history': 'Closed history',
    'management.details': 'Pane details',
    'management.details.toggle': 'Show details',
    'management.details.hide': 'Hide details',
    'management.details.noDescription': 'No description provided for this pane.',
    'management.details.source': 'Source',
    'management.details.owner': 'Owner',
    'management.details.kind': 'Kind',
    'management.details.role': 'Role',
    'management.details.region': 'Region',
    'management.details.status': 'Status',
    'management.details.keywords': 'Keywords',
    'management.details.workspace': 'Workspace',
    'management.details.updated': 'Updated',
    'management.details.closedAt': 'Closed at',
    'recovery.cachedRenditionAvailable': 'A provider-approved cached rendition is available. Reinstall or reconnect the provider to render it.',

    // Tab states
    'tab.preview': 'Preview',
    'tab.dirty': 'Unsaved changes',
    'tab.attention': 'Needs attention',
    'tab.offline': 'Offline',
    'tab.orphaned': 'Unavailable',
    'tab.conflict': 'Conflict',
    'tab.close': 'Close Tab',
    'tab.closeWithName': 'Close {name}',
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
    'drag.moveHere': 'Move to this pane',
    'drag.splitEdge': 'Split {edge}',
    'drag.edge.left': 'left',
    'drag.edge.right': 'right',
    'drag.edge.top': 'above',
    'drag.edge.bottom': 'below',
    'drag.reorderHere': 'Place tab here',
    'drag.openBottom': 'Release to open the Bottom workspace',
    'drag.approachBottom': 'Keep dragging down to open the Bottom workspace',
    'drag.reason.locked': 'This pane is locked',
    'drag.reason.minimum_size': 'Not enough room to split',
    'drag.reason.split_limit': 'Maximum split depth reached',
    'drag.reason.pane_limit': 'Maximum pane count reached',
    'drag.reason.already_in_group': 'Already in this pane',
    'drag.windowBlurred': 'Drag cancelled because the window lost focus.',

    // Loading/Empty/Error states
    'state.loading': 'Loading…',
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
    'explorer.action.compare': 'Compare',
    'explorer.action.reload': 'Reload',
    'explorer.action.save_as': 'Save As',
    'explorer.action.keep_local': 'Keep Local',

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
    'git.fetch': 'Fetch',
    'git.clean': 'Working tree clean',
    'git.diff': 'Open Diff',
    'git.binaryFallback': 'Binary file. Diff is unavailable.',
    'git.diffUnloaded': 'More hunks are not loaded.',
    'git.branchCreate': 'Create Branch',
    'git.worktreeCreate': 'Create Worktree',
    'git.remoteUnavailable': 'Remote actions are unavailable',
    'git.aheadBehind': 'Ahead/behind',

    // Workspace Designer
    'designer.title': 'Workspace Designer',
    'designer.description': 'Compose and persist the workspace pane layout, groups, and dock regions.',
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
    'designer.palette': 'Provider palette',
    'designer.canvas': 'Layout canvas',
    'designer.ratio': 'Split ratio',
    'designer.rail': 'Rail order',
    'designer.motion': 'Motion preference',

    // Accessibility
    'a11y.region': 'Region',
    'a11y.group': 'Group',
    'a11y.tabList': 'Tabs',
    'a11y.tab': 'Tab',
    'a11y.activeTab': 'Active tab',
    'a11y.closeTab': 'Close tab',
    'a11y.dragHandle': 'Drag to move',

    // Chrome (新增 v4 2.3)
    'chrome.showWorkbench': 'Show Pane Workbench',
    'chrome.hideWorkbench': 'Hide Pane Workbench',
    'chrome.showRight': 'Show Right',
    'chrome.hideRight': 'Hide Right workspace',
    'chrome.showBottom': 'Show Bottom',
    'chrome.hideBottom': 'Hide Bottom workspace',
    'chrome.resetLayout': 'Reset Layout',
    'chrome.maximizePane': 'Maximize pane',
    'chrome.restorePane': 'Restore pane',
    'chrome.moreActions': 'More actions for {name}',
    'chrome.paneActions': 'Pane actions',
    'chrome.openView': 'Open workspace view',
    'chrome.openViewTitle': 'Open view',
    'chrome.closeViewSelector': 'Close view selector',
    'chrome.closeActivePane': 'Close active pane',
    'chrome.openAView': 'Open a view',
    'chrome.workspaceActivity': 'Workspace activity',
    'chrome.rightWorkspace': 'Right workspace',
    'chrome.bottomWorkspace': 'Bottom workspace',
    'chrome.viewActions': '{name} actions',
    'chrome.tabListForRole': '{role} pane tabs',
    'chrome.openNamedView': 'Open {name}',
    'chrome.categoryViews': '{name} — {count} views',
    'chrome.fontSize': 'Workbench font size',
    'chrome.decreaseFontSize': 'Decrease font size',
    'chrome.increaseFontSize': 'Increase font size',

    // Region / role presentation
    'region.right': 'Right',
    'region.bottom': 'Bottom',
    'role.navigator': 'Navigation',
    'role.content': 'Content',
    'role.utility': 'Tools',
    'role.inspector': 'Inspector',
    'role.general': 'General',

    // Tab actions (新增 v4 2.3)
    'tab.moveToRight': 'Move to Right',
    'tab.moveToBottom': 'Move to Bottom',
    'tab.moveByKeyboard': 'Move by Keyboard',
    'tab.moveMode': 'Keyboard move mode',
    'tab.moveModeHelp': 'Arrow/Home/End choose a target. Enter or Space applies. Escape cancels.',
    'tab.moveCancelled': 'Keyboard move cancelled.',
    'tab.splitUpper': 'Split',
    'tab.splitEdge': 'Split {edge}',
    'tab.minimumSize': 'Pane must remain at least {width}×{height}px',

    // Error states (新增 v4 2.3)
    'error.viewFailed': 'This view failed to render: {title}.',
    'error.unavailable': '{title} is unavailable because its provider is not enabled.',
    'error.retry': 'Retry',
    'error.reloadView': 'Reload View',
    'error.noViewOpen': 'No view is open in this pane.',
    'error.layoutUnavailable': 'Layout action was not available.',

    // Drag announcements (新增 v4 2.3)
    'drag.moveTo': 'Move to',
    'drag.splitAt': 'Split at',
    'drag.releaseToApply': 'release to apply.',
    'drag.cancelled': 'Drag cancelled.',
    'drag.sourceUnavailable': 'Drag cancelled because the source view is no longer available.',
    'drag.moved': 'Pane moved.',
    'drag.dropUnavailable': 'Drop unavailable: {reason}.',
    'drag.notAllowed': 'not allowed.',

    // Standard disabled reasons (workspace-capability-matrix)
    'reason.workspaceSeamMissing': 'Requires the workspace pane seam, which this DSH release does not provide.',
    'reason.contractMismatch': 'A residual seam was found, but its contract does not match the required version.',
    'reason.commandSurfaceMissing': 'Requires the command surface; the slash directory is unavailable in this profile.',
    'reason.geometryTier0': 'Split and dock need the host workspace seam. The current overlay tier keeps a single region.',
    'reason.terminalSeamMissing': 'Requires the interactive terminal host seam.',
    'reason.previewSeamMissing': 'Requires the preview resource seam.',
    'reason.artifactSeamMissing': 'Requires the official artifact handoff seam.',
    'reason.handoffTargetMissing': 'The handoff target is not installed or not enabled.',
    'reason.handoffExpired': 'This handoff link has expired. Ask the sender to open it again.',
    'reason.handoffConsumed': 'This handoff link was already consumed.',
    'reason.presetWriteDenied': 'Saving presets was denied by the preset owner. Applying the layout still works.',

    // Workspace Capabilities view (workspace-capability-matrix)
    'capabilities.title': 'Workspace Capabilities',
    'capabilities.description': 'Inspect the pane capabilities this host provides and their evidence.',
    'capabilities.tier': 'Experience tier',
    'capabilities.tier.0': 'Tier 0 · Release overlay',
    'capabilities.tier.1': 'Tier 1 · Core pane docking',
    'capabilities.tier.2': 'Tier 2 · Full seams',
    'capabilities.seam': 'Seam',
    'capabilities.status': 'Status',
    'capabilities.reason': 'Reason',
    'capabilities.status.available': 'Available',
    'capabilities.status.missing': 'Missing',
    'capabilities.status.mismatch': 'Contract mismatch',
    'capabilities.unlock': 'How to unlock',
    'capabilities.unlockAnchor': 'Docs anchor',

    // Tier 0 overlay host (pane-overlay-workbench-experience)
    'overlay.hostLabel': 'Workbench side panel',
    'overlay.dismiss': 'Close workbench',
    'overlay.tabList': 'Workbench tabs',
    'overlay.reorderHint': 'Release to reorder the tab.',
    'overlay.handoffDrop': 'Drop to hand off the artifact.',
    'overlay.bulkCloseBlocked': '{name} blocks bulk close.',

    // Artifact handoff menu labels (pane-artifact-handoff)
    'handoff.menu': 'Artifact handoff',
    'handoff.open': 'Open',
    'handoff.compare': 'Compare',
    'handoff.attachContext': 'Attach as context',
    'handoff.transform': 'Transform',
    'handoff.handoff': 'Hand off',
    'handoff.link': 'Link',
    'handoff.unsupportedIntent': 'This action is not supported by the artifact handoff contract.',
    'handoff.invalidSource': 'This artifact reference failed validation; handoff entries are disabled.',
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
    'rail.agents': '智能体',
    'rail.customize': '自定义工作区',

    // View Picker
    'picker.title': '打开视图',
    'picker.search.placeholder': '搜索视图…',
    'picker.group.open': '已打开',
    'picker.group.available': '可用',
    'management.title': '窗格中心',
    'management.openMode': '打开窗格',
    'management.manageMode': '管理标签页',
    'management.manageTabs': '管理标签页',
    'management.search.placeholder': '搜索窗格、标签页、标题或历史记录',
    'management.includeConversation': '包含对话内容',
    'management.conversationUnavailable': '当前宿主不支持对话内容搜索。',
    'management.currentScope': '当前范围：{scope}',
    'management.scope.workspace': '工作区',
    'management.scope.session': '会话',
    'management.group.favorites': '收藏',
    'management.group.recent': '最近',
    'management.group.development': '开发工具',
    'management.group.agents': '智能体',
    'management.group.creator': '创作',
    'management.group.knowledge': '资料',
    'management.group.system': '系统',
    'management.group.other': '其他',
    'management.group.history': '关闭历史',
    'management.createGroup': '创建分组',
    'management.customGroups': '自定义分组',
    'management.pinGroup': '固定或取消固定分组',
    'management.moveGroupUp': '上移分组',
    'management.moveGroupDown': '下移分组',
    'management.deleteGroup': '删除分组',
    'management.groupName': '分组名称',
    'management.favorite': '收藏',
    'management.unfavorite': '取消收藏',
    'management.closeSelected': '安全关闭所选',
    'management.pinSelected': '固定所选',
    'management.unpinSelected': '取消固定所选',
    'management.moveSelected': '移动所选',
    'management.closeUnpinned': '安全关闭未固定',
    'management.restore': '恢复',
    'management.restoreLast': '恢复最近关闭',
    'management.undo': '撤销',
    'management.closedCount': '已关闭 {count} 个标签页',
    'management.protectedCount': '{count} 个标签页需要确认',
    'management.protectedTitle': '受保护的标签页',
    'management.confirmClose': '仍然关闭',
    'management.protectedReason.dirty': '存在未保存更改',
    'management.protectedReason.running': '任务正在运行',
    'management.protectedReason.terminal': '终端无法无损恢复',
    'management.protectedReason.confirm': '需要所有者确认',
    'management.protectedReason.deny': '所有者禁止关闭',
    'management.protectedReason.unknown': '状态不可用',
    'management.noResults': '没有匹配的窗格或标签页。',
    'management.filters': '高级筛选',
    'management.filter.group': '全部分组',
    'management.filter.region': '右侧 / 底部',
    'management.filter.owner': '全部提供方',
    'management.filter.type': '全部类型',
    'management.filter.status': '全部状态',
    'management.filter.pinned': '固定状态',
    'management.filter.onlyPinned': '仅固定',
    'management.filter.onlyUnpinned': '仅未固定',
    'management.filter.workspace': '工作区范围',
    'management.filter.currentWorkspace': '当前工作区',
    'management.filter.allWorkspaces': '全部已授权工作区',
    'management.loadMore': '加载更多',
    'management.target': '打开位置',
    'management.targetCurrent': '智能放置',
    'management.source.pane': '可用窗格',
    'management.source.tab': '已打开的标签页',
    'management.source.history': '关闭历史',
    'management.details': '窗格详情',
    'management.details.toggle': '查看详情',
    'management.details.hide': '收起详情',
    'management.details.noDescription': '该窗格暂无详细描述。',
    'management.details.source': '来源',
    'management.details.owner': '提供方',
    'management.details.kind': '类型',
    'management.details.role': '角色',
    'management.details.region': '区域',
    'management.details.status': '状态',
    'management.details.keywords': '关键词',
    'management.details.workspace': '工作区',
    'management.details.updated': '更新时间',
    'management.details.closedAt': '关闭时间',
    'recovery.cachedRenditionAvailable': '存在提供方批准的安全缓存。重新安装或连接提供方后可继续渲染。',

    // Tab states
    'tab.preview': '预览',
    'tab.dirty': '未保存的更改',
    'tab.attention': '需要关注',
    'tab.offline': '离线',
    'tab.orphaned': '不可用',
    'tab.conflict': '冲突',
    'tab.close': '关闭标签页',
    'tab.closeWithName': '关闭“{name}”',
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
    'drag.moveHere': '移动到此窗格',
    'drag.splitEdge': '在{edge}拆分',
    'drag.edge.left': '左侧',
    'drag.edge.right': '右侧',
    'drag.edge.top': '上方',
    'drag.edge.bottom': '下方',
    'drag.reorderHere': '将标签页放在此处',
    'drag.openBottom': '释放以展开底部工作区',
    'drag.approachBottom': '继续向下拖动以展开底部工作区',
    'drag.reason.locked': '此窗格已锁定',
    'drag.reason.minimum_size': '空间不足，无法拆分',
    'drag.reason.split_limit': '已达最大拆分层级',
    'drag.reason.pane_limit': '已达最大窗格数量',
    'drag.reason.already_in_group': '已在此窗格中',
    'drag.windowBlurred': '拖拽已取消，因为窗口失去了焦点。',

    // Loading/Empty/Error states
    'state.loading': '加载中…',
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
    'explorer.action.compare': '比较',
    'explorer.action.reload': '重新加载',
    'explorer.action.save_as': '另存为',
    'explorer.action.keep_local': '保留本地',

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
    'git.fetch': '获取',
    'git.clean': '工作区干净',
    'git.diff': '打开差异',
    'git.binaryFallback': '二进制文件，无法显示差异。',
    'git.diffUnloaded': '还有未加载的变更块。',
    'git.branchCreate': '创建分支',
    'git.worktreeCreate': '创建工作树',
    'git.remoteUnavailable': '远程操作不可用',
    'git.aheadBehind': '超前/落后',

    // Workspace Designer
    'designer.title': '工作区设计器',
    'designer.description': '编排并持久化工作区窗格布局、分组与停靠区域。',
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
    'designer.palette': '提供程序面板',
    'designer.canvas': '布局画布',
    'designer.ratio': '拆分比例',
    'designer.rail': '活动栏顺序',
    'designer.motion': '动效偏好',

    // Accessibility
    'a11y.region': '区域',
    'a11y.group': '组',
    'a11y.tabList': '标签页列表',
    'a11y.tab': '标签页',
    'a11y.activeTab': '当前标签页',
    'a11y.closeTab': '关闭标签页',
    'a11y.dragHandle': '拖动以移动',

    // Chrome (新增 v4 2.3)
    'chrome.showWorkbench': '显示窗格工作台',
    'chrome.hideWorkbench': '隐藏窗格工作台',
    'chrome.showRight': '显示右侧',
    'chrome.hideRight': '隐藏右侧工作区',
    'chrome.showBottom': '显示底部',
    'chrome.hideBottom': '隐藏底部工作区',
    'chrome.resetLayout': '重置布局',
    'chrome.maximizePane': '最大化窗格',
    'chrome.restorePane': '还原窗格',
    'chrome.moreActions': '“{name}”的更多操作',
    'chrome.paneActions': '窗格操作',
    'chrome.openView': '打开工作区视图',
    'chrome.openViewTitle': '打开视图',
    'chrome.closeViewSelector': '关闭视图选择器',
    'chrome.closeActivePane': '关闭当前窗格',
    'chrome.openAView': '打开视图',
    'chrome.workspaceActivity': '工作区活动',
    'chrome.rightWorkspace': '右侧工作区',
    'chrome.bottomWorkspace': '底部工作区',
    'chrome.viewActions': '“{name}”操作',
    'chrome.tabListForRole': '{role}窗格标签页',
    'chrome.openNamedView': '打开 {name}',
    'chrome.categoryViews': '{name} — {count} 个视图',
    'chrome.fontSize': '工作台字号',
    'chrome.decreaseFontSize': '减小字号',
    'chrome.increaseFontSize': '增大字号',

    // Region / role presentation
    'region.right': '右侧',
    'region.bottom': '底部',
    'role.navigator': '导航',
    'role.content': '内容',
    'role.utility': '工具',
    'role.inspector': '检查器',
    'role.general': '通用',

    // Tab actions (新增 v4 2.3)
    'tab.moveToRight': '移至右侧',
    'tab.moveToBottom': '移至底部',
    'tab.moveByKeyboard': '使用键盘移动',
    'tab.moveMode': '键盘移动模式',
    'tab.moveModeHelp': '箭头/Home/End 选择目标。回车或空格应用。ESC 取消。',
    'tab.moveCancelled': '键盘移动已取消。',
    'tab.splitUpper': '拆分',
    'tab.splitEdge': '拆分到{edge}',
    'tab.minimumSize': '窗格至少需保留 {width}×{height}px',

    // Error states (新增 v4 2.3)
    'error.viewFailed': '此视图渲染失败：{title}。',
    'error.unavailable': '{title} 不可用，因为其提供程序未启用。',
    'error.retry': '重试',
    'error.reloadView': '重新加载视图',
    'error.noViewOpen': '此窗格中未打开视图。',
    'error.layoutUnavailable': '布局操作不可用。',

    // Drag announcements (新增 v4 2.3)
    'drag.moveTo': '移动到',
    'drag.splitAt': '拆分于',
    'drag.releaseToApply': '释放以应用。',
    'drag.cancelled': '拖拽已取消。',
    'drag.sourceUnavailable': '拖拽已取消，因为源视图不再可用。',
    'drag.moved': '窗格已移动。',
    'drag.dropUnavailable': '不可放置：{reason}。',
    'drag.notAllowed': '不允许。',

    // Standard disabled reasons (workspace-capability-matrix)
    'reason.workspaceSeamMissing': '需要工作区窗格 seam，当前 DSH 发布版未提供。',
    'reason.contractMismatch': '检测到残缺的 seam，其合同与所需版本不匹配。',
    'reason.commandSurfaceMissing': '需要命令面；当前 profile 下斜杠目录不可用。',
    'reason.geometryTier0': '拆分与停靠需要 host 工作区 seam。当前 overlay 层级保持单区域。',
    'reason.terminalSeamMissing': '需要交互式终端 host seam。',
    'reason.previewSeamMissing': '需要预览资源 seam。',
    'reason.artifactSeamMissing': '需要官方 artifact handoff seam。',
    'reason.handoffTargetMissing': 'handoff 目标未安装或未启用。',
    'reason.handoffExpired': '此 handoff 链接已过期，请让发送方重新打开。',
    'reason.handoffConsumed': '此 handoff 链接已被消费。',
    'reason.presetWriteDenied': '预设 owner 拒绝了保存。布局应用不受影响。',

    // Workspace Capabilities view (workspace-capability-matrix)
    'capabilities.title': '工作区能力',
    'capabilities.description': '查看当前宿主提供的窗格能力及其证据。',
    'capabilities.tier': '体验层级',
    'capabilities.tier.0': 'Tier 0 · 发布版 overlay',
    'capabilities.tier.1': 'Tier 1 · Core 窗格停靠',
    'capabilities.tier.2': 'Tier 2 · 全量 seam',
    'capabilities.seam': 'Seam',
    'capabilities.status': '状态',
    'capabilities.reason': '原因',
    'capabilities.status.available': '可用',
    'capabilities.status.missing': '缺失',
    'capabilities.status.mismatch': '合同不匹配',
    'capabilities.unlock': '如何解锁',
    'capabilities.unlockAnchor': '文档锚点',

    // Tier 0 overlay host (pane-overlay-workbench-experience)
    'overlay.hostLabel': '工作台侧栏',
    'overlay.dismiss': '关闭工作台',
    'overlay.tabList': '工作台标签页',
    'overlay.reorderHint': '释放以重排标签页。',
    'overlay.handoffDrop': '放下以 handoff 该 artifact。',
    'overlay.bulkCloseBlocked': '“{name}”阻止了批量关闭。',

    // Artifact handoff menu labels (pane-artifact-handoff)
    'handoff.menu': 'Artifact handoff',
    'handoff.open': '打开',
    'handoff.compare': '比较',
    'handoff.attachContext': '附加为上下文',
    'handoff.transform': '转换',
    'handoff.handoff': 'Hand off',
    'handoff.link': '关联',
    'handoff.unsupportedIntent': 'artifact handoff 合同不支持此动作。',
    'handoff.invalidSource': '此 artifact 引用未通过校验，handoff 入口已禁用。',
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

function resolveInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'en'
  const base = getLocaleBase(window.navigator.language) as Locale
  return LOCALE_BUNDLES[base] === undefined ? 'en' : base
}

/** Current active locale; DSH LocaleRuntime replaces the browser-derived provisional value. */
let activeLocale: Locale = resolveInitialLocale()

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
export function setActiveLocale(locale: string): void {
  const baseLocale = getLocaleBase(locale) as Locale
  if (LOCALE_BUNDLES[baseLocale] === undefined || activeLocale === baseLocale) return
  activeLocale = baseLocale
  localeRevision += 1
  for (const listener of [...localeListeners]) listener()
}

let localeRevision = 0
const localeListeners = new Set<() => void>()

/** React-compatible locale revision snapshot for hot-switch rendering. */
export function getLocaleRevision(): number {
  return localeRevision
}

/** Subscribes chrome roots to locale-only presentation changes. */
export function subscribeLocale(listener: () => void): () => void {
  localeListeners.add(listener)
  return () => { localeListeners.delete(listener) }
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
