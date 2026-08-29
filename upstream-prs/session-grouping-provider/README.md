# session-grouping-provider（DSH 上游 seam PR staging）

为 DSH `ui-workspace` 增加通用第三方会话分组扩展 seam（experimental
`SessionGroupingProviderV1Alpha1` + `ctx.sessionGroupings` registry）。
不含任何 tags/收藏夹等具体领域类型；规格见本仓
`openspec/changes/dsh-session-tags-grouping-v1/`。

## Base

- Rebased onto upstream/master: `cd5ef81`（`dsh-v0.1.2-alpha.1`，merge PR #3248）
- 分支：`yeisme/deepseek-harness` `pr/session-grouping-provider`（已推送 `8d60e2a`）
- 上游 compare：https://github.com/deepseek-ai/deepseek-harness/compare/master...yeisme:deepseek-harness:pr/session-grouping-provider
- 一键开 PR：https://github.com/deepseek-ai/deepseek-harness/compare/master...yeisme:deepseek-harness:pr/session-grouping-provider?expand=1
- Status: pr-ready（用户已授权提交；分支已推送并在干净 checkout 上 161/161 tests + typecheck 0 错验证。PR 创建被 fine-grained PAT 的跨仓权限挡住——需用户一键或 classic PAT）

### 2026-08-29 rebase 记录

上游 0.1.2-alpha.1 拆包/改名适配：`dsh-client-runtime/client` 类型迁移到 `dsh-api-session-controller`/`dsh-api-workspace-controller`/`dsh-client-ui-session`/`dsh-session/types`；`useHostDescription`→`useConnectionGeneration`；`sessionNode`/`deriveSearchResults`/`deriveFlat` 新增 `pendingInteractions` 参数（`deriveExternalGroups` 以可选尾参适配）；`WorkspaceBrowser.tsx` 移至 `rows/`；`WorkspaceListState`→`WorkspaceSnapshot`（去 `baselinesReady`/`recentWorkspaceId` 字段）。

## 文件清单

修改（`changes.patch`）：

- `packages/client/ui-workspace/src/client/grouping.ts` ← 新增（见 new-files）
- `packages/client/ui-workspace/src/client/stores.ts` — `SessionGroupBy` 增加
  `provider:<id>` 外部选择值（additive；`workspace`/`flat` 持久化值不变）
- `packages/client/ui-workspace/src/client/tree.ts` — `deriveExternalGroups`、
  `mergedSearchTermsBySession`、`deriveSearchResults` 可选 provider 搜索词
- `packages/client/ui-workspace/src/client/WorkspaceBrowser.tsx` — 视图菜单
  provider 项、ExternalTree（过滤/展开/命名空间化 manual order/回退）、
  retainAccountKeys 清理、搜索词合并
- `packages/client/ui-workspace/src/client/rows/Rows.tsx` — 外部分组隐藏
  Workspace 专属标题动作、会话行菜单追加 provider actions
- `packages/client/ui-workspace/src/client/contract/slots.ts` — browser 注入面
  hooks 增加 `sessionGroupings` observable（本包 apply 恒供给）
- `packages/client/ui-workspace/src/client/index.ts` — 提供
  `ctx.sessionGroupings` 服务 + 导出 seam 类型（type-only）
- `packages/client/ui-workspace/README.md` — 社区 provider 接入文档
- `packages/client/ui-workspace/tests/workspace-browser.client.spec.tsx` —
  仅机械性增加 `useSessionGroupings` stub prop（既有断言未改动）

新增（`new-files/`）：

- `packages/client/ui-workspace/src/client/grouping.ts`
- `packages/client/ui-workspace/tests/grouping.client.spec.ts`
- `packages/client/ui-workspace/tests/grouping-browser.client.spec.tsx`

## Apply

```bash
upstream-prs/session-grouping-provider/apply.sh <clean-dsh-checkout>
```

幂等：第二次执行以 `src/client/grouping.ts` 存在为标记明确拒绝；
apply 前先 `git apply --check`，工作树不干净或 patch 不适配即失败退出。

## 验证（在干净 checkout 141eb6f 上实际执行）

```bash
pnpm install --prefer-offline
npx tsc -b tsconfig.client.json                                   # exit 0
pnpm exec vitest run packages/client/ui-workspace/tests           # 144/144（含既有 126 全绿）
pnpm --filter @deepseek-ai/dsh-client-ui-workspace run bundle     # exit 0
```

注：该包无 `build` script，`bundle`（tsdown）即其构建入口；
repo 级 typecheck 需先 `npm run build:lib:host`（本验证已执行）。

## Agent Note（双语）

- 中文：seam 只做“通用分组投影 + 安全搜索词 + 会话动作”三件事。
  绝不允许：为某个领域（tags/收藏夹/状态）在 DSH 内加类型或存储、
  provider 自带 React renderer、替换 `sidebar.workspaces` 整块 slot、
  DOM selector fallback、把 provider 排序写入 Workspace order/Host 重排 API。
  mutation 一律走 provider 自有通道（如插件 Host Remote）；DSH 只把
  canonical SessionId 传给 `action.open`。旧 DSH 上插件必须 capability probe
  （`typeof ctx.sessionGroupings?.register === 'function'`），缺 seam 时零注册、
  零死按钮。
- English: the seam is generic projections only — no domain types or storage in
  DSH, no provider-side renderers, no sidebar-slot replacement, no DOM
  fallback, no Workspace-order writes. Mutations stay in the provider's own
  channel; DSH hands only the canonical SessionId to `action.open`. Plugins
  must capability-probe and degrade honestly (no entries, no dead buttons) on
  hosts without the seam. The v1alpha1 surface is additive: built-in
  `workspace`/`flat` values and persisted state keep working; unknown or
  unloaded provider selections fall back to the workspace view.
