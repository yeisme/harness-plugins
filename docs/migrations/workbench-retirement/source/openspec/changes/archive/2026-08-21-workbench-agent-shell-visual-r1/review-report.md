# Agent Shell Visual R1 验收审查（任务 6.1–6.5）

日期：2026-08-17

## 结论

**GO（本地交付）**。验收过程中发现并已修复 1 个 A 类回归（primitive 迁移击穿 44px 触控目标合同，详见 6.3）；修复后 `/agent` 主壳三视口截图逐张过审、UI Spec §8 黑名单逐项无违例、全量 e2e 回到 21 passed / 61 failed / 4 skipped 的已知基线（61 例全部对应 ui-controls-r1 已归因的 C 类，无新增失败、无截图基线 diff）。

## 6.1 截图对比证据

before 参照确认：仓库 `temp/agent-first-{390,1024,1440}.png` 生成于 2026-08-16 21:47（`agent-first.spec.ts` 末行写出，说明当时测试通过），彼时工作树为 HEAD `aea4480` 状态、当前切片未进入，确为改版前产物。已配对备份到 `temp/agent-shell-visual-r1/before-*.png`（原路径文件会被后续通过的 e2e 覆写为 after 态）。

after 截图由临时 spec（复用 `agent-first.spec.ts` 的 fixtures、en-US locale seed 与导航套路，用完已删）在 44px 修复**之后**捕获，证据反映最终状态：

| 截图 | 审查结论 |
| --- | --- |
| `temp/agent-shell-visual-r1/after-1440.png` vs `before-1440.png` | header 按钮迁 Button/IconButton primitive（ghost 形态）；rail 过滤器迁 SegmentedControl 发丝 pill；空态次 CTA 改幽灵链接；composer 发丝边+轻影浮起。无大方框卡片、无渐变/玻璃，行节奏一致 ✅ |
| `after-1024.png` vs `before-1024.png` | 同上差异；status meta 单行、无横向溢出（e2e overflow 断言同步通过）✅ |
| `after-390.png` vs `before-390.png` | 单列时间线；header 操作收为 IconButton；chips 换行正常；状态行换行形态与 before 一致 ✅ |
| `after-1440-command-palette.png` | 12px 圆角、细边、轻影；分组间发丝线；`read-only` 为发丝 pill；无玻璃/厚投影 ✅ |
| `after-1440-composer-focus.png` | composer focus-within accent 描边正确；Send 仅在有草稿时呈 primary 实心 ✅ |
| `after-1440-rail-selected.png` | 选中行 accent 2px 左条 + 浅底清晰可见；状态/未读均为小色点语义形态 ✅ |

## 6.2 既有测试

- `bun run typecheck`：通过（根 + apps/web）。
- `bun run --cwd apps/web vitest run`：**941 passed / 3 failed**，3 例失败与主会话记录的 HEAD 已知失败一致且均在本 change 范围外：`test/orbit-visual-blacklist.test.tsx` ×2（rescue cell 文案）、`test/studio-file-preview.test.tsx` ×1。
- `bun run --cwd apps/web vitest run --config src/design-system/tokens/vitest.config.ts`：150/150 通过。
- `bun run --cwd apps/web vitest run test/foundation-contract.test.ts`：4/4 通过。

## 6.3 e2e 与新失败定性

首轮全量 `bun run --cwd apps/web e2e`：**15 passed / 67 failed**，对比已知基线（21/61）多出 6 例新失败，全部落在 `agent-first.spec.ts`（×4）与 `agent-pi-workspace.spec.ts`（×2）——不在 C 类归因内，逐条定性为 **A 类 · 本 change 引入**，已修复：

1. **44px 触控目标回归（样式层，1 处修复）**：会话壳交互控件迁入 Button/IconButton/SegmentedControl primitive 后，`agent-first.spec.ts` 的三视口 undersized-targets 断言捕获 13 个 <44px 控件（SegmentedControl 项 24px、IconButton sm 32×32、Button sm 32px）。根因：壳根节点原有 `[&_button]:min-h-11` Tailwind 工具类兜底，但 primitive 的未分层 CSS（`--wb-control-height-sm`=32px、分段项 24px）在层叠上压过 `@layer utilities` 中的工具类。修复（只改样式层）：`apps/web/src/styles.css` 新增 `[data-agent-control-plane="task-service"]` 作用域的 44px min-height/min-width 覆盖（含对 `.wb-icon-button--sm`、`.wb-segmented-control--sm` 等同优先级后发规则的显式反制），恢复 before 态的 44px 渲染尺寸。已用 `git worktree` 检出 HEAD 对照确认 HEAD 全控件 ≥44px、当前树修复后断言归零。
2. **角色断言更新（任务 6.2 允许的控件换源 fallout，2 个 spec）**：过滤器迁 SegmentedControl（Radix ToggleGroup single）后角色为 `radiogroup`/`radio` + `aria-checked`。`agent-first.spec.ts`（最近/已置顶/Recent/Pinned 断言 button→radio）与 `agent-pi-workspace.spec.ts`（Session filters 三处 button→radio、`aria-pressed`→`aria-checked`）按允许范围更新。无 aria/data 合同选择器改动。

