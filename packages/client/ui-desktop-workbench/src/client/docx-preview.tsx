import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { strFromU8, unzipSync } from 'fflate/browser'

const DOCX_MEDIA_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const DOCX_COMPRESSED_MAX = 12 * 1024 * 1024
const DOCX_EXPANDED_MAX = 48 * 1024 * 1024
const INITIAL_BLOCKS = 600
const BLOCK_STEP = 600

type RunToken = {
  readonly kind: 'text'
  readonly text: string
  readonly bold?: boolean
  readonly italic?: boolean
  readonly underline?: boolean
  readonly strike?: boolean
  readonly color?: string
  readonly background?: string
  readonly fontSize?: number
  readonly vertical?: 'super' | 'sub'
  readonly href?: string
} | {
  readonly kind: 'break'
} | {
  readonly kind: 'image'
  readonly src: string
  readonly alt: string
}

interface ParagraphBlock {
  readonly kind: 'paragraph'
  readonly runs: readonly RunToken[]
  readonly heading?: 1 | 2 | 3 | 4 | 5 | 6
  readonly align?: 'left' | 'center' | 'right' | 'justify'
  readonly firstLineEm?: number
  readonly list?: 'ordered' | 'bullet'
  readonly listLevel?: number
}

interface TableCell {
  readonly paragraphs: readonly ParagraphBlock[]
  readonly colSpan?: number
  readonly background?: string
}

interface TableBlock {
  readonly kind: 'table'
  readonly rows: readonly (readonly TableCell[])[]
}

export type DocxBlock = ParagraphBlock | TableBlock

export interface ParsedDocx {
  readonly blocks: readonly DocxBlock[]
  readonly paragraphs: number
  readonly tables: number
}

interface StyleInfo {
  readonly name?: string
  readonly heading?: ParagraphBlock['heading']
  readonly bold?: boolean
  readonly italic?: boolean
  readonly fontSize?: number
}

interface Relationship {
  readonly target: string
  readonly external: boolean
}

function localName(node: Node): string {
  return (node as Node & { localName?: string }).localName ?? node.nodeName.split(':').at(-1) ?? node.nodeName
}

function childElements(node: Node): Element[] {
  return [...node.childNodes].filter((child): child is Element => child.nodeType === 1)
}

function direct(node: Node | undefined, name: string): Element | undefined {
  if (node === undefined) return undefined
  return childElements(node).find(child => localName(child) === name)
}

function descendants(node: Node | undefined, name: string): Element[] {
  if (node === undefined) return []
  const parent = node as Element & { getElementsByTagNameNS(namespace: string, localName: string): HTMLCollectionOf<Element> }
  return Array.from(parent.getElementsByTagNameNS('*', name))
}

function attribute(node: Element | undefined, name: string): string | undefined {
  if (node === undefined) return undefined
  return node.getAttribute(`w:${name}`)
    ?? node.getAttribute(`r:${name}`)
    ?? node.getAttribute(`a:${name}`)
    ?? node.getAttribute(name)
    ?? [...node.attributes].find(item => item.localName === name)?.value
    ?? undefined
}

function parseXml(bytes: Uint8Array | undefined, label: string): XMLDocument | undefined {
  if (bytes === undefined) return undefined
  const document = new DOMParser().parseFromString(strFromU8(bytes), 'application/xml')
  if (document.getElementsByTagName('parsererror').length > 0) throw new Error(`${label} XML 无法解析`)
  return document
}

function on(node: Element | undefined): boolean {
  if (node === undefined) return false
  const value = attribute(node, 'val')?.toLowerCase()
  return value === undefined || !['0', 'false', 'off', 'none'].includes(value)
}

function colorValue(value: string | undefined): string | undefined {
  if (value === undefined || value === 'auto' || !/^[0-9a-f]{6}$/i.test(value)) return undefined
  return `#${value}`
}

