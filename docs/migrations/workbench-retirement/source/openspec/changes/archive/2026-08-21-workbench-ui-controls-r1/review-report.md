# UI Controls R1 迁移视觉审查（阶段 F · 任务 6.3）

日期：2026-08-16

## 结论

**GO（本地交付）**。UI Spec §8 视觉黑名单逐项过审无违例；迁移面截图证据已归档到 `temp/`（gitignored，按 AGENTS.md 约定不入库）。

## 审查范围与方式

审查方式：**浏览器截图 + 源码静态过审**（本环境 Playwright chromium 可用）。审查面：

- `/agent` 主壳与会话画布（Pane dock 关闭态主壳）；
- `/agent` 命令面板（Ctrl+K，`CommandPalette` composite 统一后的实现）；
- 含 Dialog 的流程：`/tasks/:taskId` 权限 gate 确认（`Dialog` 封装，`tone="alert"` → `role="alertdialog"`）；
- 含 Select 的页面：`/orbit` 跨项目工作图表/表格 pane（两处原生 `<select>` 迁移后的 `Select` 过滤器 + `SearchBox`）；
- 控件全矩阵：`/design-system/foundation-gallery` 截图基线（任务 6.2，三视口 + reduced-motion）。

截图证据（本次运行生成，不入库）：

- `temp/ui-controls-r1-visual-review/agent-shell-1440x960.png`
- `temp/ui-controls-r1-visual-review/agent-command-palette-1440x960.png`
- `temp/ui-controls-r1-visual-review/task-gate-dialog-1440x960.png`
- `temp/ui-controls-r1-visual-review/orbit-select-1440x960.png`
- 基线：`apps/web/e2e/foundation-gallery.spec.ts-snapshots/`（4 张，入库评审）

静态过审命令与结果：

- `grep -rn "linear-gradient|radial-gradient" apps/web/src/design-system/primitives/ composites/pane-*` → 零命中；
- `grep -rn "backdrop-filter" apps/web/src/design-system/{primitives,composites}/*.css` → 零命中；
- emoji 扫描（U+1F300–U+1FAFF、U+2600–U+27BF）新控件源文件 → 零命中；
- `grep -rln "toast" apps/web/src/workbench/agent apps/web/src/workbench/shell.tsx` → 零命中。

## 黑名单逐项结论

| 黑名单项 | 结论 | 依据 |
| --- | --- | --- |
| Hero | 无 | agent-shell 截图：会话画布为空态引导文案 + 单一 primary 入口，无营销 Hero |
| KPI 卡片墙 | 无 | orbit/task 页为数据行与表格局部统计，非卡片墙；gallery 无 KPI fixture |
| 无意义渐变 | 无 | 静态 grep 零命中；控件 CSS 只消费 `--wb-*` token |
| 厚玻璃 | 无 | `backdrop-filter` 零命中；overlay 为深色实底 + token 阴影 |
| 随机 emoji | 无 | emoji 扫描零命中；图标全部走 `WorkbenchIcon` registry |
| 全屏空 Canvas | 无 | agent 空态有明确引导文案与动作（见 agent-shell 截图） |
| 假实时 | 无 | 迁移未新增轮询/伪 stream；`unknown_accept`/offline 状态如实显示（gallery data-state 矩阵） |
| 假成功 toast | 无 | toast 零命中；gate Dialog 文案明确 "The server remains authoritative"，不乐观标记成功 |
| provider logo 导航 | 无 | 导航 rail 为语义图标，无 provider logo |
| 嵌套卡片 | 无 | 截图审查：pane/dialog 内无卡片套卡片；fixture 用发丝线分隔 |
| 无原因 disabled | 无 | 交互控件的 `disabled` 合同要求 `disabledReason`（tooltip 展示）；gallery 每个 disabled fixture 均带原因（如 "The owner contract is not connected"）；命令面板禁用项显示 read-only/原因文本 |

## 遗留风险（与本 change 无关的既有问题）

