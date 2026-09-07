import { describe, expect, it, vi } from 'vitest'
import { bindPaneCommandUi } from '../src/client/pane-commands.js'

describe('browser pane command decorations', () => {
  it('opens the real MCP pane and rechecks current providers without invoking the Host', async () => {
    const decorations: any[] = [] // Capture the structurally probed commandUi seam in this fixture.
    const off = vi.fn()
    const openView = vi.fn()
    let views = [{ descriptor: { kind: 'mcp-inspector', label: 'Tools' } }]
    const pane = { openView, views: { snapshot: () => views } }
    const dispose = bindPaneCommandUi({ get: name => name === 'paneWorkbench' ? pane : { decorate: (entry: unknown) => { decorations.push(entry); return off } } })
    const mcp = decorations.find(entry => entry.name === 'mcp')
    expect(mcp.available()).toBe(true)
    const [choice] = await mcp.ui.options()
    mcp.ui.onSelect(choice)
    expect(openView).toHaveBeenCalledWith(expect.objectContaining({ kind: 'mcp-inspector', pinned: true, metadata: { tab: 'mcp' } }))
    views = []
    expect(mcp.available()).toBe(false)
    mcp.ui.onSelect(choice)
    expect(openView).toHaveBeenCalledTimes(1)
    dispose(); expect(off).toHaveBeenCalledTimes(3)
  })
  it('binds after commandUi appears and releases subscriptions on unload', () => {
    let ui: unknown
    let changed!: (service: string) => void
    const decorate = vi.fn(() => vi.fn()), off = vi.fn()
    const dispose = bindPaneCommandUi({ get: name => name === 'commandUi' ? ui : undefined, on: (_name, listener) => { changed = listener; return off } })
    ui = { decorate }; changed('commandUi')
    expect(decorate).toHaveBeenCalledTimes(3)
    changed('commandUi'); expect(decorate).toHaveBeenCalledTimes(3)
    dispose(); expect(off).toHaveBeenCalledOnce()
  })
})

it('opens the invoking Session tab rather than reading global current at selection time', async () => {
  const decorations:any[]=[],openSessionTools=vi.fn(()=>true),openView=vi.fn()
  const ctx={get:(name:string)=>name==='sessionTools'?{openSessionTools}:name==='commandUi'?{decorate:(entry:unknown)=>{decorations.push(entry);return ()=>{}}}:name==='paneWorkbench'?{openView,views:{snapshot:()=>[{descriptor:{kind:'mcp-inspector',label:'Tools'}}]}}:undefined}
  const dispose=bindPaneCommandUi(ctx)
  const mcp=decorations.find(row=>row.name==='mcp'),[choice]=await mcp.ui.options()
  mcp.ui.onSelect(choice,{sessionId:'source-a'})
  expect(openSessionTools).toHaveBeenCalledWith({sessionId:'source-a',presentation:'tab'})
  expect(openView).not.toHaveBeenCalled();dispose()
})