function highlightValue(value: string | undefined): string | undefined {
  if (value === undefined || value === 'none') return undefined
  const colors: Record<string, string> = {
    black: '#111', blue: '#8fb8ff', cyan: '#8ee8ea', green: '#99dda7', magenta: '#e6a0dc',
    red: '#ffaaa4', yellow: '#f3df72', white: '#fff', darkBlue: '#5878a8', darkCyan: '#4c9197',
    darkGreen: '#4f865a', darkMagenta: '#8e5a86', darkRed: '#934b49', darkYellow: '#94823f',
    darkGray: '#666', lightGray: '#bbb',
  }
  return colors[value]
}

function headingFromName(name: string | undefined): ParagraphBlock['heading'] {
  if (name === undefined) return undefined
  const normalized = name.trim().toLowerCase()
  if (normalized === 'title' || normalized === '标题') return 1
  const match = /(?:heading|标题)\s*([1-6])/.exec(normalized)
  return match === null ? undefined : Number(match[1]) as ParagraphBlock['heading']
}

function parseStyles(document: XMLDocument | undefined): ReadonlyMap<string, StyleInfo> {
  const result = new Map<string, StyleInfo>()
  if (document === undefined) return result
  for (const style of descendants(document.documentElement, 'style')) {
    if (attribute(style, 'type') !== 'paragraph') continue
    const id = attribute(style, 'styleId')
    if (id === undefined) continue
    const name = attribute(direct(style, 'name'), 'val')
    const outline = Number(attribute(direct(direct(style, 'pPr'), 'outlineLvl'), 'val'))
    const rPr = direct(style, 'rPr')
    const size = Number(attribute(direct(rPr, 'sz'), 'val'))
    const heading = Number.isInteger(outline) && outline >= 0 && outline <= 5
      ? (outline + 1) as ParagraphBlock['heading']
      : headingFromName(name)
    result.set(id, {
      ...(name === undefined ? {} : { name }),
      ...(heading === undefined ? {} : { heading }),
      ...(on(direct(rPr, 'b')) ? { bold: true } : {}),
      ...(on(direct(rPr, 'i')) ? { italic: true } : {}),
      ...(Number.isFinite(size) && size > 0 ? { fontSize: size / 2 } : {}),
    })
  }
  return result
}

function parseRelationships(document: XMLDocument | undefined): ReadonlyMap<string, Relationship> {
  const result = new Map<string, Relationship>()
  if (document === undefined) return result
  for (const rel of descendants(document.documentElement, 'Relationship')) {
    const id = attribute(rel, 'Id')
    const target = attribute(rel, 'Target')
    if (id !== undefined && target !== undefined) result.set(id, { target, external: attribute(rel, 'TargetMode') === 'External' })
  }
  return result
}

function safeHref(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:' ? value : undefined
  } catch {
    return undefined
  }
}

function normalizeWordTarget(target: string): string | undefined {
  const parts = `word/${target}`.replaceAll('\\', '/').split('/')
  const normalized: string[] = []
  for (const part of parts) {
    if (part === '' || part === '.') continue
    if (part === '..') {
      if (normalized.length === 0) return undefined
      normalized.pop()
    } else normalized.push(part)
  }
  const value = normalized.join('/')
  return value.startsWith('word/') ? value : undefined
}

function imageMediaType(path: string): string {
  const extension = path.split('.').at(-1)?.toLowerCase()
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  if (extension === 'gif') return 'image/gif'
  if (extension === 'svg') return 'image/svg+xml'
  if (extension === 'webp') return 'image/webp'
  if (extension === 'bmp') return 'image/bmp'
  return 'image/png'
}

function bytesToDataUrl(bytes: Uint8Array, mediaType: string): string {
  let binary = ''
  const chunk = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk))
  }
  return `data:${mediaType};base64,${btoa(binary)}`
}

