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
- [ ] 2.2 全仓门禁：typecheck/test/build/check:bundles + `openspec validate dsh-mcp-inspector-v1 --strict`。（本包各门禁已单独绿：typecheck/test/build/check:bundles 18/18 + openspec --strict；全仓 typecheck 被 HEAD 上预存的 ui-session-cookie-manager provider-adapter.ts 缺失阻断，属 visual-kit 在途会话 lane，非本 change 引入。）
  - **Validation**：`pnpm run typecheck && pnpm run test && pnpm run build && pnpm run check:bundles`。

## 3. 后续（明确不在本 change 完成）

- [ ] 3.1 L2 seam `upstream-prs/mcp-inventory/`：patch + apply.sh + 推 fork pr 分支（用户已确认留待专门会话；设计见 design.md）。
- [ ] 3.2 visual-kit token adoption（对齐 `dsh-unified-panel-visual-system-v1`）。
