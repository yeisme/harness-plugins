# @yeisme/dsh-client-ui-ordo-agent-ops

[English](README.md) | 中文

DSH Web 的只读紧凑 Agent Ops 侧栏贡献。本 Client 模块注册一个 `sidebar.footer.action` 条目，读取 Host 拥有的 `ordoAgentOps/snapshot` Remote，并渲染小型状态面板；它不导入 Ordo 或 Workbench 状态。

控制器只保留一个有界的进行中读取，在 connection reset 或 dispose 时推进 generation，并忽略旧 generation 的迟到结果。它还基于 `snapshotRef`/`snapshotVersion` 维护 snapshot 轴 cursor：重复 version 幂等忽略；ref 轮换或 version 回退时以安全的 `owner_cursor_drift` 错误 fail closed 且不展示任何事实，下一次读取会从新的权威 snapshot 重建 cursor 完成 reconcile。面板展示安全状态、freshness、reason 文案、可选的 run/capacity 摘要；在重新鉴权的 Workbench 深链合同存在前，Workbench 动作保持禁用。Host owner source 尚未挂载时，面板诚实展示 `needs_contract`。

## 模型体验

无。本包只提供浏览器 UI，不注册提示词、工具、模型请求或 session event。

#### KV Cache 影响

无；面板从不组装或发送模型输入。

## 已知限制与暂缓工作

- **仅限 snapshot 轴消费** —— cursor 只覆盖整体 snapshot 的重复抑制、version/ref 漂移 fail-close 与 reconcile 重读；Ordo 事件流订阅、事件序号 gap 检测与动作派发仍暂缓，等待 owner event 合同。
- **需要 owner 合同** —— fallback 不包含 run、lease、worktree、capacity 或 evidence 事实；持久租户授权与 Ordo projection 挂载仍由外部 owner 负责。
- **Workbench handoff 暂缓** —— 在平台提供重新鉴权、context-bound 的深链合同前，按钮保持禁用。
- **尚未接入 ToolView** —— inspect、approval、reconcile 与 evidence 展示属于后续 DSH 消费切片。