- 既有 e2e 套件中 `page.route(/\/v1alpha1\//)` catch-all 模式（`orbit.spec.ts`、`workbench.spec.ts`、`comic-drama-production.spec.ts`，以及 `identity-team.spec.ts` 的 `**/*` 模式）会意外拦截 Vite 模块请求 `/@fs/.../api/schema/workbench/board/v1alpha1/board-type-registry.json?import`（路径含 `/v1alpha1/`），导致页面白屏、`orbit.spec.ts` 6/6 失败。该机制在当前 HEAD（6abd1f1）即存在，`board-registry.ts` 与相关 spec 均未被子项目改动，非 ui-controls-r1 引入。修复方向：把 catch-all 改为 `url.pathname.startsWith("/v1alpha1/")` 谓词（本审查的临时捕获 spec 已验证可行）。建议另开 change 处理。

## 全量 e2e 现状（任务 6.5 如实记录，2026-08-16）

`bun run --cwd apps/web e2e`：16 passed / 57 failed / 4 skipped。本 change 新增的 `foundation-gallery.spec.ts` 4/4 通过。失败分类：

- catch-all 拦截模块请求（上述既有机制）→ 白屏超时，占多数；
- 16 例 `toHaveScreenshot` 基线 diff：阶段 A–E 迁移改了真实 UI，`workbench.spec.ts`、`eikona-independent-client.spec.ts` 等的旧基线图需要按 D3 §10.4 流程 `--update-snapshots` 评审更新——属迁移预期后果，需逐图签认；
- `agent-first.spec.ts` 对 locale 切换器使用 `locator.selectOption`，该控件已迁为 `Select` primitive（combobox button），需改为 Select 交互（迁移直接的测试兼容 fallout）。

以上 e2e 修复/基线签认超出阶段 F（任务 6.1–6.5）范围，未在本阶段处理。

## e2e 收尾（2026-08-16，阶段 F 之后补做）

对全量 e2e 做了逐条失败分类。方法：`bun run --cwd apps/web e2e` 两轮全量（均 66 failed 稳定复现）+ 在 `git worktree`（HEAD `aea4480`）对照运行 12 个代表性 spec，判定「HEAD 既有」还是「本 change 引入」。收尾后结果：**21 passed / 61 failed / 4 skipped，61 个失败全部归因 C 类（HEAD 既有），无 A/B 类残留**。

### A 类 · 本 change 引入的交互失效（已修复，3 处 spec 改动 + 1 处测试基建）

- `agent-first.spec.ts`「renders the Pi workspace Chinese-first…」：`getByRole("combobox", { name: "语言" }).selectOption("en-US")` → 改为点击 trigger → 点击 `option "English (US)"`（Select primitive 是 button 角色 trigger + 弹层 listbox）。
- `locale-source-modularization.spec.ts`「locale degraded/offline…」×2：`.global-locale-tools select` 断言与 `selectOption` → 改为 combobox trigger 可见性断言 + 点击 option。
- `locale-source-modularization.spec.ts`「locale switching…」内同款 `.global-locale-tools select`（第 224 行）：同为迁移 fallout，一并改为 Select 交互；该测试当前仍红，但剩余失败点是下方的 C 类 axe 对比度问题。
- `agent-first.spec.ts:73`「fails closed…」与 `agent-pi-workspace.spec.ts:225`「1440×960: server-authoritative…」：`page.goto` 在套件冷启动时 `net::ERR_ABORTED`。根因：`webServer` 每次启动全新 Vite dev server，首个导航的 `load` 事件要等整个按需 transform 的模块图（实测冷启动首导航约 48s），超过 30s 测试超时被中止；每个 worker 的首个测试都会撞上。修复：新增 `e2e/global-setup.ts` 并在 `playwright.config.ts` 注册，套件开始前用一个真实浏览器导航 `/agent` 预热 transform 缓存（测试基建修复，不改产品代码）。曾试过 Vite `server.warmup`，无效（不传递爬取模块图），已回退。

修复后 `agent-first.spec.ts`、`agent-pi-workspace.spec.ts` 全绿（14/14），`locale-source-modularization.spec.ts` 的 degraded/offline 两例转绿。

### B 类 · 截图基线签认结论：无一例真实 diff，不更新任何基线

