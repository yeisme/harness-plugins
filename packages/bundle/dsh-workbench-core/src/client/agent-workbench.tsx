import { useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { Surface, SurfaceContextBar, SurfaceSection, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import type { AgentRoleId, WorkbenchContextController, WorkbenchContextId } from '../context.ts'
import { AGENT_ROLES, WORKBENCH_CONTEXTS } from '../context.ts'

export interface AgentWorkbenchProps {
  readonly controller: WorkbenchContextController
  readonly renderWorkspace: (context: WorkbenchContextId) => ReactNode
  readonly renderAgentPanel?: (context: WorkbenchContextId, role: AgentRoleId) => ReactNode
  readonly labels?: Partial<Record<WorkbenchContextId | AgentRoleId, string>>
}

const CONTEXT_LABELS: Record<WorkbenchContextId, string> = {
  writing: '剧作', storyboard: '分镜', production: '制作', review: '审阅',
  'three-d': '3D', assets: '资产', delivery: '交付',
}
const ROLE_LABELS: Record<AgentRoleId, string> = {
  director: '导演', writer: '编剧', producer: '制片人', modeler: '建模师', reviewer: '审阅者',
}

const styles = `
[data-dsh-agent-workbench]{display:grid;grid-template-columns:minmax(148px,18%) minmax(0,1fr) minmax(220px,28%);grid-template-rows:auto minmax(0,1fr) auto;width:100%;height:100%;min-height:0;background:var(--vk-bg-base)}
[data-dsh-agent-workbench-nav]{grid-row:1 / 4;min-width:0;overflow:auto;padding:12px;border-right:1px solid var(--vk-border-l1);background:var(--vk-bg-layer-1)}
[data-dsh-agent-workbench-main]{min-width:0;min-height:0;overflow:auto}
[data-dsh-agent-workbench-agent]{min-width:0;min-height:0;overflow:auto;border-left:1px solid var(--vk-border-l1);background:var(--vk-bg-layer-1)}
[data-dsh-agent-workbench-actions]{grid-column:2 / 4;display:flex;align-items:center;gap:8px;min-height:40px;padding:6px 12px;border-top:1px solid var(--vk-border-l1);background:var(--vk-bg-layer-1)}
[data-dsh-agent-workbench] .dsh-context-list,[data-dsh-agent-workbench] .dsh-role-list{display:grid;gap:4px;margin:0;padding:0;list-style:none}
[data-dsh-agent-workbench] .dsh-context-list button,[data-dsh-agent-workbench] .dsh-role-list button{width:100%;justify-content:flex-start;text-align:left}
@media (max-width:720px){[data-dsh-agent-workbench]{grid-template-columns:1fr;grid-template-rows:auto auto minmax(0,1fr) auto}[data-dsh-agent-workbench-nav]{grid-row:auto;border-right:0;border-bottom:1px solid var(--vk-border-l1);display:flex;gap:8px;overflow:auto}[data-dsh-agent-workbench-nav] .dsh-context-list{display:flex}[data-dsh-agent-workbench-nav] .dsh-context-list button{width:auto;white-space:nowrap}[data-dsh-agent-workbench-agent]{grid-row:2;border-left:0;border-bottom:1px solid var(--vk-border-l1);max-height:220px}[data-dsh-agent-workbench-actions]{grid-column:1}}
`

export function AgentWorkbench({ controller, renderWorkspace, renderAgentPanel, labels }: AgentWorkbenchProps): ReactNode {
  const subscribe = useMemo(() => controller.subscribe.bind(controller), [controller])
  const getSnapshot = useMemo(() => controller.getSnapshot.bind(controller), [controller])
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const label = (id: WorkbenchContextId | AgentRoleId): string => labels?.[id] ?? (id in CONTEXT_LABELS ? CONTEXT_LABELS[id as WorkbenchContextId] : ROLE_LABELS[id as AgentRoleId])
  return (
    <Surface kind="workspace" data-dsh-agent-workbench>
      <style>{styles}</style>
      <nav data-dsh-agent-workbench-nav aria-label="工作上下文">
        <SurfaceContextBar title="工作台" description={snapshot.projectRef} />
        <ul className="dsh-context-list">
          {WORKBENCH_CONTEXTS.map(context => <li key={context}><Button type="button" variant={context === snapshot.context ? 'primary' : 'toolbar'} aria-pressed={context === snapshot.context} onClick={() => { controller.setContext(context) }}>{label(context)}</Button></li>)}
        </ul>
        <SurfaceSection title="Agent 角色">
          <ul className="dsh-role-list">
            {AGENT_ROLES.map(role => <li key={role}><Button type="button" variant={role === snapshot.agentRole ? 'primary' : 'toolbar'} aria-pressed={role === snapshot.agentRole} onClick={() => { controller.setAgentRole(role) }}>{label(role)}</Button></li>)}
          </ul>
        </SurfaceSection>
      </nav>
      <main data-dsh-agent-workbench-main aria-label={label(snapshot.context)}>{renderWorkspace(snapshot.context)}</main>
      <aside data-dsh-agent-workbench-agent aria-label="Agent 面板">
        {renderAgentPanel?.(snapshot.context, snapshot.agentRole) ?? <SurfaceState phase="empty" title="等待 Agent 建议" description="当前面板只展示建议、草案和预览；执行仍需明确确认。" />}
      </aside>
      <div data-dsh-agent-workbench-actions role="status">
        <strong>下一步</strong>
        <span>{snapshot.pendingAction ?? '暂无待处理动作'}</span>
        {snapshot.freshness !== 'fresh' && <span aria-label="上下文新鲜度">· {snapshot.freshness}</span>}
      </div>
    </Surface>
  )
}