修复后复跑：`agent-first.spec.ts` 6/6、`agent-pi-workspace.spec.ts` 8/8 单spec 验证通过；全量 **21 passed / 61 failed / 4 skipped**，61 例失败与 ui-controls-r1 review-report 的 C 类清单逐条对应（C-1 catch-all 白屏 15、C-2 英文断言 vs zh-CN 37、C-3 identity-team 2、C-4 daily-ops 端口 5、C-5 axe 对比度 2），无新增失败模式。`foundation-gallery.spec.ts` 4/4 持续绿。**B 类：无任何 `toHaveScreenshot` 基线 diff 产物，`--update-snapshots` 更新数为 0。**

## 6.4 UI Spec §8 黑名单逐项过审

方式：6.1 截图逐张人工审查 + 源码静态 grep（`apps/web/src/workbench/agent/` 与 `apps/web/src/styles.css`）。

| 黑名单项 | 结论 | 依据 |
| --- | --- | --- |
| Hero | 无 | 空态为居中品牌位 + 一行说明 + 单 primary CTA + 幽灵次 CTA（after-1440 截图） |
| KPI 卡片墙 | 无 | header 下方 status strip 为单行 label·value 文本，无卡片容器（各视口截图） |
| 无意义渐变 | 无 | `grep -i "gradient" apps/web/src/workbench/agent` 零命中；styles.css 中渐变均在 `.studio-*`/`.eikona-*`/`.constellation` 等 /agent 壳不引用的遗留选择器 |
| 厚玻璃 | 无 | `grep "backdrop-filter\|backdrop-blur" apps/web/src/workbench/agent` 零命中；壳常驻区域无 backdrop-filter（styles.css 命中项同属遗留选择器） |
| 随机 emoji | 无 | emoji 区间扫描（U+1F300–1FAFF、U+2600–27BF）agent 目录零命中；`from "lucide-react"` 直接 import 零命中，全部走 `WorkbenchIcon` registry（本 change 新增 `pane.*` 分组） |
| 全屏空 Canvas | 无 | 空态有引导文案与动作（after-1440） |
| 假实时 / 假实时发光 | 无 | 动效仅 `animate-spin`（真实 loading/running）与 running 行 `motion-safe:animate-pulse` shimmer（真实服务端事件驱动，reduced-motion 禁用），符合视觉语言 §5 |
| 假成功 toast | 无 | `grep -i "toast" apps/web/src/workbench/agent` 零命中；mutation 结果走 StateBanner/行内状态，如实显示 |
| provider logo 导航 | 无 | compact rail 为 registry 语义图标 |
| 嵌套卡片 | 无 | 截图审查：timeline 区段为发丝线+左色条，pane host 为发丝线区段，无卡片套卡片 |
| 无原因 disabled | 无 | `disabled` 使用点均有原因：busy 态、边界位置（moveLeft/Right）、当前会话、pane catalog `disabledReason`（命令面板显示 read-only/原因文本） |

## 6.5 最终验证记录

- `openspec validate --all --strict`：30 passed / 0 failed。
- `bun run typecheck`：通过。
- `bun run --cwd apps/web vitest run`：941 passed / 3 failed（3 例为上述 HEAD 已知失败）。
- `bun run compose:i18n`：OK（2467 keys, 21 namespaces）；`bun run check:i18n`：OK（2467 server keys, 48 bootstrap keys）。

## 7. 简洁化返修（评审反馈：chips 常驻行占地方、入口重复、空态噪音）

### 7.1 composer 常驻 chips 行 → 底栏按需指示

- 删除 `apps/web/src/workbench/agent/conversation/composer.tsx` 中 composer 上方的常驻 action-descriptor chips 行（整行的 tool 标签 + StatusChip）。
- 改为 composer 底栏单个紧凑指示：状态点（全部为非严重不可用态时 warning 色；存在 offline/unavailable/conflict/unknown_accept 或目录不可用时 danger 色）+ 计数文字（新 i18n key `agent.conversation.composer.capabilityCount`，如「2 项能力不可用」）。仅当存在非 ready descriptor（或工具目录不可用）时渲染；全部 ready 时不占任何空间。
- 点击经 design-system `Popover`（side=top）展开明细：每个非 ready descriptor 的名称 + 既有 `ActionDescriptorStatus`（StatusChip 状态 + reason code + recoveryHint title），`data-wb-action-descriptor-status` / `data-availability` 合同选择器原样保留；原 chips 行本无 onSelect/恢复按钮，无行为丢失，`needs_contract` 诚实表达与 recoveryHint 可达性不弱化。
- 工具目录不可用时指示显示短文案（新 key `agent.conversation.composer.toolsUnavailableShort`），Popover 内保留完整说明（`composer.toolsUnavailable`）。
- 指示器带 `data-agent-capability-indicator="true"` 供测试定位。

### 7.2 空态去重

- `conversation-blocks.tsx` `ConversationEmptyState` 删除提示 pills 行（Enter 发送 / Shift+Enter 换行 / 不自动附加上下文，与 composer 底栏 `enterHint` 重复）与 CTA 下方重复的「附加上下文」链接（header「Open context pane」与 composer 底栏入口仍在）；保留居中图标、标题、说明、单一 CTA。组件 props 收敛为仅 `onStartConversation`，调用点 `agent-conversation-workspace.tsx` 同步。
- 随之删除死 i18n key：`emptyEnter`、`emptyShiftEnter`、`emptyNoAutoContext`、`inspectContext`（源 JSON + catalog-policy 同步）。

### 7.3 过滤器按需渲染

