/** Session-addressed shell navigation; owns no conversation data or persistence. */
export class ConversationNavigation {
  private readonly mounted = new Map<string, (view: string, focus: string) => void>()
  private readonly pending = new Map<string, { view: string; focus: string }>()
  private disposed = false
  constructor(private readonly show: (sessionId: string) => boolean) {}
  open(sessionId: string, view: string, focus = ''): boolean {
    if (this.disposed || !this.show(sessionId)) return false
    const target = this.mounted.get(sessionId)
    if (target) target(view, focus)
    else this.pending.set(sessionId, { view, focus })
    return true
  }
  bind(sessionId: string, target: (view: string, focus: string) => void): () => void {
    if (this.disposed) return () => {}
    this.mounted.set(sessionId, target)
    const pending = this.pending.get(sessionId)
    if (pending) { this.pending.delete(sessionId); target(pending.view, pending.focus) }
    return () => { if (this.mounted.get(sessionId) === target) this.mounted.delete(sessionId) }
  }
  dispose(): void { this.disposed = true; this.mounted.clear(); this.pending.clear() }
}
