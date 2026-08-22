/**
 * Opened-file content tab. Codex-style: the explorer stays put, this view
 * is the file body opened from a tree click. Markdown renders by default;
 * a header button switches to the source view.
 *
 * @module @yeisme/dsh-client-ui-desktop-workbench/client
 */

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { FileEntryV1 } from '@yeisme/dsh-file-document'
import type { FileHostV1 } from '@yeisme/dsh-file-host'
import { isMarkdownEntry, renderMarkdown } from './file-markdown.ts'

export interface FileOpenPaneProps {
  readonly host: FileHostV1
  readonly entry: FileEntryV1
}

const styles: Record<string, CSSProperties> = {
  root: {
    display: 'grid',
    gridTemplateRows: 'auto minmax(0, 1fr)',
    minHeight: '100%',
    color: 'var(--dsw-alias-label-primary, #f2f2f4)',
    fontFamily: 'var(--dsw-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)',
    fontSize: 'var(--dsh-wb-font-size, 14px)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    borderBottom: '1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.12))',
  },
  title: { margin: 0, fontSize: 'calc(var(--dsh-wb-font-size, 14px) + 1px)', fontWeight: 680, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  meta: { color: 'var(--dsw-alias-label-tertiary, #92929b)', fontSize: 'calc(var(--dsh-wb-font-size, 14px) - 2px)' },
  actions: { marginLeft: 'auto', display: 'flex', gap: 6 },
  button: {
    minHeight: 28,
    padding: '0 10px',
    borderRadius: 7,
    border: '1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.12))',
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
    font: 'inherit',
  },
  buttonActive: {
    background: 'var(--dsw-alias-button-ghost-active-fill, #343438)',
  },
  body: {
    minHeight: 0,
    overflow: 'auto',
    padding: 14,
    margin: 0,
    font: 'var(--dsh-wb-font-size, 14px)/1.55 ui-monospace, SFMono-Regular, Menlo, monospace',
    whiteSpace: 'pre-wrap',
  },
  markdown: {
    minHeight: 0,
    overflow: 'auto',
    padding: '16px 18px 24px',
    lineHeight: 1.65,
  },
  image: { display: 'block', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', margin: 16 },
  empty: { padding: 18, color: 'var(--dsw-alias-label-tertiary, #92929b)' },
}

const markdownStyles = `
[data-dsh-file-markdown] h1,[data-dsh-file-markdown] h2,[data-dsh-file-markdown] h3{margin:1.1em 0 .45em;line-height:1.25;font-weight:680}
[data-dsh-file-markdown] h1{font-size:1.45em}[data-dsh-file-markdown] h2{font-size:1.25em}[data-dsh-file-markdown] h3{font-size:1.1em}
[data-dsh-file-markdown] p,[data-dsh-file-markdown] ul,[data-dsh-file-markdown] ol,[data-dsh-file-markdown] blockquote{margin:0 0 .85em}
[data-dsh-file-markdown] ul,[data-dsh-file-markdown] ol{padding-left:1.4em}
[data-dsh-file-markdown] code{padding:.1em .35em;border-radius:5px;background:var(--dsw-alias-bg-layer-1,#232324);font:0.92em/1.45 ui-monospace,SFMono-Regular,Menlo,monospace}
[data-dsh-file-markdown] pre{overflow:auto;padding:12px;border-radius:8px;background:var(--dsw-alias-bg-layer-1,#232324)}
[data-dsh-file-markdown] pre code{padding:0;background:transparent}
[data-dsh-file-markdown] a{color:var(--dsw-alias-state-business-primary,#79a8ff)}
[data-dsh-file-markdown] blockquote{padding-left:12px;border-left:3px solid var(--dsw-alias-border-l3,rgba(255,255,255,.16));color:var(--dsw-alias-label-secondary,#c6c6cb)}
[data-dsh-file-markdown] hr{border:0;border-top:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.12));margin:1.2em 0}
`

export function FileOpenPane({ host, entry }: FileOpenPaneProps) {
  const markdown = isMarkdownEntry(entry)
  const [text, setText] = useState<string>()
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState(false)
  const previewUrl = host.resolvePreviewUrl?.(entry)
  const html = useMemo(() => (markdown && text !== undefined && !source ? renderMarkdown(text) : undefined), [markdown, source, text])

  useEffect(() => {
    let live = true
    setLoading(true)
    setError(undefined)
    setText(undefined)
    setSource(false)
    if (entry.kind === 'image' && previewUrl !== undefined) {
      setLoading(false)
      return () => { live = false }
    }
    if (host.readText === undefined) {
      setLoading(false)
      setError('文件服务尚未提供读取能力。')
      return () => { live = false }
    }
    void host.readText(entry).then(result => {
      if (!live) return
      setLoading(false)
      if (result === undefined) {
        setError('无法读取该文件。')
        return
      }
      if (result.binary) {
        setError('二进制文件不支持文本预览。')
        return
      }
      setText(result.content)
    }, caught => {
      if (!live) return
      setLoading(false)
      setError(caught instanceof Error ? caught.message : String(caught))
    })
    return () => { live = false }
  }, [host, entry, previewUrl])

  const showSource = !markdown || source
  return (
    <section data-dsh-file-open-pane data-file-id={entry.id} data-file-view={showSource ? 'source' : 'preview'} style={styles.root}>
      <style data-dsh-file-markdown-styles>{markdownStyles}</style>
      <header style={styles.header}>
        <h2 style={styles.title}>{entry.name}</h2>
        <span style={styles.meta}>{entry.mediaType ?? entry.kind}</span>
        <div style={styles.actions}>
          {markdown && (
            <button
              type="button"
              data-dsh-file-source-toggle
              aria-pressed={source}
              style={{ ...styles.button, ...(source ? styles.buttonActive : {}) }}
              onClick={() => { setSource(value => !value) }}
            >
              {source ? '预览' : '源文件'}
            </button>
          )}
        </div>
      </header>
      {loading && <p style={styles.empty}>正在打开文件…</p>}
      {error !== undefined && <p role="alert" style={styles.empty}>{error}</p>}
      {entry.kind === 'image' && previewUrl !== undefined && (
        <img style={styles.image} src={previewUrl} alt={entry.name} data-dsh-file-open-image />
      )}
      {html !== undefined && (
        <div
          data-dsh-file-markdown
          data-dsh-file-open-preview
          style={styles.markdown}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
      {text !== undefined && showSource && <pre style={styles.body} data-dsh-file-open-text>{text}</pre>}
    </section>
  )
}

export default FileOpenPane
