# UI Visual Refresh R1 视觉评审（阶段 4 · 任务 5.1–5.5）

日期：2026-08-17

## 结论

**GO（本地交付）**。gallery 4 张截图基线已按新视觉语言重生成并复跑稳定 4/4 绿；`/agent` 主壳/命令面板/Dialog/orbit 最终截图与 Eikona 02 参考图并排评审，逐维度对齐；UI Spec §8 黑名单逐项过审无违例（渐变/玻璃新增为零）；全量 e2e 21 passed / 61 failed / 4 skipped，61 例失败与 HEAD 既有归因逐条一致，本 change 新增失败为 0，无新增截图 diff。

视觉基线：`prompts/product/ui-reference/workbench-agent-pane/deliverables/02-plugin-pane-workspace.png`。

## 5.1 · gallery 基线重生成

命令：`bun run --cwd apps/web playwright test e2e/foundation-gallery.spec.ts --update-snapshots`（playwright webServer 自起 4273；4173 上的开发服务器未被测试使用）。重生成 4 张入库基线：

- `apps/web/e2e/foundation-gallery.spec.ts-snapshots/foundation-gallery-1440x960-chromium-linux.png`
- `apps/web/e2e/foundation-gallery.spec.ts-snapshots/foundation-gallery-1024x768-chromium-linux.png`
- `apps/web/e2e/foundation-gallery.spec.ts-snapshots/foundation-gallery-mobile-390x844-chromium-linux.png`
- `apps/web/e2e/foundation-gallery.spec.ts-snapshots/foundation-gallery-reduced-motion-1440x960-chromium-linux.png`

复跑（不带 `--update-snapshots`）确认稳定：**4/4 绿**。逐张目检确认控件呈现新语言：

- 按钮：primary 实心 accent 仅限主 CTA（Send safe intent），secondary 为 elevated 填充 + 低透明细边，ghost 无底，destructive 为 tint 底 + 彩色文字；
- 输入/下拉/文本域：填充式（elevated 底 + 低透明边）+ 10px 圆角，invalid 红色描边，disabled 降透明；
- chip/badge：tint 底（status 色 color-mix）+ 彩色文字 + 6px 圆角（Selected safe fixture / Running / 各 data-state）；
- data-state 区段：面板内发丝线分区 + 语义左侧 2px 色条，无卡片套卡片；
- 移动端变体：同一矩阵纵向堆叠，inspector 以底部 Sheet（圆角上边）呈现；reduced-motion 变体与 1440 基线视觉一致、动效禁用。

## 5.2 · 并排评审与 e2e 失败归因

最终截图（`temp/ui-visual-refresh-r1/`，gitignored，不入库；捕获脚本 `shoot-final.ts`，对 4173 开发服务器）：

- `final-agent-shell.png`：`/agent` 主壳空态（四级分层 + 会话 rail + composer 浮层）；
- `final-agent-selected.png`：选中会话后的会话画布（选中行 tint、提案区段、icon-tile）；
- `final-command-palette.png`：命令面板打开态（Ctrl+K）；
- `final-dialog-alert.png`：`tone="alert"` Dialog（gallery fixture，与 gate/确认框同一 Dialog primitive）；
- `final-orbit.png`：orbit 控制台（`/orbit?ownerId=scaena&projectRef=project%3Ademo`，fail-closed 呈现）。

与 02 参考图逐维度对照：

| 维度 | 02 参考 | 实现（最终截图） | 结论 |
| --- | --- | --- | --- |
| 圆角刻度 | 控件 10px / 面板 12px / 浮层 14px / chip 6px | gallery 控件 10px、composer/Pane 12px、palette/Dialog 14px、chip 6px | 一致 |
| 四级层次 | canvas < rail/sidebar < panel < elevated/popover 逐级微亮 | 主壳 canvas 最深，rail 列表区微亮，composer 为 elevated 底 + 柔和投影浮起；palette/Dialog 压暗背景 + 最亮表面 | 一致 |
| accent 用法 | 实心 accent 仅主 CTA，选中/激活用 tint | 实心 accent 仅「新建线程」「发送」主 CTA；激活 tab（orbit Owner Pulse）、选中行、focus 光晕均为 tint | 一致 |
| chip/行态 | tint 底 + 彩色文字 | 「缺少合同」amber tint、「未读」蓝点、「合同缺失」紫 tint、「来源离线」tint；行态为文字 + 小色点 | 一致 |
| icon-tile | 8px 圆角 tint 底瓦片 | rail 导航图标、会话消息行图标均落 tint 瓦片 | 一致 |
| 诚实性 | — | orbit fail-closed 横幅、「不可用·计数来源不可用」如实呈现，未伪造成功 | 保持 |

结构差异说明：实现的 rail/会话列表信息架构为产品既有结构（蓝图真源），本 change 只对齐视觉参数，不对齐参考图的布局结构。

### e2e 全量归因（任务 5.2 第二半）

`bun run --cwd apps/web e2e`：**21 passed / 61 failed / 4 skipped**（3.4m）。61 例失败按 spec 计数与 `workbench-ui-controls-r1/review-report.md`「e2e 收尾」的 HEAD 既有归因**逐条一致**：

| 归因（HEAD 既有） | spec | 例数 |
| --- | --- | --- |
| C-1 catch-all 拦截 Vite 模块请求白屏 | orbit 6 + workbench 8 + comic-drama-production 1 | 15 |
| C-2 spec 英文断言 vs zh-CN 默认 locale | eikona-independent-client 8 + sidebar-navigation 5 + workflow-panes 5 + spatial-board 5 + studio-icon-guidance-r2 5 + agent-spatial 4 + gateway-console 3 + open-design-preview 2 | 37 |
| C-3 identity-team 文案漂移 | identity-team | 2 |
| C-4 daily-ops-panes 硬编码 5173 端口 | daily-ops-panes | 5 |
| C-5 axe color-contrast 既有违规 | locale-source-modularization | 2 |