- `session-rail.tsx`：无持久化线程（`sessions.length === 0` 且无搜索词、过滤为默认 recent）时不渲染 SegmentedControl；一旦用户输入搜索词或切到非默认过滤，即使结果为空也保留（避免无法切回）。搜索框与新建按钮不变。

### 7.4 测试/e2e 断言与证据

- `apps/web/test/agent-conversation-workspace.test.tsx`：
  - 「renders server-authored composer tool descriptors…」改为断言底栏指示 + 点击展开 Popover 明细（needs_contract 仍可读、无 mutation 控件）；新增 composer 内无常驻 `[role=list]` 的反向断言。
  - 「打开审阅」用例中 needs_contract 计数断言 `>= 2` → `>= 1`（composer 常驻行已砍，审阅面板内仍诚实显示）。
  - 「opens one pane…」的「Attach context」触发改为 header「Open context pane」（空态链接已删）。
  - 新增 3 例：空态单一 CTA + pills 不存在、无线程时过滤器隐藏且搜索/新建保留、有线程时过滤器渲染。
- `apps/web/e2e/agent-first.spec.ts`：三视口与 200% 用例的 pane 触发由空态「Attach context」改为 ≥430px 走 header「Open context pane」、窄视口走 composer 底栏「Open explicit context」（header 按钮 `@[430px]` 以下隐藏，属既有响应式行为）。spec 无常驻 chips 行断言，无需其他改动；`agent-pi-workspace.spec.ts` 的 Session filters 断言均在线程存在时执行，不受 7.3 影响。
- 截图证据（临时 spec 拍摄后已删）：`temp/agent-shell-visual-r1/after-r2-1440.png`（1440 全壳：空态单 CTA、rail 过滤器、composer 无常驻 chips 行）、`after-r2-composer.png`（composer 特写：底栏「● 2 项能力不可用」）、`after-r2-capability-popover.png`（Popover 展开：project.list / episode.create 各带「缺少合同」StatusChip + reason code）。
- 黑名单复过：本次 diff 未引入渐变/玻璃/大面积状态底色（状态点 6px、文字色复用既有 token）；未新增依赖；未改 aria/data 合同（被砍 chips 行属刻意行为变更，其专属断言已同步改写）。

### 7.5 返修验证记录

- `bun run typecheck`：通过。
- `bun run compose:i18n`：OK（2465 keys，净 -4+2 后较 6.5 节 -2）；`bun run check:i18n`：OK。
- `bun run --cwd apps/web vitest run`：944 passed / 3 failed（3 例仍为 HEAD 已知 orbit-visual-blacklist ×2、studio-file-preview ×1，未处理）。
- `bun run --cwd apps/web e2e -- agent-first`：6 passed / 0 failed。

## 8. dsh 对齐与尺寸密度归一（评审反馈：三个实心蓝 CTA 竞争、元信息条太密、空态不够 hero、composer 底栏条目过多、控件比例奇怪）

### 8.1 accent 纪律（单主 CTA）

- `session-rail.tsx`：「新建线程」从手写实心 accent 整宽按钮改为 design-system `Button variant="secondary" size="sm" icon="action.newThread"`（i18n key `agent.conversation.newThread` 不变），与搜索框同为填充式控件档位。
- `conversation-blocks.tsx` `ConversationEmptyState`：删除独立实心 CTA「描述一个目标开始」与两段说明（hero 化后 composer 即唯一主行动，见 8.3）。死 key `emptyDescription`/`emptyStart` 不再被引用，源 JSON 保留未删（check:i18n 不查未用 key）。
- 全壳实心 accent 只剩 composer「发送」一个。

### 8.2 header/元信息条瘦身

- `composer.tsx` `SessionControlStrip`：五列元信息网格（注意事项/运行时/实时更新/上下文/只读）收敛为单行极简状态条——状态点 + 「注意事项 · 运行时 · 上下文」单行 truncate 文本 + 尾部 more 图标；整行即 Popover trigger（44px 触控高）。
- 完整诚实性元信息（含实时更新·确认时间、动作模式·动作灰度）原样移位进 Popover（带 dt 标签的两列 dl），只移位不删除；`data-agent-session-control-strip`、aria-label、`role="status"` 的 sr-only live 公告不变。
- `conversation-header.tsx` 未改：现状已是标题+状态行+ghost 操作，符合目标形态。

### 8.3 空态 hero 化

- 空会话时 composer 上移居中成为主角：`agent-conversation-workspace.tsx` 中 composer 提升为单实例 `composerElement`，空态靠「时间线 flex-1（品牌位 mt-auto 锚底）+ composer + 间隔 flex-1」夹到垂直中心，**不重挂载**（避免丢焦点/草稿，也规避了重挂载导致的 findByText 命中已卸载 textarea 的竞态）；有会话时间隔区消失，composer 回底部 dock。
- `ConversationEmptyState` 收敛为小品牌位（10px accent-tint 圆角瓦片图标 + 一行标题），大标题/说明/CTA 堆叠全删。
- `Composer` 新增 `docked` prop：hero 时去掉 dock 顶部分隔线与横向 padding；`data-agent-composer`、`Message Agent` aria 名、focus/提交行为不变。

### 8.4 composer 底栏收敛

