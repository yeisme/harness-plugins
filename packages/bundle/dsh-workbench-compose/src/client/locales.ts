/** Composed Workbench locale strings. */

export const NS = 'workbenchCompose'

export const zh = {
  'trigger': '工作台',
  'aria': '组合工作台',
  'commands': '命令',
  'empty': '暂无媒体，等待 Host 投影接入。',
  'placeholderTitle': '预留接入位',
  'placeholderBody': '该 Tab 尚未接入 owner seam。',
} satisfies Record<string, string>

export type ComposeKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    workbenchCompose: ComposeKey
  }
}

export const en = {
  'trigger': 'Workbench',
  'aria': 'Composed workbench',
  'commands': 'Commands',
  'empty': 'No media yet; waiting for a Host projection.',
  'placeholderTitle': 'Reserved slot',
  'placeholderBody': 'This tab is not connected to an owner seam yet.',
} satisfies Record<ComposeKey, string>