function paragraphAlignment(value: string | undefined): ParagraphBlock['align'] {
  if (value === 'center') return 'center'
  if (value === 'right' || value === 'end') return 'right'
  if (value === 'both' || value === 'distribute') return 'justify'
  return value === 'left' || value === 'start' ? 'left' : undefined
}

function parseRun(
  run: Element,
  style: StyleInfo | undefined,
  relationships: ReadonlyMap<string, Relationship>,
  archive: Record<string, Uint8Array>,
  inheritedHref?: string,
): RunToken[] {
  const rPr = direct(run, 'rPr')
  const runStyle = stylesForRun(rPr, style)
  const tokens: RunToken[] = []
  for (const item of childElements(run)) {
    const name = localName(item)
    if (name === 't' || name === 'delText' || name === 'instrText') {
      if (item.textContent !== '') tokens.push({ kind: 'text', text: item.textContent ?? '', ...runStyle, ...(inheritedHref === undefined ? {} : { href: inheritedHref }) })
    } else if (name === 'tab') {
      tokens.push({ kind: 'text', text: '\u2003', ...runStyle })
    } else if (name === 'br' || name === 'cr') {
      tokens.push({ kind: 'break' })
    } else if (name === 'drawing' || name === 'pict' || name === 'object') {
      for (const blip of descendants(item, 'blip')) {
        const relation = relationships.get(attribute(blip, 'embed') ?? '')
        if (relation === undefined || relation.external) continue
        const path = normalizeWordTarget(relation.target)
        const bytes = path === undefined ? undefined : archive[path]
        if (path !== undefined && bytes !== undefined) {
          const docPr = descendants(item, 'docPr')[0]
          const alt = attribute(docPr, 'descr') ?? attribute(docPr, 'name') ?? '文档图片'
          tokens.push({ kind: 'image', src: bytesToDataUrl(bytes, imageMediaType(path)), alt })
        }
      }
    }
  }
  return tokens
}

function stylesForRun(rPr: Element | undefined, inherited: StyleInfo | undefined): Omit<Extract<RunToken, { kind: 'text' }>, 'kind' | 'text' | 'href'> {
  const size = Number(attribute(direct(rPr, 'sz'), 'val'))
  const vertical = attribute(direct(rPr, 'vertAlign'), 'val')
  const color = colorValue(attribute(direct(rPr, 'color'), 'val'))
  const background = highlightValue(attribute(direct(rPr, 'highlight'), 'val'))
  return {
    ...((inherited?.bold === true || on(direct(rPr, 'b'))) ? { bold: true } : {}),
    ...((inherited?.italic === true || on(direct(rPr, 'i'))) ? { italic: true } : {}),
    ...(on(direct(rPr, 'u')) ? { underline: true } : {}),
    ...(on(direct(rPr, 'strike')) || on(direct(rPr, 'dstrike')) ? { strike: true } : {}),
    ...(color === undefined ? {} : { color }),
    ...(background === undefined ? {} : { background }),
    ...(Number.isFinite(size) && size > 0 ? { fontSize: size / 2 } : inherited?.fontSize === undefined ? {} : { fontSize: inherited.fontSize }),
    ...(vertical === 'superscript' ? { vertical: 'super' as const } : vertical === 'subscript' ? { vertical: 'sub' as const } : {}),
  }
}