- 「命令」trigger 图标 `action.command` → `action.add`（+ 菜单），可访问名保持「命令」；「引用保持显式」提示从底栏移入 + 菜单底部（`role="none"` 非交互行，mention 图标 + 原文案）。
- 底栏仅剩：+ 菜单、附加上下文、能力不可用指示（既有 Popover，不变）、发送/停止。菜单项可访问名不变（插入功能面板/准备上下文包/刷新上下文/停止回合）。

### 8.5 尺寸密度归一

- `styles.css` 44px 触控覆盖块追加「视觉/触控分离」：agent 作用域内 `.wb-tooltip-icon-button` 与 `.wb-segmented-control-item` 用透明上下 border + `background-clip: padding-box`，元素盒保持 44px（e2e touch-target 断言量的是元素盒），填充/hover 底色只画 ~32px；icon button 顺便收敛为幽灵形态（默认透明底透明边，hover 显底），对齐视觉语言「header 按钮=幽灵按钮」。
- rail「新建线程」（secondary 44px）与搜索框（44px）同档；过滤器分段控件视觉高度回落到 32px 档。

### 8.6 验证与证据

- `apps/web/test/agent-conversation-workspace.test.tsx`：空态用例改写为「单一 hero composer 无堆叠 CTA」——断言 CTA 按钮不存在、`[data-agent-empty-hero]` 品牌位存在、composer 单实例；其余断言（命令菜单、能力指示、控制条 legacy 缺席等）无需变动，76/76 通过。
- `apps/web/e2e/agent-first.spec.ts` 断言零改动：可访问名全部保持，44px 触控断言与 axe 在视觉/触控分离后仍绿。
- 截图证据（临时 spec `tmp-agent-shell-r3-shots.spec.ts` 拍摄后已删）：`temp/agent-shell-visual-r1/after-r3-1440.png`（空态 hero：品牌位+居中 composer、单行状态条、唯一实心 accent=发送）、`after-r3-conversation-1440.png`（有会话时 composer 回底部 dock）、`after-r3-composer.png`（composer 特写：底栏仅 +/附加上下文/发送）、`after-r3-composer-menu.png`（+ 菜单：四命令 + 引用保持显式）、`after-r3-control-strip-popover.png`（完整元信息 Popover）、`after-r3-1024.png` / `after-r3-390.png`（平板/移动 hero）。
- 黑名单复过：本次 diff 未引入渐变/玻璃/大面积状态底色/新实心 accent；未新增依赖；未改 aria/data 合同（`data-agent-empty-hero` 为新增测试定位属性，不替换既有选择器）。
- 验证记录：`bun run typecheck` 通过；`bun run compose:i18n` / `check:i18n` OK（2465 keys，无新增/删除 key，全部复用既有 key）；`bun run --cwd apps/web vitest run` 944 passed / 3 failed（仍为 HEAD 已知 orbit-visual-blacklist ×2、studio-file-preview ×1，未处理）；`bun run --cwd apps/web e2e -- agent-first` 6 passed / 0 failed（含 44px touch-target 与 axe 断言）。

## 9. 能力 Popover 重设计与语言切换器顶栏内嵌（评审反馈：Popover 信息三份重复/名称截断/无分组；语言切换器浮空脱节）

### 9.1 能力不可用 Popover 重设计

- `composer.tsx`：Popover 内容从「截断名 + 大黄 pill + 同级 raw code」重排为——容器限宽 340px（`max-w-[calc(100vw-32px)]` 兜底窄屏）、限高 `min(360px,100vh-160px)` 内部滚动；新增模块级 `groupToolsByDomain`（操作名 `.` 前缀即域，组内保 server 顺序、组序按首次出现稳定），组间发丝线 + muted mono 大写组标（`role="group"` + aria-label=域名）；每行 24px 节奏（`min-h-6`）= 完整 mono 操作名 + tint StatusChip。
- 超长名（>34 字符）尾部省略 + design-system `Tooltip` 显示全名（span 仅此时带 `tabIndex=0`，键盘可达；SR 读的是未截断全文，不依赖 tooltip）。
- `action-descriptor-ui.tsx` `ActionDescriptorStatus` 新增可选 `reasonPlacement?: "inline" | "secondary"`（默认 `inline`，Board/Inspector/Context Menu/Command Palette/Activity Rail 等既有调用方零变化）：`secondary` 把 raw reason code 降为 chip 下方 10px muted 小字，状态语义由 chip 承载、code 仍可读（调试/测试），诚实性不弱化——`data-wb-action-descriptor-status`/`data-availability`、StatusChip 的 visually-hidden description（recoveryHint）原样保留。
- 恢复/审阅入口：该 Popover 原实现本就不渲染 `ActionRecoveryButton`（只读明细），无既有入口被移除；composer 外各入口的恢复按钮不受影响。
- 文案：零新增 key（复用 `composer.tools`/`toolsUnavailable`/`capabilityCount` 与 availabilityLabel 既有 key）；`compose:i18n`/`check:i18n` 均 OK（2465 keys 不变），catalog-policy.json 未动。

### 9.2 语言切换器顶栏内嵌

