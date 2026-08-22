export function MediaPreviewPane({ media = [], title = 'Media' }: { media?: readonly { title: string }[]; title?: string }) {
  return <section data-test-media-preview><h2>{title}</h2>{media.map(item => <span key={item.title}>{item.title}</span>)}</section>
}