function parseParagraph(
  paragraph: Element,
  styles: ReadonlyMap<string, StyleInfo>,
  relationships: ReadonlyMap<string, Relationship>,
  archive: Record<string, Uint8Array>,
): ParagraphBlock {
  const pPr = direct(paragraph, 'pPr')
  const style = styles.get(attribute(direct(pPr, 'pStyle'), 'val') ?? '')
  const outline = Number(attribute(direct(pPr, 'outlineLvl'), 'val'))
  const heading = Number.isInteger(outline) && outline >= 0 && outline <= 5
    ? (outline + 1) as ParagraphBlock['heading']
    : style?.heading
  const firstLine = Number(attribute(direct(pPr, 'ind'), 'firstLine'))
  const align = paragraphAlignment(attribute(direct(pPr, 'jc'), 'val'))
  const numPr = direct(pPr, 'numPr')
  const listLevel = Number(attribute(direct(numPr, 'ilvl'), 'val'))
  const runs: RunToken[] = []
  const walk = (node: Element, href?: string): void => {
    if (localName(node) === 'r') {
      runs.push(...parseRun(node, style, relationships, archive, href))
      return
    }
    const relationshipId = localName(node) === 'hyperlink' ? attribute(node, 'id') : undefined
    const relationship = relationshipId === undefined ? undefined : relationships.get(relationshipId)
    const nextHref = relationship?.external === true ? safeHref(relationship.target) : href
    for (const child of childElements(node)) {
      if (localName(child) !== 'pPr') walk(child, nextHref)
    }
  }
  walk(paragraph)
  return {
    kind: 'paragraph',
    runs,
    ...(heading === undefined ? {} : { heading }),
    ...(align === undefined ? {} : { align }),
    ...(Number.isFinite(firstLine) && firstLine !== 0 ? { firstLineEm: Math.max(-4, Math.min(8, firstLine / 240)) } : {}),
    ...(numPr === undefined ? {} : { list: 'bullet' as const, listLevel: Number.isFinite(listLevel) ? Math.max(0, Math.min(8, listLevel)) : 0 }),
  }
}

function parseTable(
  table: Element,
  styles: ReadonlyMap<string, StyleInfo>,
  relationships: ReadonlyMap<string, Relationship>,
  archive: Record<string, Uint8Array>,
): TableBlock {
  const rows = childElements(table).filter(row => localName(row) === 'tr').map(row =>
    childElements(row).filter(cell => localName(cell) === 'tc').map(cell => {
      const tcPr = direct(cell, 'tcPr')
      const span = Number(attribute(direct(tcPr, 'gridSpan'), 'val'))
      const background = colorValue(attribute(direct(tcPr, 'shd'), 'fill'))
      return {
        paragraphs: childElements(cell).filter(item => localName(item) === 'p').map(item => parseParagraph(item, styles, relationships, archive)),
        ...(Number.isFinite(span) && span > 1 ? { colSpan: Math.floor(span) } : {}),
        ...(background === undefined ? {} : { background }),
      }
    }),
  )
  return { kind: 'table', rows }
}

export function parseDocx(bytes: Uint8Array): ParsedDocx {
  if (bytes.byteLength === 0) throw new Error('DOCX 文件为空')
  if (bytes.byteLength > DOCX_COMPRESSED_MAX) throw new Error('DOCX 文件过大，无法在 Pane 中安全展开')
  let expanded = 0
  const archive = unzipSync(bytes, {
    filter(file) {
      const wanted = file.name === 'word/document.xml'
        || file.name === 'word/styles.xml'
        || file.name === 'word/numbering.xml'
        || file.name === 'word/_rels/document.xml.rels'
        || file.name.startsWith('word/media/')
      if (!wanted) return false
      expanded += file.originalSize
      if (expanded > DOCX_EXPANDED_MAX) throw new Error('DOCX 展开内容过大，已停止预览')
      return true
    },
  })
  const document = parseXml(archive['word/document.xml'], 'document')
  if (document === undefined) throw new Error('DOCX 缺少 word/document.xml')
  const styles = parseStyles(parseXml(archive['word/styles.xml'], 'styles'))
  const relationships = parseRelationships(parseXml(archive['word/_rels/document.xml.rels'], 'relationships'))
  const body = descendants(document.documentElement, 'body')[0]
  if (body === undefined) throw new Error('DOCX 正文不可用')
  const blocks: DocxBlock[] = []
  let paragraphs = 0
  let tables = 0
  for (const element of childElements(body)) {
    if (localName(element) === 'p') {
      blocks.push(parseParagraph(element, styles, relationships, archive))
      paragraphs += 1
    } else if (localName(element) === 'tbl') {
      blocks.push(parseTable(element, styles, relationships, archive))
      tables += 1
    }
  }
  return { blocks, paragraphs, tables }
}

