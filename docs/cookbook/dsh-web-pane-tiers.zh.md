# DSH web Pane 体验分级

[English](dsh-web-pane-tiers.md) | 中文

`dsh web` 上的 Pane 体验按当前安装的 DSH 提供的 seam 分级。Tier 由 Pane
Workbench 在运行时判定，并展示在 Workspace Capabilities 视图里——任何入口
都不会无声失效。

| Tier | 前置条件 | 可用体验 |
| --- | --- | --- |
| 0 | 任意官方发布版 | overlay 单 region 完整工作台：真 tab（pin/preview/overflow/bulk close）、区域内拖拽重排、Quick Pick、菜单、键盘路径 |
| 1 | `workspace.core-pane.v1` + `shell.workspace.right/bottom` | 完整 docking：split、跨 region 移动/拖拽、maximize、Workspace Designer apply |
| 2 | Tier 1 + TerminalHostV2 + PreviewResourceV1 + 官方 Artifact seam | 真 PTY 终端、生产级预览、官方 artifact handoff |

各 Tier 通用规则：

- seam 缺失一律诚实降级：入口保持可见但禁用，附原因与解锁指引；不伪造
  host、不做轮询回退。
- 布局持久化以 canonical 为准：Tier 1 布局经 Tier 0 会话往返不丢；overlay
  塌缩只是渲染态。
- Tier 状态每次会话重新判定、热插拔重判，从不落盘。

## Tier 0 上的 AI Drama Director

1. 安装 bundle：`dsh plugin add` 加入 `dsh-ai-drama-director` 行。
2. 在命令目录输入 `/drama`。命令以 `PaneCommandDescriptor` 贡献
   （`slash.name: 'drama'`）；command-experience 缺失时命令组禁用并附原因，
   pane 内操作仍可用。
3. `/drama open` 选剧；Director preset 塌缩为单 region 有序 tab 集
   （Context / Review / Run；Story / Visual / Audio 在 Quick Pick 按需开）。
4. Review/repair 走 owner typed action + admission；denied 即禁用并显示
   owner 原因。
5. "Open in Workbench" 使用 Host 批准且有过期时间的 handoff。Bridge V2
   打开 Workbench `/agent` 的 Creative Production、Review 或 Evidence lens；
   Workbench 服务端重新鉴权并向 owner 拉取数据。兼容窗口内 legacy consumer
   会被明确标记，不伪装成 V2 成功。

## 排障

- 入口被禁用：打开 Workspace Capabilities，找到对应行，读原因与解锁锚点。
- `contract_mismatch` 表示 seam 存在但残缺（例如不完整的
  `workspaceLayout`）；升级 DSH 是解锁路径。
- Tier 0 上 split/dock 控件可见但禁用是设计行为；workspace docking seam
  发布后自动解锁。

## 现在就可用的终端与侧边对话

上表的 Tier 仍然描述的是 *xterm 原始 VT* 终端。有两个 pane 更早可用：行式
终端 console（DSH 0.1.1-rc.2+，经官方 `ctx.terminals` 能力）与侧边对话
（任意发布版）。见[终端与侧边对话](dsh-web-pane-terminal-sidechat.zh.md)。
