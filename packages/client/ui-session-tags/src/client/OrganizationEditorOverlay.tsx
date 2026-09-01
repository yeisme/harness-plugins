/** Accessible quick function-type editor overlay. */

import { useSyncExternalStore } from 'react'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { Surface, SurfaceActionBar, SurfaceContextBar, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import type { OrganizationEditorController } from './organization-editor.ts'
import { sessionTagsOverlayStyles } from './styles.ts'

export function OrganizationEditorOverlay({ controller }: { readonly controller: OrganizationEditorController }) {
  // G21 dispose 收口：useSyncExternalStore 在卸载时调用 subscribe 返回的退订函数；
  // 绑定句柄显式携带 this（controller 是 class 实例）。
  const state = useSyncExternalStore(controller.subscribe.bind(controller), controller.getSnapshot.bind(controller))
  if (!state.open) return null
  return (
    <Modal open onClose={() => controller.close()} title="设置功能类型" headless>
      <Surface kind="dialog" data-session-tags className="session-tags-editor">
        <style>{sessionTagsOverlayStyles}</style>
        <SurfaceContextBar title="设置功能类型" context={state.sessionId} />
        <div className="ys-body">
          <label className="session-tags-entry ys-field"><span>功能类型</span><select autoFocus value={state.functionTypeId} disabled={state.phase === 'saving'} onChange={event => { controller.select(event.currentTarget.value) }}>{state.functions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          {state.phase === 'error' && <SurfaceState phase="error" title="保存失败" description={state.message} />}
        </div>
        <SurfaceActionBar className="session-tags-actions"><Button type="button" disabled={state.phase === 'saving'} onClick={() => { controller.close() }}>取消</Button><Button type="button" variant="primary" className="primary" disabled={state.phase === 'saving' || state.functionTypeId === ''} onClick={() => { void controller.save() }}>{state.phase === 'saving' ? '保存中…' : '保存'}</Button></SurfaceActionBar>
      </Surface>
    </Modal>
  )
}
