# Workbench Identity Account Linking UX 实施任务

## 1. Contract and typed client

- [x] 1.1 冻结 Identity Platform account-linking consumer contract
  - spec delta `specs/workbench-identity-account-linking-ux/spec.md` 冻结 capability/discovery（enabled default-off）、safe projection（linkRef/provider/displayName/linkedAt/isLastLoginMethod/version）、稳定 reason codes（reauth_required/identity_conflict/last_login_method/session_expired/needs_contract/contract_mismatch/rate_limited/callback_replayed）与 closed 状态集；owner 侧合同 identity-platform openapi v1.1.0 已归档实现。、supported version、safe projection、stable reason codes 与 default-off capability discovery。
- [x] 1.2 在 Workbench typed SDK/BFF 实现
  - SDK `identity-account-linking-{models,client}.ts`（closed key-set decode/有界校验/请求校验）+ WorkbenchClient.accountLinking facade（http/jsonRpc 工厂）；BFF `service/internal/identity/account_linking.go` 状态化结果 + `account_linking_http.go` owner 适配（opaque refs 头、错误码→guard 状态、202 unknown_accept→unknown_outcome）+ jsonrpc/REST transport 六方法；http.ts 六路由。 start re-auth/link/unlink、callback/finalize、list/status/reconcile；closed decode、bounded response、idempotency 与 expected version 全部 fail closed。
- [x] 1.3 添加禁止 browser direct-owner call、provider token/code/raw payload、email/domain auto-merge 和 tenant membership mutation 的合同/安全测试
  - `account_linking_test.go` TestAccountLinkingProviderNeverCarriesTokens（仅 opaque refs、无 Authorization/Cookie、closed 最小请求体）+ 投影脱敏（无 email/subject/issuer/tenant_key）+ drift fail-closed 矩阵；SDK 测试封闭 keys（email 字段注入→null）；pane 测试断言 DOM 无 @example/google-subject/服务端原文。。

## 2. Web experience

- [x] 2.1 实现登录方式设置页
  - `login-methods-pane.tsx`（agent.login-methods.v1 pane，manifest/registry/host/catalog 注册）：provider availability（discovery 投影门控）、已关联身份安全摘要、owner reauth 权威状态与 freshness、default-off 诚实降级。：provider availability、已关联身份安全摘要、最近重新认证状态和 owner freshness。
- [x] 2.2 实现显式 link/unlink 确认、provider redirect/pending、成功 receipt 与服务端刷新
  - link/unlink 双确认步骤（含「不删除数据/租户成员资格」声明）；start→pending_owner_receipt（opaque transactionRef+有效期）；callback 落地（accountLinkTx/Receipt URL 参数）单次 finalize+URL 清理+服务端 invalidate/refetch；unlink 携带服务端 fresh expected version。。
- [x] 2.3 实现 `identity_conflict`、`last_login_method`、`session_expired`、`needs_contract`、callback replay 和 rate-limit 恢复状态
  - OutcomeStatusRegion（可聚焦 role=status）按封闭状态集渲染恢复指引：conflict 不合并、last-method 引导先加方式、reauth 引导重新登录（无本地计时）、replay 提示重发、rate-limited 提示稍后；guard 全部状态化非异常。。
- [x] 2.4 实现 unknown outcome 的 status/reconcile，不自动重放 mutation；验证双页签和 stale projection 行为
  - unknown_outcome→「检查状态」只读 status 通道收敛（finalize 次数不变有测试）；finalizeAttempted ref 保证 callback 单次；stale projection 测试：unlink 用服务端 fresh version、版本不匹配稳定拒绝、成功后 refetch（不信任浏览器历史）。。

## 3. Verification and closeout

- [x] 3.1 添加 Vitest + Testing Library + MSW 组件/集成矩阵和关键 Playwright browser journey
  - `apps/web/test/login-methods-pane.test.tsx` 13 测试（MSW 驱动真实 SDK HTTP 通道：default-off/needs_contract/link 确认/pending/callback finalize 单次幂等/conflict/last-method/reauth/rate-limit/replay/unknown 不重放/键盘+status region/窄屏 sm: 断言/安全投影）+ `e2e/login-methods.spec.ts` Playwright chromium journey（真实 vite dev server）通过；注册面回归（manifest/catalog/layout/registry/palette 测试全绿）。；覆盖键盘、screen reader status、窄屏与安全错误投影。
- [x] 3.2 运行 identity/security focused Go/Bun 测试、typecheck、build、strict OpenSpec 与 diff check
  - identity focused：Go identity/jsonrpc/identityhttp 全绿 + SDK bun test 全绿 + web vitest 153 文件 1274 测试全绿 + tsc typecheck 全绿 + CGO_ENABLED=0 go build 全绿 + openspec validate --strict PASS；六件套 evidence run `20260830075533-929ca338-5716-4cf7-82f9-b8d613934ad0`（component/integration，redaction passed）。，并把 integration/component/e2e 六件套写入 `temp/integration-test-runs/<run-id>/`。
- [x] 3.3 更新 Workbench identity 文档与 owner handoff；
  - docs/operations/managed-identity-runbook.md 新增 Account linking 段（default-off/诊断链路/guard 语义/浏览器边界/证据指针/外部门禁）；owner child contract（identity-platform-account-linking-v1）已实现归档且全链证据 passed，本地验证稳定。只有 Identity Platform child contract 和本地验证稳定后才关闭本 change。

真实 Google/Lark OAuth app、staging callback、regional browser canary、24h soak 与 production rollout 仍需独立外部授权和 evidence。
