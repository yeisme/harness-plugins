## Context

composer 键入触发的现状（实测）：draft onChange 直通，无任何触发检测；slash 菜单由底栏「+」按钮 toggle，4 项硬编码命令；`prepareContextPack` 的 selections 是硬编码 fixture（`conversation-model.ts` 的 `CONTEXT_SELECTIONS`）；`AgentContextPackV1.objects`（`ContextObjectRefV1: { type, ref, projectionRevision?, freshness?, capabilityState?, summaryLabel? }`）未传给 Composer。

约束（不可违反）：
- Context Pack 显式性：session summary 可提供 last pack safe ref，但 hover/focus/键入不得静默 prepare/attach（workbench-agent-session-workspace spec）。
- 不伪造：picker 不列无数据来源的对象；`#`/`$` 无后端合同，本轮不实现。
- 单一 mutation 链：触发交互只影响 draft 与显式选择，不直接创建 Task/拼装 basisRefs。

## 决策

### D1 触发语义表

| 触发 | 语义 | 数据源 | 结果 |
| --- | --- | --- | --- |
| `/`（draft 起始） | 命令菜单 | 现有 4 项真实命令（插入功能面板/准备上下文包/刷新上下文/停止回合） | 选中执行既有回调，无新 mutation |
| `@` | 显式引用 safe-ref picker | 已 attach pack 的 objects；无 pack 时诚实 empty/引导态（先准备上下文包） | 选中对象成为 draft 显式引用 chip，并作为下一次 prepare/attach 的 selections |
| `#` | 不实现 | 无文件/符号合同 | spec 记录 reject-now |
| `$` | 不实现 | 无变量/参数合同 | spec 记录 reject-now |

### D2 `/` 触发细节

- 仅当 draft 为空或光标位于行首的 `/` 起始 token 时触发（避免 URL/路径中的 `/` 误触发）。
- 菜单复用 `+` 按钮打开的同一组件（单一实现），键入内容作为过滤 query；Esc 关闭并保留已键入文本；选中后执行命令并从 draft 移除 `/query`。
- 既有「+」按钮入口保留（鼠标路径等价）。

### D3 `@` 触发细节

- 键入 `@` 触发 picker（任何位置，token 级）；picker 列出 pack objects（`summaryLabel` 主文本 + `type` 次级 + mono `ref`），键入过滤。
- 无 attach pack 时：picker 显示诚实空态（「尚无上下文对象」+「准备上下文包」动作入口），不编造对象列表。
- 选中：对象加入 draft 的显式引用集合，在 chips 行呈现（复用现有 chip 行形态：label + 状态点），可从 chip 移除；同一 ref 去重。
- 引用集合取代硬编码 `CONTEXT_SELECTIONS`：下次「准备上下文包」时以用户选择为 selections；用户未做任何 @ 选择时保持现有默认 selections 行为（不破坏既有流程/e2e）。
- 引用只影响下一次显式 prepare/attach 与 draft 呈现；不自动 attach、不进 submit 载荷（除非既有 submit 合同已支持，否则不改 submit）。

### D4 键盘与无障碍

- picker/菜单：方向键导航、Enter 选中、Esc 关闭并回焦 textarea；触发字符与 query 的删除（Backspace 删空 query 时关闭）遵循常规 mention 交互。
- 屏幕阅读器：picker 用 listbox/option 语义；chip 可移除按钮有可访问名。

## 风险

- `@` 数据源在无 pack 时为空是常态（新 session），空态引导文案必须诚实。
- 若后续服务端提供「可 attach 对象目录」操作，picker 数据源可扩展，交互合同不变。
