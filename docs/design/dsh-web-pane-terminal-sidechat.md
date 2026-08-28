# dsh web pane：终端与侧边对话设计

> 状态：实施见 OpenSpec `openspec/changes/dsh-web-pane-terminal-sidechat-v1/`（2026-08-28）。
> 用途：回答"dsh web pane 怎么现在就有可用的终端和侧边对话"，并固化两条 lane 的通道选择与降级矩阵。

## 1. 终端：官方 `ctx.terminals` 行式投影，不再等 duplex seam

上游 master（0.1.1-rc.2）已落地 agent-owned 持久 PTY 家族（`packages/terminal/`：`ctx.terminals` 注册表 + `terminal-bash` 后端 + 六个模型工具），但只面向工具调用，浏览器无入口；原始 VT duplex 被上游明确 defer（全屏应用、keystroke 序列）。本仓的通道选择：

- **PTY owner 永远是官方服务**。`@yeisme/dsh-terminal-host` 插件动态注入 `ctx.terminals`/`ctx.agents`（结构化探测，无对未发布包的 npm 依赖），把官方 owner-scoped 合同投影为 `terminalPane` Typert Remote（`probe/list/spawn/read/send/signal/close`）。插件零 PTY 实现，符合 `docs/plugin-host-protocol.md`（PTY duplex 属 host 职责，不进插件）。
- **owner 解析**：`ctx.agents.get(sessionId)`（agent id = session id 同轴）。spawn/list 要求 live agent；read/send/signal/close 校验 sessionId 即终端 owner（`not_owner` fail-closed）。终端生命周期跟随 agent-scope disposal，与官方语义一致。
- **浏览器侧**：client `$mount` 自挂 `terminalPane` 命名空间（与 sessionTags/tokenUsage 同通道），console 视图 `dsh-terminal.console` + `/terminal` 命令。滚回重读由绑定 session 的 ConversationSnapshot 变化事件驱动（工具调用完成 → 重读），无定时轮询。
- **send 语义**：官方单 send 保留；等待触顶（60s）按官方取消语义 SIGINT 中断并标注 `cancelledByWaitTimeout`，不遗留 active send。
- **xterm 路径不变**：`TerminalPanel`/`TerminalHostV2` 探针门保留给未来官方 duplex seam（Tier 2），两者并存。

降级矩阵：DSH < 0.1.1-rc.2 → probe `serviceAvailable:false`，视图与命令禁用 + "需要带 terminals 能力的 DSH"；形状漂移 → probe reason 列缺失方法；Remote 不可达（无 `$mount` 旧 runtime）→ 视图禁用 + 原因。

## 2. 侧边对话：官方 client services，主选择不动

用户要的是"侧边栏里并行对话另一个 session"。官方 client runtime 已有全部数据面：`ISessions.binding(id)` 返回任意 session 的 `SessionFace`（`prompt/cancel` + `ConversationSnapshot` 订阅）、`fork()` 可无痕开子会话、runtime 另有 `create()`（未上 `ISessions` 公开面，结构化探测）。

- **主选择不变量（spec 级）**：side chat 任何路径不得调用 `sessions.open()/openSubagent()/clear()`；controller 不持有这些方法的引用，包测试以 open 计数断言钉死。
- **三径**：picker 附着既有 session；"新建会话"（`create` 探测通过才可用，缺席禁用 + 指引改用 fork）；"从当前 fork"（`fork({sessionId, increaseTitle:true})`，官方标记 origin）。
- **composer**：running 默认 steer、可切 queue（对齐官方 busy-Enter）；`cancel()` 绑定 running 态；`promptError` 行内透传不清草稿。
- **渲染**：`ConversationSnapshot.nodes` 有界投影（用户/助手文本、折叠工具卡摘要、错误节点、queue 计数）；`loadOlder` 向后翻页；removed 态禁用输入。
- **close pane = detach**：只取消本地订阅，session 原样保留可再次附着。

降级矩阵：无 `paneWorkbench` 零注册；无 `create` 新建禁用；slash 目录缺失命令禁用（pane 操作不受影响）；附着不可解析行内提示不回退。

## 3. 边界

- 不做 xterm 原始 VT、resize、全屏应用（官方 defer；duplex seam 到位由既有 Tier-2 lane 接管，`dsh-terminal-v1` 3.2 / `dsh-terminal-interactive-v1` 2.2 归属不变）。
- 不在插件 spawn PTY、不动 `experience-tier.ts` seam 表、不改 `dsh-terminal-probe-pane` 主 spec。
- 侧边对话不做 subagent 编排与 queue 管理 UI（queue 仅渲染计数）。

## 4. 验证

包测试（host wire/adapter/remote 穷举、client 状态机与渲染矩阵、side chat 主选择不变量断言、wire parity host↔client）+ `check:bundles` ModuleLoader 单文件合同 + `openspec validate --strict`；证据落 `temp/integration-test-runs/`。完成门不含官方 `dsh web` 实测。