- `shell.tsx` `Chrome`：window-bar 右侧新增 `.window-bar-tools` 操作簇，`<LocaleSwitcher/>` 与命令面板搜索图标同排同档（30px 幽灵档位）。
- `provider.tsx` `LocaleSwitcher`：加 lucide `Globe` 图标（既有依赖）+ `Select size="sm"` + `locale-switcher-select` 样式钩子；可访问名/角色（combobox「语言」）、选项文案（中文（简体）/English (US)）、`localStorage` 切换行为全部不变。
- `styles.css`：`.window-bar > button` 绝对定位规则改为 `.window-bar-tools` 簇（right:16px flex）；新增 `.locale-switcher` 基础布局与 `.window-bar-tools` 作用域的幽灵 trigger 覆盖（透明底/边、hover 显底、11px）；`@media(max-width:767px)` 隐藏 trigger 内 value 文本只留 globe+chevron（aria-label 保留，不溢出）。
- `app.tsx`：全局 fixed `<aside className="global-locale-tools">` 改为仅非 Chrome 路由（studio/eikona/gateway/gallery 等）兜底渲染，Chrome 路由（/agent、/overview、/workspace、/tasks、/connections）由内嵌实例接管，同页无双实例。`.global-locale-tools` fixed CSS 保留——仍有消费者（非 Chrome 路由 + `foundation-gallery.spec.ts` 移除钩子 + `studio-icon-guidance-r2.spec.ts` 的 `.locale-switcher select`），不满足「无其他消费者」的删除条件。

### 9.3 断言同步与验证

- `locale-source-modularization.spec.ts` ×2 处：`.global-locale-tools` 作用域 locator → `.window-bar-tools`（两例页面均为 Chrome 路由）；combobox「语言」+ option 点选交互不变。`agent-first.spec.ts`、`foundation-gallery.spec.ts`、`studio-icon-guidance-r2.spec.ts` 零改动。
- `routes.test.tsx`「app shell exposes the localized locale control」：改为断言 `.window-bar-tools` 内 combobox 存在且 Chrome 路由不再渲染 `.global-locale-tools` aside。
- `agent-conversation-workspace.test.tsx` 零改动通过（指示器、`role=list`「Agent 工具」、`scene.create` 全文、`data-availability="needs_contract"` 断言全部兼容新结构）。
- 验证记录：`bun run typecheck` 通过；`bun run compose:i18n`/`check:i18n` OK（2465 keys 不变）；`bun run --cwd apps/web vitest run` 944 passed / 3 failed（仍为 HEAD 已知 orbit-visual-blacklist ×2、studio-file-preview ×1，未处理）；`bun run --cwd apps/web e2e -- agent-first` 6 passed / 0 failed（含 44px touch-target 与 axe、390px 溢出断言）；`e2e -- locale-source-modularization` 2 passed / 2 failed——2 例失败为 ui-controls-r1 review-report 已归因的 **C-5**（assertPageSafety 捕获 64 条 serious color-contrast，违规节点为 `.state-badge.state-available` 等 Localization Pane 既有元素，与本次 diff 无关；两例的 locale 切换交互步骤均已通过后停在 axe 断言）；`studio-icon-guidance-r2` 5 例失败为已归因 **C-2**（英文断言 vs zh-CN 默认 locale，未触及 `.locale-switcher` 行），无回归。
- 截图证据（临时 spec `tmp-agent-shell-r4-shots.spec.ts` 拍摄后已删，fixtures 复用 agent-first 套路 + 9 个跨 3 域非 ready 工具）：`temp/agent-shell-visual-r1/after-r4-1440.png`（全壳：切换器内嵌顶栏右簇、不再浮空）、`after-r4-capability-popover.png`（域分组 + 发丝线 + 完整 mono 名 + tint chip + 次级 reason code + 超长名 Tooltip）、`after-r4-locale-switcher.png`（顶栏右簇特写：globe + 中文（简体）幽灵 trigger 与搜索图标同档）、`after-r4-locale-menu.png`（下拉展开态）。逐张 ReadMediaFile 过审：无渐变/玻璃/大面积状态底色，圆角/发丝线/阴影符合视觉语言。
- 黑名单复过：未新增依赖（lucide-react 为既有依赖）；未改 design-system 控件 API（`reasonPlacement` 是 workbench 侧组件的可选 prop）；aria/可访问名全部保持；`data-agent-capability-indicator`、`role=list` 等测试钩子不变。

## 10. 能力展示用户化（评审反馈：`character.get` 等原始操作 ID 对终端用户无意义）

依据 spec「Capability availability SHALL be presented in user-meaningful impact language」：主表达改为域级影响（本地化域名 + 主导状态 + 恢复路径），原始操作 ID / reason code 只进默认折叠的技术明细 disclosure。

### 10.1 域级影响列表

- `composer.tsx`：能力 Popover 主列表重构——每行 = 本地化域名 + 该域主导状态 chip（既有 `StatusChip`，外包 span 保留 `data-wb-action-descriptor-status`/`data-availability` 钩子）+ 主导恢复路径（取域内第一个达到主导状态的工具的 server-authored `recoveryHint`，muted 次级行）。不再逐行列操作名。
- 域映射：模块级 `CAPABILITY_DOMAIN_LABEL_KEYS`，覆盖 server catalog（`service/internal/agentruntime/catalog.go`）与 fixtures 实际出现的 5 个域——`project` 项目/Projects、`episode` 剧集/Episodes、`scene` 场景/Scenes、`character` 角色/Characters、`handoff` 交付/Handoffs；未知域回退 `domain.other`（其他能力/Other capabilities）+ 原始前缀 mono muted 次级文本（诚实，不伪造）。
- 主导状态：`AVAILABILITY_SEVERITY` 按严重度取域内最差（offline/unavailable > conflict/unknown_accept > stale/partial/permission_required/needs_contract）。
- 页脚指示从操作计数改为域级计数：新 key `composer.capabilityDomainCount`「{count} 类能力暂不可用 / {count} capability groups unavailable」（替换 `capabilityCount`，无其他消费者）；`toolsUnavailable` 时沿用「工具目录不可用」。
- 保持：仅非 ready 时渲染；`role="list"` aria-label「Agent tools/Agent 工具」不变。

