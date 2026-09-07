## Why

Workbench 已有 `/agent` Spatial Surface、五种 Lens、viewport query、PixiJS/worker 渲染与 proposal-first 变更链，但当前体验仍更接近“可平移缩放的空间控制面”：远景 density 可能没有可见标记，导航控件不足，Creative/Director 信息挤在固定右栏，三档 LOD 无法同时覆盖全局导航与近景编辑，草稿也缺少持久、协作和正式化合同。需要在不恢复第二主壳、不复制 Owner 状态机的前提下，把它演进为可信、可搜索、可协作且能稳定承载 50k 对象的语义无限画布。

## What Changes

- 将 Spatial Surface 定义为“可信语义主画布 + 项目持久草稿层”：正式对象继续来自 Owner/Task/Proposal 投影，自由文本、便签、手绘、临时连线和 Frame 由 Workbench 作为 Draft 持有。
- 五个 Lens 保持核心能力齐平，但采用专业视觉语法：Creative、Workflow、Run、Review、Evidence 共享导航、搜索、草稿、提案、运行、评审、证据和导出合同，不强制使用相同节点布局。
- 新增四级语义缩放 `atlas | cluster | object | detail`、区域/泳道投影、可交互小地图、全局空间搜索、适配全景/选区、回到内容和跨 Lens 对象连续定位。
- 新增 Lens 独立布局投影：同一 Owner 对象共享稳定 identity，不同 Lens 独立保存共享空间布局；镜头、筛选和侧栏状态作为用户级项目偏好保存。
- 新增项目级版本化 Draft 文档、轻量实时 presence、expected revision/idempotency patch、撤销历史，以及“选择集打包提升”为 canonical `SpatialChangeSetProposalV1` 的流程。
- 重构 Spatial Focus 外壳：普通 `/agent` 请求保持 conversation-first；project/DSH/spatial ingress 默认 Spatial Focus；Agent composer 永远可见，1024px 桌面不再叠加固定 430px Lens 内栏。
- 固定 50k addressable objects 的有界性能姿态；Atlas/Cluster 不返回或渲染全量节点，Object/Detail 继续受 viewport、primitive、DOM 和关系预算约束。
- **兼容演进**：现有 `SpatialViewportQueryV2/ResponseV2` 与 `far | medium | near` 不改名、不重解释、不删除；并行新增 V3 contract/method/types。V2 移除不属于本 change。

## Owner-fit 与 Required Capability Ledger

| 能力 | Admission | 状态 | Canonical owner | Workbench 角色 | Delivery |
| --- | --- | --- | --- | --- | --- |
| Lens layout、camera preference、导航与控件 | `fit` | `required` | Workbench | 安全空间投影与用户视图偏好 | deliver-now |
| 四级语义缩放、region/cluster/density | `fit` | `required` | Workbench Spatial service | exact-revision viewport projection | deliver-now |
| 项目持久 Draft、undo、轻量 presence | `fit` | `required` | Workbench | Draft 文档与协作，不是领域真相 | deliver-now |
| Draft 选择集提升 | `fit` | `required` | ProposalAuthorityService + TaskService | 解析目标、展示影响并提交 canonical proposal | deliver-now |
| Creative/Workflow/Run/Review/Evidence 专业投影 | `split-owner` | `required` | 各领域 Owner | typed safe projection、approved action、receipt/deep link | staged by owner contract |
| Owner 内容、状态、依赖、审批与交付终态 | `split-owner` | `committed` | 对应 Owner | 只读/操作组合，不复制状态机 | existing boundary |
| 自由白板对象直接成为 canonical state | `reject-now` | `rejected-with-user-decision` | 未定义 | Draft 必须显式提升 | none |
| 完整实时白板、全员镜头强同步 | `reject-now` | `not-requested` | 未定义 | 仅轻量 presence | none |
| 移动端完整无限画布编辑器 | `reject-now` | `not-requested` | future client | 当前 Web 保持桌面编辑边界 | none |

## Capabilities

### New Capabilities

- `workbench-spatial-canvas-experience`: 定义 Agent-first contextual ingress、五 Lens 能力合同、控件体系、跨 Lens 定位、自适应上下文栏、可访问交互与 truthful degraded 状态。
- `workbench-spatial-viewport-v3`: 定义四级语义缩放、region/cluster/density 响应、精确 revision、50k 有界渲染预算，以及 V2/V3 并行兼容和回滚。
- `workbench-spatial-draft-collaboration`: 定义项目级 Draft 对象、版本化 patch/undo、轻量 presence、选择集提升与 ProposalAuthority/TaskService/Owner receipt 边界。

### Modified Capabilities

无。既有 `workbench-spatial-surface`、`workbench-agent-spatial-interaction`、`workbench-spatial-runtime-control` 和 `workbench-agent-proposal-authority` 继续保持 V2 与现有 mutation 语义；V3 通过并行合同和 capability flag 增量引入。

## Impact

- 预期实现范围：`api/proto/workbench/spatial/v1/**` 的 additive message/method、`packages/task-sdk` V3 exports/clients、`service/internal/spatial` 与 GORM repository、三 wire transport parity、`apps/web/src/workbench/agent/spatial/**`、locale、focused/component/Playwright/performance evidence。
- 新增持久化只包含 Lens layout、Draft 文档/event、用户 view preference、presence cursor/lease 的安全 refs 与 bounded metadata；不得保存 Owner payload、raw prompt、provider payload、credential、private path、artifact blob 或 chain-of-thought。
- Browser 仍只经 `WorkbenchClient` typed facade；正式业务 mutation 仍是用户确认 → 服务端重验 → ProposalAuthority/TaskService → Owner receipt/reconcile。
- 合同分类：RPC/API、protobuf 和公开 TypeScript API 均采用 additive V3；数据库采用新表/索引的 expand-only 迁移。V2 至少在 V3 GA 后保留一个发布周期，且本 change 不安排 removal release。
- 回滚：分别关闭 `spatialViewportV3`、`spatialDraftCollaboration`、`spatialPresence` 和 `spatialCanvasShellV3` capability，恢复 V2 查询与既有 Lens；新增表保留但停止读取，不需要破坏性反向迁移。