证据：失败产物目录（`temp/playwright-results/`）中**没有任何** `*-actual.png`/`*-expected.png`/`*-diff.png`——本轮没有任何一例失败停在 `toHaveScreenshot` 比较上（workbench/eikona 的截图断言均在到达截图前被 C-1/C-2 拦截）。因此：

- 截图类失败与 HEAD 既有失败区分结论：**本 change 新增失败 = 0，新增截图 diff = 0**；
- gallery 之外**没有**需要 `--update-snapshots` 的基线（与 controls-r1 B 类结论相同：旧基线的真实 diff 被 C 类失败屏蔽，待 C 类修复后另行逐图签认）；
- `foundation-gallery.spec.ts` 4/4 绿（含在 21 passed 内）。

## 5.3 · 黑名单过审

静态过审（对本 change 改动的全部源码，`git diff HEAD`）：

- `linear-gradient|radial-gradient|backdrop-filter` 逐文件计数对比 HEAD：唯一变化的 CSS 文件 `styles.css` 为 backdrop-filter **19 → 17**（`.dialog-overlay`、`.sidebar-sheet-overlay` 两处厚玻璃随 Dialog/Sheet 迁移被移除），gradient 28/20 不变（全部为 HEAD 既有的 studio/overview/eikona 背景氛围，D3 §10.3 豁免项）；design-system 下 primitives/composites/tokens CSS 零命中；**新增为零**；
- emoji 扫描（U+1F300–U+1FAFF、U+2600–U+27BF）改动文件新增行：零命中；
- `toast` 新增行：零命中。

黑名单逐项结论（依据最终截图 + 上述静态证据）：

| 黑名单项 | 结论 | 依据 |
| --- | --- | --- |
| Hero | 无 | final-agent-shell：空态为居中品牌位 + 一行说明 + 单 CTA，无营销 Hero |
| KPI 卡片墙 | 无 | orbit 不可用指标为发丝线分区的小格 + 诚实文案，非卡片墙；gallery 无 KPI fixture |
| 无意义渐变 | 无 | 新增为零；存量仅限 HEAD 既有 legacy surface 背景氛围 |
| 厚玻璃 | 无 | 本 change 净删 2 处 backdrop-filter；新 overlay 为深色实底 + token 投影（final-command-palette/final-dialog-alert） |
| 随机 emoji | 无 | emoji 扫描零命中；图标全部走 `WorkbenchIcon` registry |
| 全屏空 Canvas | 无 | agent 空态有引导文案与主 CTA（final-agent-shell） |
| 假实时 | 无 | 无新增轮询/伪 stream；`realtime` 状态如实显示（rail「实时更新 · 已确认」） |
| 假成功 toast | 无 | toast 零命中；orbit fail-closed 横幅明确「未伪造成功」 |
| provider logo 导航 | 无 | 导航 rail 为语义线性图标，无 provider logo |
| 嵌套卡片 | 无 | 截图审查：面板内为发丝线分区 + 左侧 2px 语义色条，无 `border+背景+圆角+阴影` 子卡片 |
| 无原因 disabled | 无 | gallery 每个 disabled fixture 均带原因文案（如 "Unavailable until the owner contract connects"）；主壳「只读 · 动作灰度不可用」如实标注 |

## 5.4 · 最终门禁（2026-08-17 逐条实跑）

| 门禁 | 结果 |
| --- | --- |
| `openspec validate --all --strict` | 31 passed / 0 failed（含 `change/workbench-ui-visual-refresh-r1`） |
| `bun run typecheck` | 通过（根 + apps/web `tsc --noEmit` 零错误） |
| `bun run --cwd apps/web vitest run --config src/design-system/tokens/vitest.config.ts` | 33 文件 / 152 测试全绿 |
| `bun run --cwd apps/web vitest run test/foundation-contract.test.ts` | 4/4 绿 |
| `bun run --cwd apps/web vitest run`（全量） | 941 passed / 3 failed（恰为容忍的 HEAD 已知失败：`orbit-visual-blacklist.test.tsx` ×2 + `studio-file-preview.test.tsx` ×1） |
| `bun run build` | 通过（CGO_ENABLED=0，四个 Go 二进制构建成功） |
| `bun run compose:i18n && bun run check:i18n` | OK（2467 keys / 21 namespaces；check 238 源文件零违例） |
| `bun run --cwd apps/web e2e` | 21 passed / 61 failed / 4 skipped；61 例全部 HEAD 既有（归因同上表），新增失败 0；gallery 4/4 绿 |

## 5.5 · 文档收尾

- `docs/design/ui-controls-system.md` §7.4：补记基线已由本 change 按新视觉语言重生成、复跑稳定与本报告链接；
- `docs/design/design-system-unification.md` §1.2：交叉引用段补一句视觉刷新已由 `workbench-ui-visual-refresh-r1` 落地；
- `docs/README.md` 视觉设计区：`agent-visual-language.md` 条目描述由「扁平发丝线/卡片禁令」更新为 Eikona 02 基线的分层视觉语言并标注已由本 change 落地。

## 遗留（与本 change 无关的既有问题）

- 61 例 HEAD 既有 e2e 失败（C-1～C-5）不在本 change 修复，归因与修复方向见 `workbench-ui-controls-r1/review-report.md`「e2e 收尾」；C 类修复后 workbench/eikona 旧基线预计出现真实 diff，届时按 D3 §10.4 逐图签认。
- 全量 vitest 3 例 HEAD 已知失败（orbit-visual-blacklist ×2、studio-file-preview ×1）不在本 change 修复。
