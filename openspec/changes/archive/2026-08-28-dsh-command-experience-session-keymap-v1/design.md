# Design: dsh-command-experience-session-keymap-v1

## D1 `/session` 形态：selector-hub + 类型化子命令直达（混合）

- `/session`（无参）开 sessionId selector；Enter = Switch（复用 `/resume` 的 `open-session` 工厂与 requiredAction，可用性降级完全一致）。
- 选中后进入第二段 **action 菜单**（adapter 自有组件，不新增 reducer 状态）：Switch / Rename / Archive / Restore。Archive 走既有 `evaluateDangerGate` + `prepareDestructiveSubmit`（preview 必需 + receipt 能力必需 + 拒绝递归）；staged 时动作可见但 disabled 带原因。
- 子命令直达：`splitSessionHubInput` 把 `/session <rest>` 拆成 hub assist 输入 + `parseSessionSubcommand`（未知 token 宽容回退 switch，不中途报错）。

**取舍理由**：纯子命令分发会复制 `/rename` 的目录语义并在单命令里发明第二套语法；纯切换 picker 就是 `/resume`，无新增价值。hub 补的是「浏览任意（含已归档）session 后再决定动作」的无鼠标路径。

**与 `/resume` 分层**：`/resume` = 查询→选→开（快速切换）；`/session` = 选→动作菜单→receipt-gated 变更（管理）。两者消费同一 `open-session` 通道，无语义重复。

## D2 archive/delete 归属：独立命令 + hub 只暴露 Archive/Restore

- `danger.ts` 的 `DESTRUCTIVE_CANONICAL`（`'delete'`/`'archive'`）与归档账本 P1 表都按独立 canonical 名设计，保持该机制不动。
- hub 内不嵌套 delete：最强的危险动词不该藏在 picker 第二层里削弱 danger affordance；delete 保持独立 destructive 面。
- 新 owner action 仅 `restore-session`（danger safe，receipt-gated，无 preview 要求——恢复已归档会话不是破坏性动作）。
- labels 归 `dsh-session-tags-grouping-v1`，不碰。

**不接 `SessionManagerHostV1` 的理由**：`packages/host/dsh-session-manager` 是 Promise-based placeholder（各方法返回 not_implemented）且自带一套 receipt 类型。接入会形成第二条 mutation 通道，分裂 receipt 处理并绕过 danger 矩阵。变更一律走唯一既定 `OwnerActionAdapter`（`submitAction` + `subscribeToReceipts` + correlation id）。SessionManagerHostV1 的真实化属于它自己的 change。

## D3 光标归属：reducer 增量持有

- `CommandReducerState` 增 `cursorKey: string | null` + `cursorMoved: boolean`；新 action `MOVE_SELECTION { delta?|index?; candidateKeys }` 让 reducer 保持列表无关的纯函数。
- `UPDATE_QUERY` 可携带 `candidateKeys`：光标 key 在新候选里消失时清空（复用 `retainSelectionAnchor` 哲学：**绝不跳邻居**）。
- `SELECT_COMMAND`/`CANCEL`/`RESET` 复位光标；web 菜单的 auto-select effect 加守卫 `cursorMoved && cursorKey !== selectedKey` 时跳过（光标压过发现层的隐式选中，防竞态）。
- 光标在 reducer 而非 adapter 本地 useState 的收益：TUI 免费获得光标（无需 React 状态设施）、导航语义单点可测、两表面共享一份规范。web 侧 `useCommandNavigation` 保留导出（兼容），菜单改读 reducer 光标。

## D4 键位默认表与边界

| 动作 | 默认 | 备注 |
|---|---|---|
| toggle | `ctrl+k` / `meta+k` | idle 开面板；非模生态关面板；confirmation/dispatching 排除 |
| 上/下移 | `arrowup`+`ctrl+p` / `arrowdown`+`ctrl+n` | assist/selected/argument/selector 四态可用 |
| 首/末 | `home` / `end` | 同上 |
| 执行 | `enter` | 禁用行拒执行 |
| 取消 | `escape` | 恢复 draft |
| 确认 | `ctrl+enter` / `meta+enter` | **裸 Enter 不得确认** danger gate |
| 关回执 | `escape` / `ctrl+d` / `meta+d` | 恢复走 `getRecoveryState` 语义 |
| Tab 补全 | `tab` | 仅唯一安全前缀；歧义时不拦截 |

- **裸 `j`/`k` 默认关**（两侧一致，config 可开）：assist/selector 态裸 j/k 会吞掉查询字母（过滤 "project" 会先触发下移）。数字快捷选前 N 项缓到 P1。
- Tab 补全源是 `state.draft`（用户实际输入）而非 `state.query`——`SELECT_COMMAND` 会把 query 重写为无斜杠 canonical 名。
- **sanitize 边界**：keymap 配置是 adapter 代码；命令元数据携带 shortcut 字段仍被 `GLOBAL_SHORTCUT_PATTERN` 拒绝。spec 把这条写成显式条款。
- toggle 在面板开时返回 toggle 意图由 adapter 转 CANCEL；confirmation/dispatching 两个模生态排除，避免快捷键穿透 danger gate。

## TUI seam 现状

官方 TUI console seam 包 `@deepseek-ai/dsh-client-tui` 未发布。`keys.ts` 只做纯序列解析（箭头/home/end/enter/esc/tab/ctrl+n/p/d/k），controller 的 `handleKeyEvent` 是官方 host 的未来接入点；测试喂合成序列驱动本地 host，真实 host 上 fail-closed。**不碰 stdin/rawMode**（sanitize 黑名单明令）。

## Web 接线要点

- 菜单/selector/确认/回执四处 keydown 全部改走 `resolveKeyAction`，`keyboardShortcuts` 配置经 `resolveKeymap` 合并（类型增量加 moveFirst/moveLast/tabComplete/confirmExecute/closeReceipt）。
- `useCommandPaletteToggle`：window 级 Ctrl/Cmd+K → `START_ASSIST`；`enabled: false` 可让宿主接管绑定避免双触发。
- selector 是局部列表 widget：绑定解析走共享 keymap，索引 clamp 在本地应用（与 reducer 同语义）；reducer 光标路径由菜单与 TUI 承担。
- 焦点回补：官方 `bindComposerFocus` rc.6 未公开，保持既有 DOM focus 回补（`onRestoreFocus` + restore ref），seam 公开后再 probe-gated 接入。
- a11y：菜单/动作菜单加 polite aria-live 播报（参照 ordo popup announcement 模式）；`aria-activedescendant` 由光标驱动。

## 风险与回归策略

- 光标/自动选中竞态 → `cursorMoved` 守卫 + 专项测试（web「moves the cursor and executes the cursor row」）。
- 现有 web 键盘 spec 不得红 → keymap 默认表逐键复刻旧行为（ArrowUp 从首行回到无选中、Enter 执行禁用行 no-op、Ctrl+Enter 才确认）。
- bundle 合同 → 无新依赖；keymap 随 core inline；`check:bundles` 复跑。
- 本地消费 workspace 包时 web/tui 的类型解析走 core 的 `lib/types` 构建产物：core 改动后必须先 `pnpm --filter …core build` 再 typecheck 下游（开发流程注意，非运行时问题）。
