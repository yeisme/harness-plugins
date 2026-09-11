/**
 * URL session 入口文案（中英）。codec/controller 保持零文案；UI 组件默认
 * 中文，英文由 locale key 覆盖——与仓内 embed 面的 locale 惯例一致。
 *
 * @module @yeisme/dsh-client-ui-url-session/client
 */

export interface UrlSessionLabels {
  readonly menuTrigger: string
  readonly copyLink: string
  readonly openInNewTab: string
  readonly missingTitle: string
  readonly backToList: string
  readonly noSessionReason: string
  readonly clipboardUnavailableReason: string
  readonly copiedNotice: string
  readonly copyFailedReason: string
}

const ZH: UrlSessionLabels = {
  menuTrigger: '会话链接',
  copyLink: '复制会话链接',
  openInNewTab: '在新标签页打开',
  missingTitle: '会话不存在或已被清理',
  backToList: '返回列表',
  noSessionReason: '当前没有会话',
  clipboardUnavailableReason: '当前环境不支持剪贴板写入',
  copiedNotice: '链接已复制',
  copyFailedReason: '复制失败，请手动复制地址栏',
}

const EN: UrlSessionLabels = {
  menuTrigger: 'Session link',
  copyLink: 'Copy session link',
  openInNewTab: 'Open in new tab',
  missingTitle: 'Session does not exist or was cleaned up',
  backToList: 'Back to list',
  noSessionReason: 'No active session',
  clipboardUnavailableReason: 'Clipboard writing is unavailable in this context',
  copiedNotice: 'Link copied',
  copyFailedReason: 'Copy failed; use the address bar instead',
}

export const URL_SESSION_LOCALES: Readonly<Record<'zh' | 'en', UrlSessionLabels>> = Object.freeze({ zh: ZH, en: EN })

export function urlSessionLabels(locale: string | undefined): UrlSessionLabels {
  return locale === 'en' ? EN : ZH
}
