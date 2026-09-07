## Context

实测现状（证据见 `temp/current-state-1440.png` 与用户评审截图）：

- hero 判定：`agent-conversation-workspace.tsx:1276` `conversationEmpty = timelineBlocks.length === 0`，`:1279` `docked={!conversationEmpty}`，`:1489` 空态底部 flex-1 间隔块——不含 pane dock 状态。
- 帧头：`agent-pane-dock.tsx:435-444` eyebrow「AGENT 面板」+ h2 标题 + 版本行；tab（PaneTabs :273）已含 label + paneType meta → 标题三处重复。帧头为自写 JSX，未用 `design-system/composites/pane-chrome.tsx`（controls-r1 已建，含标题区/工具槽/关闭）。
- 内容：`context-canvas.tsx` unavailable 仅一张卡（:60-66）；`agent-pane-host.tsx` 的 `contextMap`（:65）为永远 unavailable 的纯 stub；`operations`（:183-192）缺合同参数时仅 warning。
- 既有合同：pane 有界布局/registry fail-closed 归 `workbench-agent-pi-workspace-v1` 的 session-workspace spec；本 change 不重定义。

## 决策

### D1 组合规则（hero 判定补齐 dock 维度）

- `heroActive = conversationEmpty && visiblePanes === 0`。任何 pane 打开（含 sheet 态）→ composer dock 到底部、移除空态间隔块、hero 品牌位不渲染。
- 组合切换（打开/关闭最后一个 pane）不得引起 composer 重挂载（保持单实例、保留草稿与焦点），只切换布局类。
- dock 打开时对话列保持 min 560 基准宽度（UI Spec §4），composer 限宽 720 居中不变。

### D2 帧头去重与 PaneChrome 接入

- tab 条（PaneTabs）：label + paneType meta（现状保留）。
- 帧头：标题只出现一次（h2）；删除 eyebrow「AGENT 面板」；版本行（paneType·rN）与新鲜度合并为标题旁次级 muted meta；操作簇（overflow 菜单、关闭）走 IconButton。
- 桌面帧与移动 Sheet 帧统一改为消费 `PaneChrome`（title/status/actions/onClose），dock 自写帧头 JSX 删除；Sheet 保留 focus trap/Escape/scroll lock 既有行为。

### D3 Pane 内容四态矩阵

| 状态 | 形态 |
| --- | --- |
| loading | 结构化骨架（标题行+2-3 内容行的 shimmer 占位，motion-safe），非孤卡非空白 |
| empty | 居中图标 + 一行说明 + 单 CTA（视觉语言空态形态） |
| unavailable | 诚实卡（状态+原因+恢复动作）+ 内容结构占位（该区域就绪后的分区骨架轮廓），不得只有孤卡悬空 |
| ready | 完整内容 |

6 个 pane kind（context/run/review/evidence/operations/contextMap）逐一落矩阵；operations 缺参数态按 unavailable 处理并给出合同缺失原因。

### D4 contextMap fail-closed 呈现

- 命令面板中 contextMap 项呈现为 needs_contract 禁用项（disabledReason=合同未注册），不可打开；删除永远 unavailable 的 stub pane 渲染路径（host :65）。
- 后续合同落地后在 catalog 晋级，无需改本 change。

### D5 验收

- 三视口截图：空会话+dock 打开（composer 贴底无浮空）、会话中+dock 打开、pane 各状态（loading/empty/unavailable/ready）、移动 sheet。
- 既有 pane 测试（agent-pane-dock/palette）断言同步；e2e agent-first + agent-pi-workspace 绿。