export function isDocxFile(name: string, mediaType?: string): boolean {
  return mediaType?.toLowerCase() === DOCX_MEDIA_TYPE || name.toLowerCase().endsWith('.docx')
}

const docxStyles = `
.dwo-docx{flex:1 1 auto;min-height:0;overflow:auto;padding:18px;background:var(--vk-bg-base)}
.dwo-docx-page{box-sizing:border-box;max-width:900px;min-height:100%;margin:0 auto;padding:50px 58px 72px;border:1px solid var(--vk-border-l1);border-radius:10px;color:var(--vk-text-primary);background:var(--vk-bg-layer-1);box-shadow:0 14px 36px color-mix(in srgb,#000 18%,transparent);font:15px/1.8 ui-serif,Georgia,"Noto Serif CJK SC","Songti SC",serif}
.dwo-docx-meta{position:sticky;top:0;z-index:1;display:flex;gap:10px;justify-content:flex-end;max-width:900px;margin:0 auto 10px;color:var(--vk-text-tertiary);font-size:11px}
.dwo-docx p{margin:.2em 0 .78em;white-space:pre-wrap;overflow-wrap:anywhere;content-visibility:auto;contain-intrinsic-size:auto 34px}
.dwo-docx h1,.dwo-docx h2,.dwo-docx h3,.dwo-docx h4,.dwo-docx h5,.dwo-docx h6{margin:1.25em 0 .55em;line-height:1.35;font-family:inherit}.dwo-docx h1{font-size:1.75em}.dwo-docx h2{font-size:1.48em}.dwo-docx h3{font-size:1.25em}.dwo-docx h4{font-size:1.12em}
.dwo-docx-list{display:grid;grid-template-columns:auto minmax(0,1fr);gap:.65em;margin:.2em 0 .62em}.dwo-docx-list-marker{color:var(--vk-text-tertiary);font-variant-numeric:tabular-nums}
.dwo-docx-table-wrap{max-width:100%;overflow:auto;margin:1em 0;border:1px solid var(--vk-border-l2);border-radius:8px}.dwo-docx table{width:max-content;min-width:100%;border-collapse:collapse}.dwo-docx td{min-width:84px;padding:7px 9px;border-right:1px solid var(--vk-border-l2);border-bottom:1px solid var(--vk-border-l2);vertical-align:top}.dwo-docx tr:last-child td{border-bottom:0}.dwo-docx td:last-child{border-right:0}.dwo-docx td p{margin:0}
.dwo-docx img{display:block;max-width:100%;height:auto;margin:12px auto}.dwo-docx a{color:var(--vk-accent);text-decoration:underline;text-underline-offset:2px}
.dwo-docx-more{display:flex;justify-content:center;padding:18px}.dwo-docx-more button{min-height:34px;padding:0 14px;border:1px solid var(--vk-border-l2);border-radius:8px;color:var(--vk-text-primary);background:var(--vk-bg-layer-2);cursor:pointer}
@container yeisme-surface (max-width:560px){.dwo-docx{padding:8px}.dwo-docx-page{padding:26px 18px 44px;border-radius:7px;font-size:14px}}
`

function runStyle(run: Extract<RunToken, { kind: 'text' }>): CSSProperties {
  return {
    ...(run.bold === true ? { fontWeight: 700 } : {}),
    ...(run.italic === true ? { fontStyle: 'italic' } : {}),
    ...(run.underline === true || run.strike === true ? { textDecoration: [run.underline ? 'underline' : '', run.strike ? 'line-through' : ''].filter(Boolean).join(' ') } : {}),
    ...(run.color === undefined ? {} : { color: run.color }),
    ...(run.background === undefined ? {} : { backgroundColor: run.background }),
    ...(run.fontSize === undefined ? {} : { fontSize: `${Math.max(8, Math.min(48, run.fontSize))}pt` }),
    ...(run.vertical === 'super' ? { verticalAlign: 'super', fontSize: '.78em' } : run.vertical === 'sub' ? { verticalAlign: 'sub', fontSize: '.78em' } : {}),
  }
}

