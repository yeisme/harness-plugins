# Review Report：workbench-agent-composer-triggers-r1

## 实现说明

### 1.x `/` 命令触发（D2）

- `composer.tsx` 新增 `detectComposerTrigger(draft, caret)`：仅当 `/` 是空 draft 第一个字符、或位于行首 token 起始（前一字符为 `\n`）时返回 slash 触发；URL/路径/句中 `/`（token 不以 `/` 起始、或前字符为空白/字母）不触发。
- 键入触发与「+」按钮渲染**同一个** `SlashCommandMenu` 组件（单一实现）；键入的 query 同时匹配本地化标签与稳定命令 id（zh 界面下 `/prep` 仍能命中 `prepare-context`）。
- 键盘合同：↑↓ 在可用项间循环（跳过 disabled），Enter 执行高亮项，Esc 关闭并把触发点记入 `dismissedKey`（保留文本，再次键入即重开）；Backspace 删到触发符消失时检测自然关闭。
- 选中后执行既有回调（`onOpenPalette`/`onPrepareContext`/`onRefreshContext`/`onStop`，无新 mutation 路径），并从 draft 移除 `/query`（caret 回退到 token 起始，焦点经 rAF 还给 textarea；插入面板命令由 palette 自己管理焦点）。
- 「+」按钮入口保留；disabled 项保持 disabled 并新增次级原因文本（`刷新上下文` 无 pack 时显示「附加上下文包后可刷新」，`停止回合` 复用 `agent.pane.palette.disabled.noActiveRun`）；menuitem 可访问名经 `aria-label` 保持为命令名，原因走 `aria-describedby`（既有断言不变）。

### 2.x `@` 显式引用触发（D3）

- workspace 把 `pack?.objects ?? []` 经新 prop `contextObjects` 传入 Composer——picker 数据源仅为 server-authorized pack objects，无 pack 时为空数组。
- `@` 在任何 token 起始（draft 起始或空白后）触发 picker（`role="listbox"`，选项 `role="option"` + `aria-selected`，textarea 经 `aria-activedescendant` 指向高亮项）；行 = `summaryLabel` 主文本 + `type` 次级 muted + mono `ref`；query 过滤（label/ref/type）；键盘合同同上。
- 无 pack objects：诚实空态（「尚无上下文对象；先准备上下文包，再显式引用。」+「准备上下文包」动作入口，走既有 `onPrepareContext`），不编造任何对象条目。
- 选中：对象经 `onAddReference` 加入 workspace 侧 draft 级显式引用集合（`explicitRefsBySession`，按 `ref` 去重）→ chips 行追加显式引用 chip（label + 状态点，复用现有 chip 形态）；chip 移除按钮可访问名为「移除引用 {label}」；`@query` 文本从 draft 移除。draft 提交成功后引用集合同步清空（draft 级状态不残留）。

### selections 接线（2.4）

- `prepareContext` 的 `selections`：`explicitRefs.length > 0` 时映射回 selection 形状（`{type, ref, summaryLabel?}`），取代硬编码 `CONTEXT_SELECTIONS`；未做任何 `@` 选择时保持既有默认 fixture 行为（既有 e2e/单测「准备上下文包」路径不变）。
- 引用只影响下一次显式 prepare 与 chips 呈现：不静默 prepare/attach/refresh，不进 submit 载荷。

### 3.x 边界与 i18n

- `#`/`$` 不实现（spec 已记录 reject-now）：检测函数只对 `/`/`@` 返回触发；新增单测锁定「`#topic then $var` 为纯文本、无任何菜单/picker」。
- 新文案 key（双语 + catalog-policy 登记，`compose:i18n && check:i18n` 绿）：
  - `agent.conversation.composer.slashNoMatch`（没有匹配的命令 / No matching commands）
  - `agent.conversation.composer.slashRefreshDisabled`（附加上下文包后可刷新 / Attach a context pack to enable refresh）
  - `agent.conversation.composer.mentionPicker`（引用上下文对象 / Reference context objects）
  - `agent.conversation.composer.mentionEmpty`（尚无上下文对象… / No context objects yet…）
  - `agent.conversation.composer.mentionNoMatch`（没有匹配的上下文对象 / No matching context objects）
  - `agent.conversation.composer.removeReference`（移除引用 {label} / Remove reference {label}，placeholder: label）

