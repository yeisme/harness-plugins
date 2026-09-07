## Why

`/agent` composer 目前没有任何键入触发：`/` 命令只能从底栏「+」按钮打开，`@`/`#`/`$` 完全不存在。用户要求对齐 dsh 类 agent 工具的触发交互（`@` 引用、`/` 命令等）。现有合同只承认「显式 Context Pack safe ref + slash command」，且 `prepareContextPack` 的 selections 目前是硬编码 fixture（`CONTEXT_SELECTIONS`）——`@` 触发正好可以把「显式选择上下文对象」做成真实数据流，取代 fixture。同时必须守住红线：picker 只列 server-authorized safe refs，不伪造文件/变量选择器，不静默 attach。

## What Changes

- 新增 capability `workbench-agent-composer-triggers`：定义 composer 键入触发交互合同——`/` 命令触发与 `@` 显式引用触发；明确 `#`/`$` 本轮不实现（无对应后端合同，防伪造）。
- `/` 触发：在空 draft 起始键入 `/` 打开命令菜单（复用现有 4 项真实命令：插入功能面板/准备上下文包/刷新上下文/停止回合），键入过滤、键盘导航、Esc 关闭并保留文本；命令执行仍走既有回调，无新 mutation 路径。
- `@` 触发：键入 `@` 打开 safe-ref picker——数据源为 server-authorized 上下文对象（已 attach pack 的 objects / 可 attach 的 safe 投影），诚实呈现 empty/needs_contract 态；选择后成为 draft 的显式引用 chip（chips 行呈现），并取代硬编码 `CONTEXT_SELECTIONS` 作为下一次 prepare/attach 的 selections；无选择时保持现有默认行为。
- i18n、单测、e2e、截图证据与黑名单过审随实现交付。

## Capabilities

### New Capabilities

- `workbench-agent-composer-triggers`: 定义 composer 的 `/` 命令触发与 `@` safe-ref 显式引用触发的交互、数据源、键盘与诚实性合同，以及 `#`/`$` 触发的显式不实现边界。

### Modified Capabilities

无。Context Pack 的 prepare/attach/refresh 合同与 mutation 链不变；本 capability 只新增 composer 输入层交互。

## Impact

- 预计影响 `apps/web/src/workbench/agent/conversation/composer.tsx`、`conversation-model.ts`、`agent-conversation-workspace.tsx`（pack objects 传入与 selections 接线）、i18n 源 JSON、相关单测与 e2e。
- 不引入新的浏览器→owner 通道；picker 数据只来自既有 typed client 投影；不伪造 `#`/`$` 数据源。
- 验证：`openspec validate --all --strict`、`bun run typecheck`、全量 vitest、`agent-first` e2e、`compose:i18n && check:i18n`、截图证据。
