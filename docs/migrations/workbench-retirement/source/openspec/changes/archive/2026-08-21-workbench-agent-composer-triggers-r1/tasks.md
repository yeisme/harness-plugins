# 任务清单：workbench-agent-composer-triggers-r1

设计输入：本 change `design.md`（D1 触发语义表 / D2 `/` 细节 / D3 `@` 细节 / D4 键盘合同）。

## 1. `/` 命令触发

- [x] 1.1 composer draft 键入检测：空 draft 或行首 `/` 起始 token 触发命令菜单（复用「+」按钮的同一菜单组件）
- [x] 1.2 键入过滤、方向键/Enter/Esc 键盘合同、Esc 保留文本、选中后执行命令并移除 `/query`
- [x] 1.3 「+」按钮入口保留；命令项 disabled 态与 disabledReason 保持

## 2. `@` 显式引用触发

- [x] 2.1 pack objects 传入 Composer（agent-conversation-workspace.tsx 接线）
- [x] 2.2 `@` picker：对象列表（summaryLabel 主文本 + type 次级 + mono ref）、键入过滤、键盘合同；无 pack 时诚实空态 + 「准备上下文包」入口
- [x] 2.3 选中对象成为 draft 显式引用 chip（chips 行呈现、可移除、去重、aria 名）
- [x] 2.4 引用集合接线 prepare：取代硬编码 `CONTEXT_SELECTIONS` 作为下一次 prepareContextPack 的 selections；未选择时保持默认行为

## 3. spec/文档与边界

- [x] 3.1 `#`/`$` 在 spec 中记录 reject-now（无后端合同，不伪造 picker）
- [x] 3.2 i18n：picker/空态/chip 移除等文案进 `api/locale/source/{zh-CN,en-US}/agent/*.json` + catalog-policy，`compose:i18n && check:i18n` 绿

## 4. 验证与证据

- [x] 4.1 单测：`/` 触发/过滤/选中/Esc；`@` picker 列表/空态/选中 chip/去重/移除；prepare selections 接线
- [x] 4.2 e2e（agent-first）：`/` 与 `@` 关键路径
- [x] 4.3 截图证据（temp/：触发态、picker、chip、空态）+ review-report.md
- [x] 4.4 最终门禁：`openspec validate --all --strict`、typecheck、全量 vitest（容忍 3 例 HEAD 已知失败）、i18n
