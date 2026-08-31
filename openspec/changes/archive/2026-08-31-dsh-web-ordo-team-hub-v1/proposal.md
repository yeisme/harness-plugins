## Why

现有 DSH Ordo Agent Team Pane 侧重安全只读 run/DAG 投影，尚不能承载已确认的任务协作、handoff、Room、Activity 与 TUI/Web 控制交接。Web 需要升级为 Ordo Team V1 的完整客户端，但必须继续由 Harness Host 绑定上下文和凭据，浏览器不能成为领域状态或 broker authority。

## What Changes

- 在现有 Agents 入口中增加 `Session Agents` 与 `Ordo Teams` 两个明确视图，不新建独立 Web 客户端。
- 新增 Ordo Team Delivery 工作区：Task Queue、zoomable Task-Agent graph、Inspector、Room、Activity、control holder 与 typed Action Palette。
- `1024px+` 使用三栏图优先布局，`768–1023px` 使用主区加 drawer；`<768px` 不承诺移动端编辑体验，但保留可读列表和明确提示。
- Harness Host adapter 负责 snapshot、event cursor、context binding、backoff、token isolation、action preview/dispatch 与 disposal；浏览器只收到 bounded safe projection。
- Web 与 TUI 对 Ordo Team V1 使用同一 capability/action/receipt 语义；Session Agents 仍依赖 DSH Host 已有能力。
- 大图采用 clustering/LOD，active、blocked、critical-path 始终可发现；提供键盘选择、语义列表、非颜色状态和 reduced-motion。
- 未知 liveness、stale cursor、expired approval、lost control、context drift 或 unsafe projection 必须禁用 mutation 并显示 owner recovery action。

## Capabilities

### New Capabilities

- `dsh-web-agents-hub`: Agents 统一入口、Session Agents/Ordo Teams 分视图、Delivery selection 与 fallback。
- `dsh-web-team-task-agent-graph`: Task-Agent graph、Task Queue、LOD、selection、Inspector 与跨对象关系。
- `dsh-web-team-collaboration-accessibility`: keyboard、semantic list、focus、reduced-motion、responsive 和安全 degraded states。

### Modified Capabilities

- `dsh-ordo-agent-team-pane`: 从 run/DAG 投影扩展为 Ordo Team V1 协作工作区，同时保持 Ordo canonical authority。
- `dsh-pane-agents-entry`: Agents 入口打开统一 Hub，并在 host seam 缺失时诚实禁用。
- `pane-event-runtime`: 增加 snapshot-first、cursor replay、gap reload、generation disposal 与 surface control event。
- `workspace-capability-matrix`: 增加 Ordo Team V1 capability/action parity 与 Session Agents host-dependent 标记。

## Impact

- 后续实现主要影响 Ordo Agent Ops Host/Client packages、Agents entry、pane event runtime、bundle wiring、visual fixtures 与 cookbook。
- 浏览器不直接连接 Ordo CLI、不接收 bearer token/绝对路径/raw prompt/provider payload，也不创建本地 task、lease 或 approval store。
- 新能力依赖 `agent/ordo/openspec/changes/ordo-team-collaboration-v1/`；旧 Ordo Ops pane 可作为 capability 缺席时的兼容 fallback。

