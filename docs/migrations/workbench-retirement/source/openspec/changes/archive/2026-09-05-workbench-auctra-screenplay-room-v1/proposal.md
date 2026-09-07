## Why

Workbench 已有 Agent-first shell、Spatial Focus、统一 Pane/context rail 和 OwnerService，但 Auctra 目前仍是 `needs_contract`，只能显示 fixture 或元数据级占位。个人编剧/OPC 无法在统一界面中完成“定位并重排 Scene → 编辑 Scene Card/Beat → 查看剧情约束 → 写单场正文 → 提交 review”的可视化闭环。

本变更消费 Auctra 新的 `auctra.screenplay_room.v1alpha1` owner contract，把正式编剧室放进现有 `/agent` Spatial Focus，而不是恢复 Auctra GUI、创建第二主壳或复制剧本状态机。

## What Changes

- 新增 Auctra owner connector：通过 loopback-only `WORKBENCH_AUCTRA_URL` 读取 discovery/schema digest/capabilities，验证 exact contract，再提供 room、scene、context、events、receipt/status/reconcile 投影。
- 新增 typed `AuctraScreenplayRoomClient` 与 normalizer；所有未知 enum、schema drift、unsafe ref、正文越权、stale、offline、partial 和 `unknown_accept` 均 fail closed。
- 在 `/agent` Spatial Focus 的 Creative Production 内新增 Screenplay Room 专业子模式。它替换中央通用空间画布，但保留 Agent timeline/composer、TaskService、ProposalAuthority 和统一 context rail。
- 主面使用上下同步双轨：上层是可拖拽叙事顺序，下层是故事时间锚点/关系；支持项目/全片、集/幕与 sequence、Scene、Beat 四级语义缩放。
- Scene 卡默认只显示标题、场景功能、主角/地点、故事时间、状态变化、review/blocker 和受权限约束的缩略图；完整合同、关系与证据进入 context rail。
- 选择 Scene 后，Context Graph 默认聚焦直接约束，但保留跨人物、地点、知识、义务、setup/payoff、状态变化的全量搜索与渐进展开；图谱选择反向高亮出现它的 Scene，不重排时间线。
- 结构拖拽在 pointer-up 后提交 Auctra atomic patch；pending 使用 ghost placement，receipt 前不乐观声明保存。冲突保留本地意图并提供 compare/refetch，`unknown_accept` 只允许 reconcile。
- Scene Card 在 Inspector 内编辑；正文进入“专注写作”模式，中央显示单场 Fountain draft，时间线压缩为顶部定位带。正文复用 Auctra `text.draft.open/save/submit`，不在浏览器解析或持久化 Canon。
- 人工结构/Scene Card/正文 draft 可以显式保存；Agent 建议只显示 change-set ghost，通过 ProposalAuthority/TaskService 接受后才执行 owner action。
- 视觉统一到 Workbench design tokens、共享 surface/status/recovery/empty components 和受控 icon registry。图片只作为 accepted/candidate content evidence；缺图时使用文字首字母和语义图标，不生成假头像。
- `>=1024px` 支持创作；移动端只提供可搜索时间线、Scene 摘要、评论/review/approve 和 truthful owner state，不挂完整拖拽/正文编辑器。

本变更没有 **BREAKING** surface。新模式、SDK 类型、connector config 与 capability 均为 additive，旧 Creative Production、Spatial Lens、Pane 和 owner `needs_contract` 降级路径继续可用。

## Capabilities

### New Capabilities

- `workbench-auctra-screenplay-room`: Auctra 编剧室的正式 Workbench UI、双时间线、Scene/Beat 交互、Context Graph、专注写作、owner action 与响应式审阅。

### Modified Capabilities

- `owner-backend-integrations`: 增加 Auctra exact-contract connector、read/events 与 selected mutation canary，并保持未配置/未晋级时 `needs_contract`。
- `workbench-agent-spatial-interaction`: Creative Production 可切换到 Screenplay Room 专业主面；选择、缩放、拖拽、focus 和 context rail 仍遵循同一 Spatial 交互合同。
- `workbench-agent-ui-unification`: 新编剧室必须复用共享 tokens、icon registry、surface/status/empty/recovery、中文优先和技术 metadata 规则。

## Impact

- Web：`apps/web/src/workbench/agent/spatial/creative-production/**`、design-system icon registry、i18n source 和 browser tests。
- SDK/BFF：`packages/task-sdk` 增加 Auctra room types/client；Bun BFF 只代理 Workbench service，不向浏览器暴露 owner URL/token。
- Go service：`service/internal/owners/auctra` connector、owner catalog/config、read/event adapter，以及经 TaskService 的 mutation/receipt/status/reconcile 路由。
- 公共 surface：新增 optional config `WORKBENCH_AUCTRA_URL`、additive SDK exports 和 capability flags；不新增独立 `/screenplay` 页面。
- 验证：Vitest/Testing Library、Go connector/registry tests、Playwright 1440/1024/390/200% 矩阵、Axe/reduced-motion、真实 Auctra loopback integration evidence。
