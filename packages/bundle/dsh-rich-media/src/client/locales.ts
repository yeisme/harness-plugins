/** Rich Media Workbench 的本地化字符串。 */

export const NS = 'richMedia'

export const zh = {
  'workbench.trigger': '媒体工作台',
  'workbench.aria': '富媒体工作台',
  'workbench.open': '打开富媒体工作台',
  'workbench.close': '关闭富媒体工作台',
  'workbench.empty': '暂无媒体，等待 Host 投影接入。',
  'workbench.tab.media': '媒体库',
  'workbench.tab.files': '文件',
  'workbench.tab.terminal': '终端',
  'workbench.tab.git': 'Git',
  'workbench.tab.browser': '浏览器',
  'workbench.placeholder.title': '旧版媒体工作台',
  'workbench.placeholder.body': '仅供 story 与迁移测试；生产媒体视图已迁移到 Pane Workbench。',
  'workbench.card.open': '打开媒体',
  'workbench.card.download': '下载媒体',
  'workbench.loading': '加载媒体…',
  'workbench.failed': '媒体加载失败',
  'workbench.retry': '重试',
  'workbench.pdfFallback': '当前浏览器无法预览该 PDF，请使用“打开”查看。',
  'workbench.card.compare': '对比',
  'workbench.card.zoom': '放大',
  'workbench.compare.aria': '媒体对比',
  'workbench.compare.empty': '选择两个媒体进行对比。',
  'workbench.zoom.aria': '媒体放大',
  'workbench.zoom.in': '放大',
  'workbench.zoom.out': '缩小',
  'workbench.zoom.close': '关闭放大',
} satisfies Record<string, string>

export type RichMediaKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    richMedia: RichMediaKey
  }
}

export const en = {
  'workbench.trigger': 'Media Workbench',
  'workbench.aria': 'Rich media workbench',
  'workbench.open': 'Open rich media workbench',
  'workbench.close': 'Close rich media workbench',
  'workbench.empty': 'No media yet; waiting for a Host projection.',
  'workbench.tab.media': 'Media',
  'workbench.tab.files': 'Files',
  'workbench.tab.terminal': 'Terminal',
  'workbench.tab.git': 'Git',
  'workbench.tab.browser': 'Browser',
  'workbench.placeholder.title': 'Legacy media workbench',
  'workbench.placeholder.body': 'Story and migration test surface only; production media lives in Pane Workbench.',
  'workbench.card.open': 'Open media',
  'workbench.card.download': 'Download media',
  'workbench.loading': 'Loading media…',
  'workbench.failed': 'Media failed to load',
  'workbench.retry': 'Retry',
  'workbench.pdfFallback': 'Your browser cannot preview this PDF. Use Open instead.',
  'workbench.card.compare': 'Compare',
  'workbench.card.zoom': 'Zoom',
  'workbench.compare.aria': 'Media compare',
  'workbench.compare.empty': 'Select two media items to compare.',
  'workbench.zoom.aria': 'Media zoom',
  'workbench.zoom.in': 'Zoom in',
  'workbench.zoom.out': 'Zoom out',
  'workbench.zoom.close': 'Close zoom',
} satisfies Record<RichMediaKey, string>
