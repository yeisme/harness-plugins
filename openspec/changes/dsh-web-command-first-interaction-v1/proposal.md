## Why

DSH Web 已分别具备 slash 目录、`Ctrl/Cmd+K` 菜单、session/model/Pane 命令、下一步建议、Tokens 面板和 Pane Workbench，但这些能力仍以独立 Modal、按钮和插件局部状态出现。用户无法从 Composer 形成一条可预测的「发现命令 → 补齐参数 → 确认 → 查看进度/结果 → 进入 Pane」主路径，也无法像 Codex 一样快速判断当前会话的上下文余量、运行配置和 Provider 限额。

本 change 将已确认的产品方向固化为命令优先的混合壳：聊天与 Composer 是高频入口，复杂对象仍交给 Pane；参考 Codex 的交互语法与信息密度，但继续使用 DSH visual-kit、owner action、receipt 和安全投影，不复制 Codex 皮肤或业务合同。

## What Changes

- 建立双入口命令体验：输入 `/` 打开 Composer 锚定菜单，`Ctrl/Cmd+K` 打开全局 Palette；两者共享同一实时目录、可用性、禁用原因、上下文排序和最近使用投影。
- 完整承接当前 P0 目录的 discovery/session/model/work/lifecycle 五类命令；首批 8 条只定义 V1 实现与浏览器验收焦点，不得让其他既有 P0 命令从目录消失或失去 staged/disabled 解释。
- 将命令执行改为渐进式结构化流：选择命令后形成命令 token，再就地补参数/选择器；安全动作直接执行，可逆 mutation 就地确认，破坏性动作继续使用 owner preview 与显式确认。
- 建立统一反馈链：Composer 附近显示即时 pending/success/error，durable `command/run|done` 进入会话 Activity；复杂结果打开 Pane preview，用户交互或 Pin 后才持久保留。
- 建立当前会话优先的状态中枢：会话 Header 状态胶囊、轻量 Popover、详细 Pane 与 `/status` 共用同一 Host 安全投影；上下文余量、运行配置、Provider 限额/重置时间和用量账本保持独立语义。
- Composer 常驻紧凑 model/preset/reasoning/permissions 控制，并与 slash 命令互为镜像；一轮完成后仅显示 1–3 个临时建议芯片，点击只写草稿，不自动发送。
- 上下文不足采用非阻断渐进提醒：胶囊 tone 变化并建议 `/compact`，除真实失败或破坏性确认外不弹阻断 Modal。
- 桌面键盘路径优先；窄屏将 Palette、状态详情和 Pane inspector 降级为全宽层/Sheet，并保留 Escape、焦点返回和触控目标。
- 保留现有 `token-usage-open`、`workspace.token-usage`、命令目录字段、Pane `openView()` 和插件贡献合同。新字段、Remote、组件与 presentation hint 全部 additive；本 change 不移除或重命名既有 surface。

## Capabilities

### New Capabilities

- `dsh-web-command-first-shell`: Composer slash、全局 Palette、结构化命令 token、分级确认、即时反馈、Activity receipt、Pane preview/pin、Composer 控制和响应式键盘行为。
- `dsh-session-status-center`: 当前会话状态安全投影、Header 胶囊、Popover、详细 Pane、`/status` 联动、上下文提醒和 Provider 限额诚实降级。

### Modified Capabilities

无。现有 command、token usage 与 Pane requirement 保持兼容；新壳通过 additive adapter、可选字段和 capability probe 组合它们。

## Impact

- 主要实现：`packages/client/command-experience-core`、`packages/client/ui-command-experience-web`、新增 `packages/host/dsh-session-status` 与 `packages/client/ui-session-status`，以及 `packages/bundle/dsh-command-experience` 的组合接线。
- 复用/消费：`packages/client/ui-token-usage`、`packages/client/ui-next-step-suggestions`、`packages/client/ui-pane-workbench`、官方 commands/session/model/tokenMeter/slot projection。
- 上游边界：若官方 Composer 锚定菜单、session Header 或 context-meter projection 缺少公开 seam，只通过 `upstream-prs/<slug>/` 增量提案；插件侧保持 probe-first、fail-visible，不 patch DOM、不伪造状态。
- 兼容分类：新 Remote、可选 wire 字段、新组件与新 presentation hint 均为 additive；无 breaking surface、无 deprecation window。回滚为移除新增 bundle unit/关闭 capability，既有 Modal、Tokens 与 Pane 路径继续工作。
- 不新增前端运行时依赖；视觉与 Overlay 继续使用 DSH UI primitives、`ui-surface` 和 `ui-visual-kit`。
