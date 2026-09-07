# 03 · active-change UI 兼容矩阵（task 1.4）

逐项对照 Text Development Studio 与五个 active change / Spatial V3 的关系。列：复用组件 · owner 状态 · blocked 外部 · 不得重复实现。状态数字为 2026-09-05 `openspec list` 快照。

| Change | 复用组件 | owner 状态 | blocked 外部 | 不得重复实现 |
| --- | --- | --- | --- | --- |
| `workbench-agent-chat-canvas-convergence-v2`（42/54） | 自适应 shell 与 layout v2 reducer（Text Development document 是中央 dock 的又一种 document）；pending selection → 显式附加语义与 soft-follow 约束；sealed turn intent 沿 `workbench.agent.turn.submit.v1`；Conversation typed client/BFF 与 Profile 确认 UX | Conversation Runtime 合同 `workbench.conversation.v1alpha1` 已冻结可消费（`details/02-owner-contract-digests.md` §1）；shell/selection/candidate 主链 42/54 在制 | 真实 Pi/OMP runtime 的剩余 rollout 门（change 内未完任务） | conversation client/normalizer、turn submit 控制链、layout reducer、shell chrome、context rail 四 tab 结构——text-dev 只注册 document/Lens，不改 shell |
| `workbench-auctra-screenplay-room-v1`（24/32） | 6.3 将 Screenplay Room 接入共享 Lens host（不复制其 state/components）；复用其 candidate-only 语义与 atomic patch 的 ghost/receipt 模式 | Web surface lane 完成（24/32）；真实 owner 合同经 loopback discovery 前保持 `needs_contract` | Auctra loopback owner 服务 + 双 owner canary 签收（lane C 后剩余 8 项） | 剧本结构状态机、Scene/Beat/Scene Card/Context Graph 投影、Fountain 正文 draft open/save/submit——Novel/通用文本面不得复制；Screenplay lens 归此 change |
| `workbench-harness-studio-v1`（19/22） | typed view/action/resource/receipt/reconcile 消费语义；若未来文本域以插件面呈现，走其 plugin surface/sandbox 契约（当前 text-dev 为 first-party lens，不新增 plugin surface） | 19/22 在制 | 剩余安全/性能/E2E 验收门 | 插件 sandbox/iframe 隔离、descriptor 体系、tenant/workspace 上下文与缓存重置规则 |
| `workbench-dsh-ai-drama-bridge-consumer-v1`（12/13） | ingress 的 re-auth/replay/reconcile 模式作为 owner adapter 参照；其 conformance fixtures 参与 4.7 diff 语义清点 | 12/13 | 唯双 owner canary 签收；DSH 侧同版本 fixture 全绿才 rollout-ready | DSH envelope/nonce/launchRef 校验与 intent→lens 映射——text-dev 不经 DSH 桥 |
| `workbench-spatial-canvas-experience-v3`（23/24） | 无直接复用（text-dev 是文本域 lens，不进 spatial viewport）；遵守其"不恢复第二主壳"约束与响应式预算互斥规则（1024px 桌面不加固定内栏） | 23/24 | 剩余 perf/收口门 | 空间 Draft/presence/minimap/四级语义缩放体系——text-dev 不建第二画布 |

## Text Development 自身边界（对照原则）

- capability off 时与 `details/01-agent-shell-baseline.md` 逐项一致；palette 无入口、intent fail closed。
- 所有 Agent 修改先成为 candidate（one adaptive review flow），accept 只更新 Working Copy，经 ProposalAuthority/TaskService。
- 正文/revision 归 Auctra（`auctra.text_working_copy.v1alpha1`，`needs_contract`，见 `details/02` §3）；Team 归 Ordo（`ordo.workbench.team_control.v1alpha1`，`needs_contract`，见 `details/02` §4）。
- 新组件准入遵循 `docs/design/workbench-ui-governance.md`（UI Contract 登记、现有 primitive/composite、无平行 token/组件）。

## Validation

- OpenSpec strict：`openspec validate workbench-text-development-studio-v1 --strict --no-interactive` → valid。
- docs link check：对本 change `details/` 三份文档与 1.1 三份 docs 中的相对链接逐个解析目标存在性（脚本化检查，结果见提交时 evidence）。