### 10.2 技术明细 disclosure

- Popover 底部新增原生 `<details data-agent-capability-technical-details>`（默认折叠、状态不持久化、summary 原生键盘可达），summary 文案新 key `composer.technicalDetails`「技术明细 / Technical details」。
- 展开后为原 §9.1 的域分组逐项明细：mono 完整操作名（超长省略 + Tooltip）+ `ActionDescriptorStatus`（StatusChip + 次级 reason code + recoveryHint description）——诚实性真值全部保留可达，仅分层。

### 10.3 全 ready 零占位

- 既有行为（`pendingTools` 为空且非 toolsUnavailable 时不渲染指示）未改；`agent-conversation-workspace.test.tsx` 新增断言「renders no capability indicator when every tool descriptor is ready」（fixture 加 `toolsReady` 选项），e2e 同步新增同义用例。

### 10.4 验证与证据

- i18n：zh-CN/en-US 各 +8 key（6 域标签 + `capabilityDomainCount` + `technicalDetails`）、-1 key（`capabilityCount`）；`catalog-policy.json` 同步登记（`capabilityDomainCount` 沿用 security/protected 策略，其余 normal/overrideable）。`bun run compose:i18n` OK（2472 keys）、`bun run check:i18n` OK。
- 单测：`agent-conversation-workspace.test.tsx` 能力 Popover 用例改写为域级断言（主列表含「场景/Scenes」、不含 `scene.create`/`needs_contract`；disclosure 默认折叠且含全部真值）+ 新增零占位用例。`bun run --cwd apps/web vitest run`：945 passed / 3 failed——仍为 HEAD 已知 orbit-visual-blacklist ×2、studio-file-preview ×1，未处理。
- e2e：`agent-first.spec.ts` 新增 2 例（域级影响 + 折叠 disclosure 展开后真值可达；全 ready 零占位），fixture 路由加 `tools` 选项。`bun run --cwd apps/web e2e -- agent-first`：8 passed / 0 failed。
- `bun run typecheck` 通过。
- 截图（临时 spec `tmp-r5-evidence.spec.ts` 拍摄后已删；fixtures 跨 scene/character/未知域 `quantum` 4 个非 ready 工具）：`temp/agent-shell-visual-r1/after-r5-capability-domains.png`（域级列表：场景/角色/其他能力 quantum + 主导 chip + 恢复路径 + 折叠技术明细，页脚「3 类能力暂不可用」）、`after-r5-technical-details.png`（展开态：SCENE 组 mono 全名 + chip + reason code）、`after-r5-all-ready.png`（全 ready 时 composer 底栏无指示）。逐张 ReadMediaFile 过审：主列表无原始操作 ID/reason code，未知域诚实回退，视觉语言与 §9 一致。
- 黑名单复过：未新增依赖；未改 design-system 控件 API（仅消费既有 `StatusChip`）；原生 `<details>` 键盘可达；非删除元素的 aria/可访问名保持。

## 11. Composer 照齐 dsh 参考（评审反馈：照着参考图抄，差距太大）

### 11.1 卡片形态

- `composer.tsx` 容器：圆角 `panel`(12px) → dock 态 `overlay`(14px) / hero 态 16px；边框 `--wb-border-subtle` → `color-mix(... 55%, transparent)` 近隐形低透明边；投影 `elevation-raised` → `elevation-popover` 柔和浮起；填充底保持 `--wb-surface-elevated`（比 canvas 微亮，不靠描边区分）。
- hero 与 dock 两种模式统一 `max-w-[720px] mx-auto w-full` 限宽居中（原 820px、hero 实际更宽）。
- padding 放宽：textarea `14px/16px/8px`，chips 行 `px-4`，底栏 `px-4 pb-3.5`；textarea 无边框无背景融入卡片、placeholder 顶左（既有 inline 中和逻辑保持）。
- `data-agent-composer`、「Message Agent/发送 Agent 消息」aria 名、focus-within accent 描边全部保持。

### 11.2 发送钮圆形化

- 发送从带文字的 primary Button 改为 icon-only 圆形实心 accent（registry `action.send` 图标，aria-label「发送/Send」逐字保持，Button primitive + inline style 中和：未分层 primitive CSS 压过 Tailwind 工具类，故用 `borderRadius: pill / padding:0 / gap:0` inline 覆盖，与 TextArea 中和套路一致）。
- 触控/视觉分离：壳级 44px 合同不动（元素盒 44×44，e2e undersized-targets 断言绿），inline `border: 6px solid transparent` + `backgroundClip: padding-box` 让 accent 填充只画 32px 视觉圆——复用 §8.5 既有模式。
- loading 态保留（spinner 在圆钮内，截图 `after-r6-composer-loading.png`）；空草稿 disabled 态降透明至 0.45（dsh 的灰化发送）；`hover/active/focus-visible` 沿用 primary primitive 既有规则。
- 「Enter 发送 · Shift+Enter 换行」从底栏文字移除，迁入发送钮 Tooltip（复用既有 key `composer.enterHint`，零新增 key；zh/en + catalog-policy 均未动）。