function renderRuns(runs: readonly RunToken[]): ReactNode[] {
  return runs.map((run, index) => {
    if (run.kind === 'break') return <br key={index} />
    if (run.kind === 'image') return <img key={index} src={run.src} alt={run.alt} loading="lazy" />
    const text = <span style={runStyle(run)}>{run.text}</span>
    return run.href === undefined ? <span key={index}>{text}</span> : <a key={index} href={run.href} target="_blank" rel="noreferrer">{text}</a>
  })
}

function renderParagraph(block: ParagraphBlock, key: string | number): ReactNode {
  const style: CSSProperties = {
    ...(block.align === undefined ? {} : { textAlign: block.align }),
    ...(block.firstLineEm === undefined ? {} : { textIndent: `${block.firstLineEm}em` }),
  }
  const content = renderRuns(block.runs)
  if (block.list !== undefined) {
    return <div className="dwo-docx-list" key={key} style={{ paddingInlineStart: `${(block.listLevel ?? 0) * 1.3}em` }}><span className="dwo-docx-list-marker" aria-hidden="true">{block.list === 'ordered' ? '1.' : '•'}</span><div style={style}>{content}</div></div>
  }
  const Heading = block.heading === undefined ? undefined : `h${block.heading}` as keyof JSX.IntrinsicElements
  return Heading === undefined ? <p key={key} style={style}>{content.length === 0 ? '\u00a0' : content}</p> : <Heading key={key} style={style}>{content}</Heading>
}

function renderBlock(block: DocxBlock, index: number): ReactNode {
  if (block.kind === 'paragraph') return renderParagraph(block, index)
  return <div className="dwo-docx-table-wrap" key={index}><table><tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex} colSpan={cell.colSpan} style={cell.background === undefined ? undefined : { background: cell.background }}>{cell.paragraphs.map((paragraph, paragraphIndex) => renderParagraph(paragraph, `${rowIndex}:${cellIndex}:${paragraphIndex}`))}</td>)}</tr>)}</tbody></table></div>
}

export interface DocxPreviewProps {
  readonly bytes: Uint8Array
  readonly title: string
}

/** Safe, path-free DOCX rich-text preview for a DSH file Pane. */
export function DocxPreview({ bytes, title }: DocxPreviewProps) {
  const [visibleBlocks, setVisibleBlocks] = useState(INITIAL_BLOCKS)
  useEffect(() => { setVisibleBlocks(INITIAL_BLOCKS) }, [bytes])
  const parsed = useMemo(() => {
    try { return { value: parseDocx(bytes) } as const }
    catch (error) { return { error: error instanceof Error ? error.message : String(error) } as const }
  }, [bytes])
  if ('error' in parsed) return <div className="dwo-docx" role="alert" data-dsh-docx-error>{parsed.error}</div>
  const remaining = Math.max(0, parsed.value.blocks.length - visibleBlocks)
  return <div className="dwo-docx" role="document" aria-label={`${title} 富文本预览`} data-dsh-docx-preview>
    <style>{docxStyles}</style>
    <div className="dwo-docx-meta"><span>{parsed.value.paragraphs} 段</span>{parsed.value.tables > 0 && <span>{parsed.value.tables} 个表格</span>}</div>
    <article className="dwo-docx-page">{parsed.value.blocks.slice(0, visibleBlocks).map(renderBlock)}</article>
    {remaining > 0 && <div className="dwo-docx-more"><button type="button" onClick={() => { setVisibleBlocks(count => count + BLOCK_STEP) }}>继续加载（剩余 {remaining} 段）</button></div>}
  </div>
}

export default DocxPreview
