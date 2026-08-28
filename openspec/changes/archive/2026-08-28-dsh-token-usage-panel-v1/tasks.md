# Tasks: dsh-token-usage-panel-v1

## 1. Host 账本与 Remote

- [x] 1.1 新建 `packages/host/dsh-token-usage` 包骨架（package.json、tsconfig、tsdown、vitest、README）。Owner: `packages/host/dsh-token-usage`。Validation: `pnpm --filter @yeisme/dsh-token-usage-host run typecheck`。
- [x] 1.2 实现 `token.usage.snapshot.v1alpha1` / `token.balance.snapshot.v1alpha1` 类型、zod 白名单校验与 unsafe 字段拒绝。Dependencies: 1.1。Validation: host 包 focused tests。
- [x] 1.3 实现进程内 ledger：订阅会话 `projectionValues.tokenUsage`，按会话/提供方/UTC 日/周/进程折叠 disjoint buckets，有界 `bySession`（20）+ `truncated`。Dependencies: 1.2。Validation: `pnpm --filter @yeisme/dsh-token-usage-host test`。
- [x] 1.4 实现 Typert Remote `tokenUsage.snapshot` / `tokenUsage.refreshBalance`，失败原样返回、不自动重试。Dependencies: 1.3。Validation: remote 单测。

## 2. DeepSeek 余额

- [x] 2.1 Host 余额客户端：仅 `deepseek-official`（或官方 host）经 `ctx.credentials`/`apiKeyEnv` 调用 `GET /user/balance`；映射白名单字段；金额保持字符串。Dependencies: 1.2。Validation: fixture 用官方文档示例 `CNY 110.00`。
- [x] 2.2 降级与限流：`unsupported` / `credential_missing` / `network_failed` / `contract_mismatch`；15s 内重复 refresh 不发 HTTP；失败保留 stale 金额。Dependencies: 2.1。Validation: host 包 test。
- [x] 2.3 红线测试：投影/日志/错误信息不含 apiKey、bearer、baseURL、raw body。Dependencies: 2.1。Validation: 负向扫描单测。

## 3. Client 面板

- [x] 3.1 新建 `packages/client/ui-token-usage` 包骨架。Owner: `packages/client/ui-token-usage`。
- [x] 3.2 纯函数把 Remote 快照派生为视图模型（窗口合计、截断、余额降级、拒绝非法键）。Dependencies: 3.1、1.2。Validation: `pnpm --filter @yeisme/dsh-client-ui-token-usage test`。
- [x] 3.3 共享 `TokenUsagePanel`：当前会话 / today / week / process、by session、by provider、DeepSeek 余额块、Refresh、空态与降级文案；locale zh/en。Dependencies: 3.2。Validation: 组件渲染单测。
- [x] 3.4 Pane 路径：探测 `paneWorkbench` + `shell.workspace.right` 后注册 `workspace.token-usage` navigator（`preferredRegion: 'right'`，singleton）；header `conversation.session.header.actions` id `token-usage-open` 调用 `openView`。Dependencies: 3.3。Validation: client apply 测试。
- [x] 3.5 Overlay 降级：Pane 缺失时注册 `shell.overlay` 常驻 seat（空闲零渲染，`role=dialog`）；Remote 缺失时 Tokens 按钮 disabled 且原因可读。Dependencies: 3.3。Validation: overlay 开/关与 disabled 入口测试。
- [x] 3.6 卸载清理：销毁时移除入口、view、overlay、locale；DOM 无凭据词。Dependencies: 3.4、3.5。Validation: dispose 测试 + 凭据扫描。

## 4. Bundle 与门禁

- [x] 4.1 新建 `@yeisme/dsh-token-usage` bundle：`cordis.patch.yml` insert host+client，README 安装命令，re-export。Validation: `pnpm run check:bundles`。
- [x] 4.2 包级 typecheck/test/build。Validation: 三个包的 `typecheck && test && build`。
- [x] 4.3 `openspec validate dsh-token-usage-panel-v1 --strict --no-interactive`。官方 `dsh web` 不作为完成门。

## 5. 明确不做

- [x] 5.1 跨重启持久化 sidecar（进程内存即可；文案 since process start）。
- [x] 5.2 `sidebar.footer.action` 次要入口与 visual-kit 深度 adoption。
- [x] 5.3 价格表、tokenizer、非 DeepSeek 官方余额、浏览器直连提供方。