### 11.3 底栏极简

- 左簇：「+」菜单 IconButton 圆形化（inline `borderRadius: pill`）、附加上下文 ghost 按钮。
- 右簇：能力指示（仅非常备时出现，从左簇迁入右簇，Popover `align` 随位置改 `end`）+ 圆形发送；Enter 提示文字删除。间距 `gap-1.5`、`items-center` 垂直居中。
- dsh 右簇的「选择器类控件」（模型/模式选择器）本产品无对应能力，未做（诚实：不伪造无功能控件）。

### 11.4 文档、断言与验证

- `docs/design/agent-visual-language.md` §7 组件形态映射新增 composer 行（elevated 填充 + 低透明边 + 柔和投影 + dock 14/hero 16 圆角 + 720px 限宽居中 + 圆形发送钮），与 §2 圆角刻度一致。
- 断言同步：零改动——`agent-conversation-workspace.test.tsx` 77/77 通过；`agent-first.spec.ts` 8/8 通过（含 44px touch-target 与 axe）。可访问名全部保持，无选择器变化。
- 验证记录：`bun run typecheck` 通过；`bun run --cwd apps/web vitest run` 945 passed / 3 failed（仍为 HEAD 已知 orbit-visual-blacklist ×2、studio-file-preview ×1，未处理）；`bun run --cwd apps/web e2e -- agent-first` 8 passed / 0 failed；`bun run compose:i18n` / `check:i18n` OK（2472 keys 不变，复用既有 key 无增删）。
- 截图证据（临时 spec `tmp-agent-shell-r6-shots.spec.ts` 拍摄后已删，fixtures 复用 agent-first 套路）：`temp/agent-shell-visual-r1/after-r6-hero-1440.png`（hero 空态：居中 720px 卡片、disabled 灰化圆钮）、`after-r6-dock-1440.png`（dock 会话态：底部 dock 14px 圆角）、`after-r6-composer-focus.png`（focus-within accent 描边）、`after-r6-composer-draft.png`（有草稿：圆形实心 accent 发送）、`after-r6-composer-loading.png`（spinner 在圆钮内）、`after-r6-composer-menu.png`（+ 菜单展开）。逐张 ReadMediaFile 过审：elevated 填充、近隐形边、柔和投影、稀疏底栏与 dsh 参考形态一致；无渐变/玻璃/大面积状态底色。
- 黑名单复过：未新增依赖；未改 design-system 控件 API（仅消费 Button/IconButton/Tooltip 既有 props）；诚实性指示（能力不可用 Popover 域级列表 + 技术明细）原样保留；aria/data 合同选择器不变。
- 已知形态差异（未做，供后续裁决）：textarea 固定 minRows=3（dsh 为 1 行起自适应伸展）；dock 态保留壳级 hairline 顶部分隔线（dsh 无）；发送图标为 registry `action.send` 纸飞机（dsh 为上箭头）——均不在本次任务范围。

## 12. 交互过程展示美化（评审反馈：agent 交互来回调用过程展示，对齐 Eikona 01 对话参考）

### 12.1 工具调用行人读化

- 工具行重构为 01 形态：icon tile（8px 圆角 elevated 瓦片，registry 图标按工具映射）+ mono 工具名 + 人读中文描述 + 右侧状态色文字 + 真实耗时；`tool.call.start:xxx` 等原始事件名不再是主文本（仍保留在「事件明细」与行内展开的事件列表中，诚实性不降）。
- 映射复用既有 `toolActionCopy`（`read_context`→读取上下文包、`search_index`→检索安全索引、`check_constraints`→核对约束与权限，与服务端 reference adapter 实际发出的工具名一一对应）；新增 `toolActionDescription()`：仅在有映射时返回人读描述，未知工具不伪造描述、保留 mono 名作主文本。图标映射 `toolActionIcon()`：read_context→`resource.contextObject`、search_index→`action.search`、check_constraints→`action.check`、未知→`action.command`。

### 12.2 工具执行区块化 + 事件明细 disclosure

- `conversation-model.ts` 新增 `groupToolExecutionBlocks()`：同一回合内连续 tool 块聚合为渲染单元；`conversation-blocks.tsx` 新增 `ToolExecutionSection`（区段头「工具执行 N/M」，N=done 数，M=总数；行列表 `divide-y` 发丝线分隔）。workspace 渲染循环按单元分发，单块兜底仍走同一区段组件。
- 回合卡的原始事件流水（`tool.call.start:*`/`turn.thinking`/`turn.succeeded` 等）收进默认折叠的「事件明细」原生 `<details>`（`data-agent-event-details="true"`，summary 键盘可达，含计数；内部 `<ol>` 的 aria-label「回合事件」与行结构不变）。
- 每行钩子原样保留：`data-block-kind="tool"`、`data-tool-action`、`data-tool-state`、running 行 `data-agent-tool-shimmer`（motion-safe）、行 aria-label「工具调用 {action}」、行内展开的事件列表 aria「安全事件细节」。

### 12.3 推理摘要折叠区段

