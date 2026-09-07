export const browserZh = {
  title: '浏览器', reconnect: '重新连接', pages: '页面', navigationDraft: '导航草稿',
  environmentUnavailable: '环境身份不可用', bindingRequired: '需要工作区环境绑定。', noGuess: '面板不会猜测开发地址、身份或凭据。',
  viewportUnavailable: '内嵌视口不可用', viewportUnavailableDescription: 'Host 尚未提供当前页面的受支持视口传输。', ownerViewport: 'Owner 页面视口',
  control: '控制权：{holder}', identity: '页面交互使用应用 owner 提供的身份。', working: '处理中…', confirm: '确认 {label}', approve: '批准 {label}',
  reviewConfirm: '请检查 owner 动作，再次确认后提交。', reviewApproval: '请检查 owner 动作；再次点击仅提交 owner 审批，不代表已批准。',
  ownerReceipt: 'Owner 回执：{receipt}', reconcileRequired: '需要对账：{reason}', ownerRequiresConfirmation: 'Owner 仍要求确认。',
  actionUnknown: '动作结果未知；请与 owner 对账。', actionUnavailable: '操作不可用。', projectionInvalid: 'Owner 未返回安全投影。', ownerUnavailable: 'Owner 不可用。',
  viewportInvalid: 'Owner 未提供当前页面的有效视口租约。', viewportAttachFailed: '无法连接视口传输。', viewportEnded: '视口连接已结束。', viewportStalled: '视口连接已停滞。', viewportInputRejected: '视口输入未被接受：{reason}',
} as const

export type BrowserPaneKey = keyof typeof browserZh
export type BrowserPaneTranslator = (key: BrowserPaneKey, params?: Readonly<Record<string, string | number>>) => string
export type BrowserPaneLocale = 'zh' | 'en' | 'pseudo-long' | 'pseudo-rtl'

export const browserEn: Readonly<Record<BrowserPaneKey, string>> = {
  title: 'Browser Pane', reconnect: 'Reconnect', pages: 'Pages', navigationDraft: 'Navigation draft',
  environmentUnavailable: 'Environment identity unavailable', bindingRequired: 'A workspace environment binding is required.', noGuess: 'The pane does not guess a development URL, identity, or credential.',
  viewportUnavailable: 'Embedded viewport unavailable', viewportUnavailableDescription: 'The Host has not supplied a supported current-page viewport transport.', ownerViewport: 'Owner viewport',
  control: 'Control: {holder}', identity: 'Page interactions use the application identity supplied by its owner.', working: 'Working…', confirm: 'Confirm {label}', approve: 'Approve {label}',
  reviewConfirm: 'Review the owner action and confirm once more.', reviewApproval: 'Review the owner action; the second click submits owner approval and does not claim approval.',
  ownerReceipt: 'Owner receipt: {receipt}', reconcileRequired: 'Reconcile required: {reason}', ownerRequiresConfirmation: 'The owner still requires confirmation.',
  actionUnknown: 'The action outcome is unknown; reconcile with the owner.', actionUnavailable: 'Action unavailable.', projectionInvalid: 'The owner did not return a safe projection.', ownerUnavailable: 'Owner unavailable.',
  viewportInvalid: 'The owner did not provide a valid current-page viewport lease.', viewportAttachFailed: 'The viewport transport could not attach.', viewportEnded: 'The viewport connection ended.', viewportStalled: 'The viewport connection stalled.', viewportInputRejected: 'Viewport input was not accepted: {reason}',
}

const pseudo = (value: string): string => `［ ${value.replace(/([aeiou])/giu, '$1$1')} ··· ］`
const rtl = (value: string): string => `⟦RTL ${[...value].reverse().join('')}⟧`
export const browserPseudoLong = Object.fromEntries(Object.entries(browserEn).map(([key, value]) => [key, pseudo(value)])) as Readonly<Record<BrowserPaneKey, string>>
export const browserPseudoRtl = Object.fromEntries(Object.entries(browserEn).map(([key, value]) => [key, rtl(value)])) as Readonly<Record<BrowserPaneKey, string>>

const TABLES: Record<BrowserPaneLocale, Readonly<Record<BrowserPaneKey, string>>> = { zh: browserZh, en: browserEn, 'pseudo-long': browserPseudoLong, 'pseudo-rtl': browserPseudoRtl }
export function createBrowserPaneTranslator(locale: BrowserPaneLocale = 'en'): BrowserPaneTranslator {
  const table = TABLES[locale]
  return (key, params) => table[key].replace(/\{([a-zA-Z0-9_]+)\}/gu, (_match, name: string) => String(params?.[name] ?? `{${name}}`))
}
export const defaultBrowserPaneTranslator = createBrowserPaneTranslator('en')
