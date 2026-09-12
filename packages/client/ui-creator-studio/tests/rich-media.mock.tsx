export function MediaPreviewPane({ media = [], title = 'Media' }: { media?: readonly { title: string }[]; title?: string }) {
  return <section data-test-media-preview><h2>{title}</h2>{media.map(item => <span key={item.title}>{item.title}</span>)}</section>
}

export { MediaCompareRenderer, MediaImageRenderer, MediaPlaybackRenderer } from '../../../bundle/dsh-rich-media/src/client/media-renderers.tsx'
export { StaticHtmlPreview } from '../../../bundle/dsh-rich-media/src/client/preview/static-html.tsx'
export { parseDelimitedTable } from '../../../bundle/dsh-rich-media/src/client/preview/csv-parse.ts'
export function LocalTableGrid({ rows, columns }: { readonly rows: readonly (readonly string[])[]; readonly columns?: readonly { label: string }[] }) {
  if (columns === undefined) throw new Error('Creator table preview must supply the existing grid column schema')
  return <table data-dsh-local-table><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table>
}

export { LOCAL_TABLE_BUDGET, columnsFromHeaderRow } from '../../../bundle/dsh-rich-media/src/client/preview/local-table.tsx'