- 思考行标题「思考」→「推理摘要」（`agent.conversation.thinking.title` 值更新）；summary 行右侧新增「思考用时 {duration}」（`thinkingDurationMs()`：真实 thinking 事件首尾时间差，不足两行不显示，不伪造）；running 时 icon 保持 motion-safe pulse，预览行逻辑（running 取最新一行、settled 取首行）不变。

### 12.4 提案确认横幅

- 提案卡从「发丝线区段 + 左 accent 条」改为 01 的确认横幅形态：warning tint 底（7% color-mix）+ 低透明边 + panel 圆角；warning 色 icon tile（`state.permissionRequired`）+ 「提案」标题 + server safeSummary 说明 + meta 行（新鲜度 + availability StatusChip，reason code 用既有 `reasonPlacement="secondary"` 降为次级 muted 小字）+ 操作按钮行（「审阅」迁 Button primitive secondary sm + `action.review` 图标，unknown_accept 时「仅协调」提示保留）。
- 不新增伪造的批准能力：审批仍走既有 review pane / Proposal Authority 链路；`data-agent-proposal-banner="true"` 新钩子，article aria「提案卡片」不变。结果卡保持原形态（kind chip 仍仅结果卡使用）。

### 12.5 回合卡头信息分层

- 卡头主视觉：状态点/转轮 + 「回合」标题 + StatusChip（`turnStatusChip()` 映射 turn 状态→WorkbenchStatus，label 仍用本地化 statusLabel）+ 右侧「用时 {duration}」（终态且有真实事件时长时）+ 时间 + 「查看回合」（迁 Button ghost sm，aria 名不变）。
- 「N 个安全事件 · Task · id」降为 10px muted meta 行；server 下发的 safeSummary 原文保留但视觉降权（truncate + muted xs）；unknown_accept 警示行与「协调」按钮原样保留。

### 12.6 验证与证据

- i18n：新增 `agent.conversation.thinking.duration`、`agent.conversation.toolGroup.title`、`agent.conversation.toolGroup.aria`、`agent.conversation.run.duration`、`agent.conversation.run.eventDetails`（zh/en + catalog-policy）；`agent.conversation.thinking.title` 值更新；`agent.conversation.run.stats` 删除（被拆分文案取代）。`bun run compose:i18n` / `check:i18n` OK（2476 keys）。
- 断言同步（`agent-conversation-workspace.test.tsx`）：思考标题断言「思考」→「推理摘要」；run stats 拼接文案断言拆为「用时 3.9s」+「8 个安全事件」两条（3 处）；新增区段断言——`data-agent-tool-group` 含「工具执行」+「2/2」与两行 tool、`data-agent-event-details` 默认折叠且含原始事件 code、思考用时「思考用时 3600s」（真实时间差）。可访问名与 data 钩子全部保持。
- 验证记录：`bun run typecheck` 通过；`agent-conversation-workspace.test.tsx` 77/77；`bun run --cwd apps/web vitest run` 945 passed / 3 failed（仍为 HEAD 已知 orbit-visual-blacklist ×2、studio-file-preview ×1，未处理）；`bun run --cwd apps/web e2e -- agent-first` 8/8（零断言改动）。
- 截图证据（临时 spec `temp-r7-shots.spec.ts` 拍摄后已删；fixtures 为确定性 11 事件流：2×thinking + 3 工具 start/end + segment + proposal + succeeded）：`temp/agent-shell-visual-r1/after-r7-conversation-1440.png`（完整回合：卡头分层 + 事件明细折叠 + 推理摘要 + 工具执行 3/3 + 提案横幅）、`after-r7-event-details-1440.png`（事件明细展开：mono code + 状态 + 时间）、`after-r7-reasoning-open-1440.png`（推理摘要展开）。逐张 ReadMediaFile 与 01 参考比对：工具执行区段（icon tile + mono 名 + 中文描述 + 绿勾完成 + 耗时 + 发丝线）、推理摘要折叠 + 右侧用时、确认横幅（图标 + 说明 + 操作按钮）形态均已对齐。
- 与 01 的诚实差异（不伪造，供知晓）：无「进度」阶段条（无对应真实数据）；「引用的制品」chips 行保留既有渲染但 live proposal 投影不含 basisRefs 时不出行；无「批准并继续」按钮（审批走 review pane，不伪造 approve 能力）；运行中/等待中混合态只在 live 流进行中真实出现。
- 黑名单复过：未新增依赖；未改 design-system 控件 API（仅消费 StatusChip/Button/ActionDescriptorStatus 既有 props 与 `reasonPlacement` 既有选项）；原生 details 键盘可达；44px 触控合同与 axe 断言随 agent-first e2e 全绿。

## 遗留项

- 61 例 C 类 e2e 失败仍为 HEAD 既有（归因见 `openspec/changes/workbench-ui-controls-r1/review-report.md` e2e 收尾一节），建议另开 change 处理；修复 C-1/C-2 后 `workbench.spec.ts`、`eikona-independent-client.spec.ts` 的旧截图基线很可能出现真实 diff，届时需按流程逐图签认。
- design-system 密度 token（sm=32/md=36/lg=40）与壳级 44px 合同存在结构性张力：primitive 未分层 CSS 会压过壳的 Tailwind min-h 工具类。本次以 styles.css 作用域覆盖兜底；后续其他壳/页面迁移 primitives 时需复用同一模式或在 token 层解决。
- 3 例 vitest HEAD 已知失败（orbit-visual-blacklist ×2、studio-file-preview ×1）不在本 change 范围，未处理。
