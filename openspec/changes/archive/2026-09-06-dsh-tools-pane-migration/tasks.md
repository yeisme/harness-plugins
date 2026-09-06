# Tasks: dsh-tools-pane-migration

## 1. 工具入口归入唯一 Pane

- [x] 1.1 MCP 筛选、右侧单例 Pane 注册；停止注册 conversation.view 工具 tab。Scope: `packages/client/ui-mcp-inspector/src/client/`。（done 2026-09-05 commit 97d4f0a：`pane.tsx` 单例 Pane（role inspector、preferredRegion right、retention recreate）；`apply.test.ts` 'handles missing, late, replaced and unloaded pane services' 覆盖 host 缺席/晚到不注册旧会话入口。）
- [x] 1.2 命令重复打开复用已有视图与区域。Scope: `pane.tsx` + controller。（done 2026-09-05：`pane.test.tsx` 'admits the production provider, reuses /mcp after moving, and closes/reopens it'——移动到底部后再次 `/mcp` 复用同视图不建第二个 tab。）

## 2. 会话隔离与安全目录

- [x] 2.1 切换会话清理旧选择/活动/订阅，新会话仅显示新内容。（done 2026-09-05：`pane.test.tsx` 'defaults to MCP, streams activity and drops the previous session selection and subscriptions'。）
- [x] 2.2 关闭时未完成的目录 probe 不再启动读取，重开以新 controller 读取。（done 2026-09-05：`pane.test.tsx` 'does not attach a late catalog probe after close and starts fresh on reopen' + 'stops catalog polling on close'。）
- [x] 2.3 目录缺失显示安全不可用状态，保留可读调用活动；generation-CAS 启停不执行工具、不存私有参数。（done 2026-09-05：`controller.test.ts` 'surfaces catalog-unavailable without inventing items' + `pane.test.tsx` 'keeps activity usable without the host catalog and labels absent sessions' + 'keeps enablement with the host across success, generation conflicts and transport failure'；`workbench.test.tsx` 'renders list and timeline activity without tool arguments or results'。）

## 3. 设置插件页退役

- [x] 3.1 upstream-prs/remove-plugins-settings 补丁：浏览器入口不再注册导航/子 tab/卡片副作用，保留包加载兼容与公开类型。Scope: `upstream-prs/remove-plugins-settings/`。（done 2026-09-06 commit 4d9eabd 固化系列；基线 `141eb6fef8`（DSH 0.1.0-rc.8）；回归场景覆盖无服务加载与插件导航/子 tab 不再注册，`verify.mjs` 于已应用 checkout 复跑 2/2 通过，证据 `temp/integration-test-runs/2026-09-06T16-09-15-179Z-736160/`（command/env/stdout/stderr/summary 六件套脱敏）；apply.sh 冲突不部分写入，回滚 `git apply -R`。不推送、不发布。）

## 4. 按容器宽度布局

- [x] 4.1 720px 及以下单列分段、360px 控件可聚焦可切换、宽容器两列不横向溢出。Scope: `styles.ts` + visual adoption。（done 2026-09-05：`visual-adoption.spec.ts` 钉住 `@container(max-width:720px)` 单列断点与 `grid-template-columns:minmax(0,58fr) minmax(320px,42fr)` 双列布局及 `--vk-ctrl-*` 触控刻度；`interactions.test.tsx` 'wires search, family, availability, details and toggle actions' 覆盖键盘可达切换。）

## 5. 验证与收口

- [x] 5.1 包级验证：`pnpm --filter @yeisme/dsh-client-ui-mcp-inspector run test && typecheck && build`。（done 2026-09-06 复验：38/38 通过；tools pane 迁移后无 conversation.view 注册残留。）
- [x] 5.2 `openspec validate dsh-tools-pane-migration --strict --no-interactive` + `pnpm run check:bundles`。（done 2026-09-06：strict validate 绿；check:bundles 27/27 PASS。）