阶段 F 记录「16 例 `toHaveScreenshot` 基线 diff」与实测证据不符，予以更正：两轮全量运行的失败产物中**没有任何** `*-actual.png` / `*-expected.png` / `*-diff.png`，没有任何一例失败停在 `toHaveScreenshot` 比较上——`workbench.spec.ts` 的 4 张基线断言在到达截图前就因 catch-all 白屏（C 类）失败，`eikona-independent-client.spec.ts` 的 4 张在到达截图前就因下文 C-2 的 locale 漂移失败。因此本次 `--update-snapshots` 更新数为 0；`foundation-gallery.spec.ts`（本 change 新增基线）4/4 持续绿。遗留提醒：今后修复 C 类后，workbench/eikona 的旧基线很可能出现真实 diff，届时需按 D3 §10.4 逐图签认。

### C 类 · HEAD 既有问题（本轮只归因，不修复；建议另开 change）

归因方法：`git worktree` 检出 HEAD（`aea4480`）+ 复用 `node_modules` 对照运行；下列每个 spec 在 HEAD 失败数与失败点均与工作树一致（spec 文件本身相对 HEAD 无改动，`git diff HEAD -- apps/web/e2e/` 仅含上述 A 类修复）。

- **C-1 · catch-all 路由拦截 Vite 模块请求 → 白屏（15 例）**：`orbit.spec.ts`（6）、`workbench.spec.ts`（8）、`comic-drama-production.spec.ts`（1）。`page.route(/\/v1alpha1\//)` 命中 `/@fs/…/api/schema/workbench/board/v1alpha1/board-type-registry.json?import`（`app.tsx` 静态导入链：`app.tsx` → `board-console.tsx` → `spatial-board-pane.tsx` → `board-registry.ts`），模块加载失败导致整个应用无法启动，error-context 无 page snapshot（空白页）。修复方向（另开 change）：谓词改 `url.pathname.startsWith("/v1alpha1/")`。
- **C-2 · spec 英文断言 vs 应用 zh-CN 默认 locale（37 例）**：`eikona-independent-client.spec.ts`（8）、`sidebar-navigation.spec.ts`（5）、`workflow-panes.spec.ts`（5）、`spatial-board.spec.ts`（5）、`studio-icon-guidance-r2.spec.ts`（5）、`agent-spatial.spec.ts`（4）、`gateway-console.spec.ts`（3）、`open-design-preview.spec.ts`（2）。这些 spec 未 seed `localStorage("yeisme-workbench:locale")`，`defaultLocale` 为 `zh-CN`（HEAD 起即是），页面渲染中文，英文选择器（如 "Produce workspace"、"Edit sidebar layout"、"Spatial board"、"Backends"、"Design Spine · Brief → Handoff"）全部落空；HEAD 对照运行失败点逐字一致。另注：`agent-spatial.spec.ts` 还期待已被 agent 工作区重设计移除的 "Spatial context canvas"/"Pi Runtime / Chat Agent" 文案。修复方向（另开 change）：spec 统一 seed locale 或改为 locale 无关断言。
- **C-3 · `identity-team.spec.ts`（2 例）**：两例在 HEAD 同样失败；修复冷启动后可见真实失败点为 `heading "Tenant and team"` 未找到（页面 zh-CN 渲染 + team 页文案漂移），属 C-2 同类。其 `**/*` 拦截本身有 `route.continue()` 兜底，未观察到白屏机制命中。
- **C-4 · `daily-ops-panes.spec.ts`（5 例）**：spec 硬编码 `http://127.0.0.1:5173`，而 `playwright.config.ts` 的 webServer 用 4273 → `ERR_CONNECTION_REFUSED`。HEAD 既有（该 spec 在此 config 下从未可运行）。
- **C-5 · `locale-source-modularization.spec.ts` 211/240（2 例）**：`assertPageSafety` 的 axe 断言捕获 64 条 serious `color-contrast` 违规（Localization Pane / Scaena 工作区页），HEAD 与工作树的违规内容、数量、失败行（`locale-source-modularization.spec.ts:185`）完全一致。

### 验证记录

- `bun run --cwd apps/web e2e`：21 passed / 61 failed / 4 skipped（61 失败与上述 C 类逐条对应：C-1 15 + C-2 37 + C-3 2 + C-4 5 + C-5 2 = 61）。
- 逐条核对失败产物 error-context，无新增失败模式、无截图 diff 产物。
