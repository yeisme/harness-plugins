# dsh web pane：终端与侧边对话

[English](dsh-web-pane-terminal-sidechat.md) | 中文

两个在当前发布版 DSH 上即可用的 pane：基于官方 `ctx.terminals` 能力的行式终端 console，以及不影响主对话区的侧边对话。

## 终端 console

需要 DSH **0.1.1-rc.2 及以上**（携带 `packages/terminal/` 的发布线）。更早版本上 console 与 `/terminal` 会显示明确的禁用原因，而不是假终端。

1. 安装 bundle：

   ```
   dsh plugin --profile web add @yeisme/dsh-terminal
   ```

2. 从 pane picker 打开 console，或输入 `/terminal`。
3. 选择**归属会话**（默认跟随当前会话）。你创建的终端由该会话的 agent 持有，并随其结束而关闭——与 agent 工具终端语义一致。
4. `新建终端` 经注册后端（`shell`）创建一个。滚回视图有界；超过保留上限的更早输出会标注 `truncated`。
5. 在输入框发送一行（`Send`，Enter 提交；取消勾选 submit 可发送原始片段，适配 REPL）。同一时刻只有一个 send 在等待——等待期间 composer 锁定。永不就绪的 send 会在 60s 上限处被中断（`cancelledByWaitTimeout`），不会卡死。
6. `中断（SIGINT）` 向前台进程组发信号；`关闭终端` 关闭并等待进程树静默。
7. 滚回在归属会话的对话活动（例如终端工具调用完成）时刷新，无轮询。

它不是什么：xterm.js 原始 VT 视图仍由官方 duplex seam（`TerminalHostV2`，体验 Tier 2）门控。全屏应用、resize 与按键级输入是上游明确 defer 的能力。

## 侧边对话

当前发布版即可用——只用官方 client services。

1. 安装 bundle：

   ```
   dsh plugin --profile web add @yeisme/dsh-side-chat
   ```

2. 用 `/side-chat`（或 pane picker）打开。tab 起步是会话选择器；可以同时开多个 tab。
3. 三种填充方式：
   - 从列表**选择一个会话**附着；
   - runtime 提供 `create` 时**新建会话**（否则按钮禁用并指引 fork）；
   - **从当前 fork**，带历史分叉出主对话的子会话。
4. 照常对话：Enter 发送；会话运行中默认转向（steer，勾选框可切换为排队 queue），`停止` 取消当前 turn，`加载更早消息` 向前翻页。
5. 关闭 tab 只是取消本地订阅——session 继续运行、留在列表里。**主对话区的选择全程不变**；该不变量由测试钉死。

## 排障

- 终端显示"终端不可用"：当前 DSH 早于 terminals 能力，升级到 ≥ 0.1.1-rc.2。
- 终端 probe 报缺失方法（`missing:...`）：terminals 服务存在但与合同漂移；插件与 DSH 一起升级。
- 侧边对话"新建会话"禁用：runtime 未暴露 `sessions.create`；改用 fork 或附着。
- 侧边对话 tab 提示会话无法附着：该 session 既不在列表也未 scope——先在主区打开它，再附着。
