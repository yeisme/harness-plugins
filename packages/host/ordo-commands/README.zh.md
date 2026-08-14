# @yeisme/dsh-host-ordo-commands

[English](README.md) | 中文

这个 Host 插件会在既有 `dsh-commands` runtime 与 `dsh-host-ordo-agent-ops` snapshot gateway 都已挂载时注册唯一的只读 `/ordo` 命令。它只读取 `ordoAgentOps.snapshot()`，不保存 Ordo 状态副本，也不创建 Ordo 服务。

可接受的语法是 `/ordo`、`/ordo help`、`/ordo status [safe-ref]`、`/ordo preview <safe-ref>` 与 `/ordo capacity`。ref 使用狭窄的不透明 token 语法：空值、`undefined`、空白、路径、URL 形式、scheme、绝对路径、控制字符和多余参数都会被拒绝。每个已接受的结果固定为四行：`Conclusion`、`Freshness / status`、`Safe refs / summary` 与 `Next action`。

`status` 与 `capacity` 只从可读的 `ready` 或 `stale` snapshot 暴露事实。owner context、owner source 或安全投影缺失时，命令返回既有的 fail-closed 状态，绝不输出 run 或 capacity 事实。`preview` 在已有 composition-preview source 挂载之前返回 `needs_contract`；本包不会创建该 source。

## 模型体验

无，因为 `/ordo` 绕过模型：不注册提示词或工具，也不写入 domain event，因此既有 `dsh-commands` runtime 只记录正常的 `command/run` 与 `command/done` 生命周期事件对。

#### KV Cache 影响

无；该命令不向模型输入贡献内容。

## 已知限制与暂缓工作

- 本包没有挂载 composition-preview source，因此 `/ordo preview <safe-ref>` 仍为 `needs_contract`。
- 该命令不执行 qualify、reconcile、approve、run、cancel、redispatch、capacity reservation、ticket 解析、进程启动或 provider 调用。
- snapshot gateway 仍负责 tenant/workspace 授权以及 owner 编写投影的脱敏。
