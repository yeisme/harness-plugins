# Tasks: dsh-mcp-inspector-v1

## 1. L1 插件实现

- [x] 1.1 纯派生函数 `deriveMcpActivity`：mcp__ 分组（含下划线 server 名）、错误/运行中/耗时、排序稳定。
  - **Owner/Scope**：`packages/client/ui-mcp-inspector/src/client/activity.ts` + `tests/activity.test.ts`。
  - **Acceptance**：按 `mcp__<server>__` 分组；解析不出唯一 server 的条目丢弃；同输入输出确定。
  - **Validation**：`pnpm --filter @yeisme/dsh-client-ui-mcp-inspector test`。
- [x] 1.2 conversation.view tab 注册 + 视图组件 + locale（zh/en）+ 空态与 L2 降级横幅。
  - **Owner/Scope**：`src/client/index.ts`、`src/client/McpInspectorView.tsx`、`src/client/locales.ts`。
  - **Acceptance**：纯只读（无调用动作）；降级横幅文案不暗示连接状态；卸载插件即移除 tab。
  - **Validation**：`pnpm --filter @yeisme/dsh-client-ui-mcp-inspector typecheck && build`。
- [x] 1.3 host 面 no-op 入口 + tsdown 双产物（node esm + browser cjs banner）。
  - **Validation**：`pnpm --filter @yeisme/dsh-client-ui-mcp-inspector build`。

## 2. Bundle 与门禁

- [x] 2.1 bundle `@yeisme/dsh-mcp-inspector`：cordis.patch.yml insert 行 + README + re-export client。
  - **Validation**：`pnpm run check:bundles`。
- [x] 2.2 全仓门禁：typecheck/test/build/check:bundles + `openspec validate dsh-mcp-inspector-v1 --strict`。（done 2026-08-29: 全仓 `pnpm run typecheck`/`test`/`build` exit 0、`check:bundles` 24/24 PASS、strict validate 绿；此前阻断全仓 test 的 ui-ordo-agent-ops needs_contract 文本断言漂移已修正为当前诚实渲染断言（surface 重设计后显示本地化 copy 而非裸状态码）；`git diff --check` 仅剩 upstream-prs/pane-workspace-layout/changes.patch 既有尾随空格，属 parked lane patch 格式，不修复。）
  - **Validation**：`pnpm run typecheck && pnpm run test && pnpm run build && pnpm run check:bundles`。

## 3. 后续（明确不在本 change 完成）

- [ ] 3.1 L2 seam `upstream-prs/mcp-inventory/`：patch + apply.sh + 推 fork pr 分支（用户已确认留待专门会话；设计见 design.md）。
- [x] 3.2 visual-kit token adoption（对齐 `dsh-unified-panel-visual-system-v1`）。（done 2026-08-29: `src/client/styles.ts` 经 `buildPanelStyles({scope})` 注入 + `--vk-*` canonical 直读（63 处）+ `--vk-font/ctrl` 局部刻度覆盖；`tests/visual-adoption.spec.ts` 钉住 kit 采纳；包内 10 文件 31/31 绿，含 controller/remote/wire/filter L2 面。）
