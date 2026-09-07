# 任务清单：workbench-agent-pane-composition-r1

设计输入：本 change `design.md`（D1 组合规则 / D2 帧头去重 / D3 四态矩阵 / D4 fail-closed 呈现）。

## 1. 壳层组合规则

- [x] 1.1 hero 判定补齐：`heroActive = conversationEmpty && visiblePanes === 0`；pane 打开时 composer dock 到底部、移除空态 flex-1 间隔块与品牌位
- [x] 1.2 组合切换不重挂载 composer（单实例，保留草稿/焦点）；打开/关闭最后 pane 时无布局跳变
- [x] 1.3 dock 打开时对话列 min 宽度与 composer 限宽行为核对（UI Spec §4）

## 2. Pane 帧头去重

- [x] 2.1 桌面帧：标题单处、删 eyebrow、版本/新鲜度降为次级 meta、操作簇 IconButton
- [x] 2.2 桌面帧与移动 Sheet 帧统一消费 `PaneChrome` composite；删除 dock 自写帧头 JSX
- [x] 2.3 Sheet 的 focus trap/Escape/scroll lock/回焦行为保持

## 3. Pane 内容四态矩阵

- [x] 3.1 四态组件骨架（loading 骨架/empty/unavailable+占位/ready）落到 pane 内容层
- [x] 3.2 context/run/review/evidence/operations 五 pane 逐一接入矩阵
- [x] 3.3 contextMap：命令面板 needs_contract 禁用（带原因）、不可打开；删除 stub pane 渲染路径
- [x] 3.4 pane 内容人读化：raw ref/UUID/reason code 降为次级 mono meta 或技术明细，主文本一律人读标签（对齐 shell-visual-r1 的能力用户化原则）

## 4. 验证与证据

- [x] 4.1 单测/e2e 断言同步；新增组合规则用例（hero 与 dock 互斥、切换不重挂载）
- [x] 4.2 三视口截图（空+dock 打开、会话中+dock、pane 四态、移动 sheet）存 temp/ 并逐张审查
- [x] 4.3 review-report.md；i18n compose/check；typecheck；全量 vitest；agent-first + agent-pi-workspace e2e 绿
- [x] 4.4 `openspec validate --all --strict` 通过
