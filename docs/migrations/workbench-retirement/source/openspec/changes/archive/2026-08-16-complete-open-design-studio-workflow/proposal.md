## Why

现有 Open Design Studio 已完成高保真工作区、只读安全投影、文件预览与多 Pane 交互，但生成、候选比较、审查决策、修订和交付仍停在 `needs_contract`，用户无法完成真实设计闭环。现在需要把体验基线推进为可长期维护的单用户生产工作流，并用统一 Task 控制面承接所有副作用、恢复和审计语义。

## What Changes

- 建立从 Brief、References、Prompt 到 Candidate、Review、Revision、Handoff、Export 的完整项目工作流，并提供可恢复的显式状态机。
- 扩展 `WorkbenchDesignService` 的安全只读 projection，覆盖 prompt version、reference、candidate lineage、review evidence、handoff manifest 与 workflow summary。
- 将 `design.prompt.save`、`design.candidate.generate`、`design.candidate.cancel`、`design.review.decide`、`design.handoff.prepare`、`design.handoff.export` 注册为标准 Operation；所有写入统一经过 TaskService 的 permission、cost、expected-version、idempotency、event、receipt 与 reconcile 机制。
- 通过版本化 Open Design owner connector 执行真实 mutation；Workbench 不保存 raw prompt、provider payload、credential、artifact blob 或 owner canonical state。
- 完成 Prompt Library、Candidate Compare、Review Evidence、Handoff 与 Activity/Evidence 页面，使用户可编辑、生成、比较、审查、请求修订、校验并导出。
- 增加断线重连、SSE cursor 恢复、版本冲突、partial result、unknown accept、owner offline、contract mismatch、权限/成本 gate 和损坏布局恢复流程。
- 建立合同、组件、集成、浏览器 E2E、安全、可访问性和脱敏 evidence 发布门禁；主工作流不得再依赖 `needs_contract`。
- 保持现有 `v1alpha1` Task/Design 服务 additive 兼容，不删除、不重命名已发布字段和方法。

## Capabilities

### New Capabilities

- `open-design-studio-production-workflow`: 定义完整设计工作流、读写合同、状态转换、候选比较、审查修订、交付导出、恢复、安全和发布验收行为。

### Modified Capabilities

无。现有 `open-design-studio-experience` 是未归档的体验基线变更，本变更以独立 production capability 承接后续功能，避免把已完成的只读纵切片重新解释为完整产品。

## Impact

- **Web**：`apps/web/src/studio/**`、路由、查询缓存、命令面板、Dockview panel、响应式与可访问性测试。
- **SDK/合同**：`packages/task-sdk/**`、`proto/**`、`schemas/**`、HTTP/gRPC/JSON-RPC projection 与 Operation parity。
- **服务端**：`service/internal/design/**`、`service/internal/adapters/**`、`service/internal/registry/**`、Task reconcile 与事件投影；正常构建保持 `CGO_ENABLED=0`。
- **Owner 依赖**：Open Design 必须提供版本化、机器可校验的 prompt/candidate/review/handoff read-write contract；若 owner 尚未具备，先在 owner 子项目完成独立 OpenSpec handoff，Workbench 不以 CLI 文本解析或本地伪状态替代。
- **数据**：不新增设计正文或 artifact 持久化；仅保存既有 Task metadata、attempt、event index、safe refs 和 receipt ref。
- **兼容与回滚**：新增 capability、RPC、route、model 和 Operation 均为 additive；禁用 connector 或回滚 Web feature flag 后恢复只读 Studio，已有 Task 与布局数据不需迁移。
