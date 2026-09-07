/** Browser navigation decorates Host menu rows instead of executing a Host-only pane probe. */
interface PaneChoice { readonly id: string; readonly label: string }
interface PaneService {
  views: { snapshot(): readonly { descriptor: { kind: string; label: string; role?: string; preferredRegion?: string; retention?: string; singleton?: boolean }; showInPicker?: boolean }[] }
  openView(input: Record<string, unknown>): unknown
}
interface CommandUi {
  decorate(input: {
    name: string
    available(): boolean
    ui: { kind: 'popupSelect'; options(): Promise<readonly PaneChoice[]>; onSelect(option: PaneChoice, session?: { sessionId?: string }): void }
  }): () => void
}
interface Context {
  get(name: string): unknown
  on?(name: string, callback: (service: string) => void, options: { global: true }): () => void
}
const TARGETS: Readonly<Record<string, string | undefined>> = { mcp: 'mcp-inspector', explorer: 'dsh.explorer', pane: undefined }

export function bindPaneCommandUi(ctx: Context): () => void {
  const get = (name: string): unknown => { try { return ctx.get(name) } catch { return undefined } }
  const pane = (): PaneService | undefined => {
    const candidate = get('paneWorkbench') as Partial<PaneService> | undefined
    return typeof candidate?.views?.snapshot === 'function' && typeof candidate.openView === 'function' ? candidate as PaneService : undefined
  }
  let current: CommandUi | undefined
  let registrations: Array<() => void> = []
  const bind = (): void => {
    const next = get('commandUi') as CommandUi | undefined
    if (next === current) return
    for (const off of registrations) off()
    registrations = []; current = next
    if (typeof next?.decorate !== 'function') return
    for (const [name, kind] of Object.entries(TARGETS)) {
      const choices = () => pane()?.views.snapshot().filter(row => kind === undefined ? row.showInPicker !== false : row.descriptor.kind === kind) ?? []
      registrations.push(next.decorate({ name, available: () => choices().length > 0,
        ui: { kind: 'popupSelect', options: async () => choices().map(row => ({ id: row.descriptor.kind, label: row.descriptor.label })),
          onSelect(option, session) {
            const service = pane()
            const row = choices().find(row => row.descriptor.kind === option.id)
            if (!service || !row) return
            if (name === 'mcp') {
              const tools = get('sessionTools') as { openSessionTools?(input: { sessionId?: string; presentation: 'tab' }): boolean } | undefined
              if (tools?.openSessionTools) { tools.openSessionTools({ ...(session?.sessionId ? { sessionId: session.sessionId } : {}), presentation: 'tab' }); return }
            }
            const descriptor = row.descriptor
            service.openView({ kind: descriptor.kind, resourceKey: `command:${descriptor.kind}`, role: descriptor.role ?? 'inspector', preferredRegion: descriptor.preferredRegion ?? 'right', retention: descriptor.retention ?? 'keep-alive', singleton: descriptor.singleton ?? true, title: descriptor.label, pinned: true, ...(name === 'mcp' ? { metadata: { tab: 'mcp' } } : {}) })
          },
        },
      }))
    }
  }
  bind()
  const offService = ctx.on?.('internal/service', service => { if (service === 'commandUi') bind() }, { global: true })
  return () => { offService?.(); for (const off of registrations) off(); registrations = [] }
}
