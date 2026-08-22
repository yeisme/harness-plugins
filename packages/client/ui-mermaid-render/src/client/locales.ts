/** Figure 操作条文案（ graft 层在 React 树外，直接取字典而非 locale seat）。 */
export interface MermaidLabels {
  readonly showSource: string
  readonly hideSource: string
  readonly copy: string
  readonly copied: string
  readonly open: string
  readonly failed: string
}

const zh: MermaidLabels = {
  showSource: '查看源码',
  hideSource: '收起源码',
  copy: '复制源码',
  copied: '已复制',
  open: '新窗口打开',
  failed: 'mermaid 渲染失败',
}

const en: MermaidLabels = {
  showSource: 'Show source',
  hideSource: 'Hide source',
  copy: 'Copy source',
  copied: 'Copied',
  open: 'Open in new tab',
  failed: 'mermaid render failed',
}

/** 按浏览器语言选字典；非英文一律回落中文。 */
export function labelsFor(language: string): MermaidLabels {
  return /^en\b|^en-/i.test(language.trim()) ? en : zh
}