## 修改文件

- `apps/web/src/workbench/agent/conversation/composer.tsx`：触发检测、共享 SlashCommandMenu、`@` picker、chip 可移除、键盘合同。
- `apps/web/src/workbench/agent/agent-conversation-workspace.tsx`：`explicitRefsBySession` 状态、add/remove 回调、prepare selections 接线、submit 清空引用、Composer 新 props。
- `apps/web/test/agent-conversation-workspace.test.tsx`：+4 用例（`/` 触发/过滤/Esc/键盘选中、无 pack 空态、picker/chip/去重/移除/selections 接线、`#`/`$` 纯文本）。
- `apps/web/e2e/agent-first.spec.ts`：+1 e2e（`/` 与 `@` 关键路径，含空态、过滤、Esc、键盘选中、默认 vs 显式 selections、chip 去重/移除）。
- `api/locale/source/{zh-CN,en-US}/agent/conversation.json`、`api/locale/source/catalog-policy.json`：6 个新 key。
- `api/locale/catalog.json`、`service/internal/locale/bundles/*.json`、`apps/web/src/i18n/*.generated.ts` 等：`compose:i18n --write` 再生产物。

## 验证记录

- `bun run typecheck`：绿。
- `bun run --cwd apps/web vitest run test/agent-conversation-workspace.test.tsx`：81/81 绿。
- 全量 `bun run --cwd apps/web vitest run`（单独复跑）：949 通过 / 3 失败，失败恰为 HEAD 已知项（orbit-visual-blacklist ×2、studio-file-preview ×1），未修。
- `bun run --cwd apps/web e2e -- agent-first`：9/9 绿（含新用例；首次失败为 fixture 响应缺 `{pack}` 包络，已修正后全绿）。
- `bun run compose:i18n && bun run check:i18n`：绿（2482 keys）。
- `openspec validate --all --strict`：32/32 绿。

## 截图清单（temp/agent-shell-visual-r1/）

- `after-r8-slash-menu.png`：`/` 触发命令菜单（含 disabled 原因与底部「引用保持显式」提示）。
- `after-r8-mention-picker.png`：`@` picker 列出 pack objects（summaryLabel 主文本 + type 次级 + mono ref）。
- `after-r8-mention-chips.png`：选中两个对象后的显式引用 chips（含可访问名移除按钮）。
- `after-r8-mention-empty.png`：无 pack 时 `@` picker 诚实空态 +「准备上下文包」入口。

逐张审查结论（ReadMediaFile 全分辨率复核）：
- `after-r8-slash-menu.png`：菜单四项齐全（插入功能面板/准备上下文包/刷新上下文/停止回合），两项 disabled 态降透明度且带次级原因文本，底部「引用保持显式」提示保留；draft 区可见 `/`，无布局溢出。
- `after-r8-mention-picker.png`：picker 两行对象（雾港回声 project + mono `project:mist-harbor`；EP01 潮汐线 task + mono `task:ep01-tidal`），首项键盘高亮；chips 行已有 attach pack chip（`agent_context_pack:shot · r1`，绿点）。
- `after-r8-mention-chips.png`：chips 行 = pack chip + 两个显式引用 chip（雾港回声 / EP01 潮汐线，绿点 + × 移除按钮，可访问名「移除引用 {label}」）；draft 已清空（`@query` 移除正确）。
- `after-r8-mention-empty.png`：无 pack 空态仅含诚实文案「尚无上下文对象；先准备上下文包，再显式引用。」与「准备上下文包」动作，无任何编造对象条目。

临时采集脚本 `apps/web/e2e/tmp-r8-screenshots.spec.ts` 用完已删（`git status` 无残留）。
