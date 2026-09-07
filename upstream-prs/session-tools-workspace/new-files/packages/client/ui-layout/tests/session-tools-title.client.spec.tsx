// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest'
import {cleanup,render} from '@testing-library/react'
import type {ComponentProps} from 'react'
import {Workbench} from '../src/client/Workbench.tsx'
import {emptyWorkspace,openPane} from '../src/client/workspace-model.ts'
afterEach(()=>{cleanup();vi.unstubAllGlobals()})
it('distinguishes same-name sessions and routes renamed titles only by explicit identity',()=>{
 vi.stubGlobal('ResizeObserver',class {observe(){} disconnect(){}})
 let layout=emptyWorkspace('project')
 for(const id of ['11111111-a','22222222-b'])layout=openPane(layout,{id:`tools:${id}`,kind:'mcp-inspector',sessionId:id,title:'Same · Tools',pinned:true})
 let sessions={phase:'ready',current:'22222222-b',ids:['11111111-a','22222222-b'],byId:{'11111111-a':{displayTitle:'Same',blank:false},'22222222-b':{displayTitle:'Same',blank:false}}}
 const updatePane=vi.fn()
 const props={
  useWorkspace:(select:(value:unknown)=>unknown)=>select({layout,catalog:[],commands:[],presets:[],catalogOpen:false}),
  useSessions:(select:(value:unknown)=>unknown)=>select(sessions),
  useWorkbenchProjects:(select:(value:unknown)=>unknown)=>select({phase:'ready',items:[]}),
  workspaceActions:{updatePane,showCatalog:vi.fn()},
  renderSlot:()=>null,SessionProvider:()=>null,presentSession:()=>()=>{},selectSession:vi.fn(),toggleNavigation:vi.fn(),t:(key:string)=>key==='wb.tools'?'Tools':key,
 } as unknown as ComponentProps<typeof Workbench>
 const view=render(<Workbench {...props}/> )
 expect(view.container.querySelector('[data-workspace-tab="tools:11111111-a"]')?.getAttribute('title')).toContain('11111111')
 expect(view.container.querySelector('[data-workspace-tab="tools:22222222-b"]')?.getAttribute('title')).toContain('22222222')
 updatePane.mockClear();sessions={...sessions,byId:{...sessions.byId,'11111111-a':{displayTitle:'Renamed A',blank:false}}}
 view.rerender(<Workbench {...props}/> )
 expect(updatePane).toHaveBeenCalledWith('tools:11111111-a',{title:'Renamed A · Tools'})
 expect(updatePane).toHaveBeenCalledWith('tools:22222222-b',{title:'Same · Tools'})
 expect(props.selectSession).not.toHaveBeenCalled()
})
