export function MediaPreviewPane({ media = [], title = 'Media' }: { media?: readonly { title: string }[]; title?: string }) {
  return <section data-test-media-preview><h2>{title}</h2>{media.map(item => <span key={item.title}>{item.title}</span>)}</section>
}

export { MediaCompareRenderer, MediaImageRenderer, MediaPlaybackRenderer } from '../../../bundle/dsh-rich-media/src/client/media-renderers.tsx'
export { parseDelimitedTable } from '../../../bundle/dsh-rich-media/src/client/preview/csv-parse.ts'
export function LocalTableGrid({ rows }: { readonly rows: readonly (readonly string[])[] }) {
  return <table data-dsh-local-table><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table>
}
