# 添加 Ordo Agent Ops 插件

[English](adding-ordo-agent-ops-plugin.md) | 中文

本文定义 DeepSeek Harness 侧的 Ordo Agent Operations 接入方式，覆盖 tenant-safe host plugin、Web client module、profile/组合包以及 ToolView 展示。[本地 OpenSpec](../../openspec/changes/ordo-dsh-plugin-visualization-v1/README.md)负责跨项目合同和分阶段动作。

## 前置条件

- 阅读[架构文档](../architecture.md)、[client 模块参考](../subsystems/client-modules.md)和[包开发指南](adding-a-package.md)。
- 明确 Ordo 拥有 run、task、session、runtime、lease、worktree、approval、verification、evidence 和 closeout 事实。
- 准备 tenant-bound control-plane adapter 或无密钥 fake 用于本地测试。不得把 provider token 放入浏览器或 profile patch。

## 1. 冻结 owner 边界

创建包之前先写 owner 表。DSH adapter 负责 transport、类型化安全投影、事件订阅、UI 组装和生命周期清理；Ordo 负责 canonical state 和 owner receipt；Workbench 负责完整多租户运维视图。DSH 插件不得创建第二 scheduler、task ledger、lease ledger、capacity reservation 或 terminal state。

跨进程值统一使用 opaque ref 和有界摘要。host 边界必须拒绝 raw prompt、provider payload、credential、generic bearer、private tool arguments、absolute host path、PID 和完整思维链。

## 2. 创建 host face

添加 Cordis host package，并同时定义 service definition、provider 和 consumer。服务只暴露加载 authoritative snapshot、订阅 event stream 和分派 server-authored action descriptor 的类型化方法。每个请求按需要绑定 tenant、workspace、principal、context revision、membership revision、installation、plugin digest、policy revision 和 runtime generation。

host face 负责：

- access-ticket 或 BFF transport 以及 audience 检查；
- snapshot 与 cursor 生命周期；
- duplicate 抑制和 gap 触发的 snapshot reload；
- bounded cache 生命周期和连接 backoff；
- unload、HMR、tenant switch、runtime switch 时的幂等 dispose；
- 在数据进入 browser client module 前完成 redaction。

事件断开只会把 freshness 变为 `stale` 或 `offline`，不能把 run 改成 succeeded、failed 或 stopped。

## 3. 创建 client face

声明 `dsh.client` 并导出构建后的 `./client` bundle。持久 Agent Ops 面板使用现有 UI primitives 和 reviewed client slot。DSH 视图保持紧凑，显示：

- 当前 run 和 task 进度；
- attention 与 approval 数量；
- runtime qualification 和 capacity 来源；
- writer lease/worktree 摘要；
- 最近 verification/evidence refs；
- 经过重新鉴权的 Workbench Studio 链接。

单次 inspect、approval、reconcile 或 evidence 操作使用 ToolView。ToolView 接收 authoritative result，并明确展示 `unknown`、`partial`、`cancel_unknown` 和 `reconcile_required`；不能根据 HTTP status 或本地 optimistic flag 自行生成 terminal result。

## 4. 组装 profile 与组合包

在 package metadata 中声明插件，并通过 profile/组合包 patch 组装。使用以下命令查看实际组合树：

```bash
dsh --profile web --dump-config
```

组合包必须固定兼容的 DSH release，并且可在不修改 DSH core 的情况下移除。一个 runtime profile 和 work directory 只属于一个 tenant/workspace/runtime subject；不得在同一 DSH process 内复用多个 tenant 的授权。

## 5. 实现 state 与 action gate

客户端 state 必须区分 `ready`、`running`、`attention_required`、`approval_required`、`stale`、`offline`、`permission_denied`、`contract_mismatch`、`unknown` 和 `reconcile_required`。mutation control 只能来自 server-authored `allowed_actions`。

每个 action 在 dispatch 前显示 target、requested effect、owner、approval、expiry、expected version、policy、cost/rights blocker 和 receipt/reconcile 语义。`unknown`、`partial` 和 `cancel_unknown` 必须禁用自动 retry 与 replacement writer。

## 6. 测试实际组装路径

测试至少覆盖三层：

1. host service 测试覆盖 context binding、redaction、cursor gap reload、duplicate event、action idempotency 和幂等 dispose。
2. client 测试覆盖 state reduction、stale/unknown 渲染、键盘焦点、reduced motion 和 ToolView 输出。
3. profile/Web 测试通过真实 Loader 加载 bundle，验证安装、移除、HMR/unload、浏览器无 token 以及 tenant switch 清理 cache。

Ordo owner fixture 的消费方 conformance 入口位于消费它们的包内：duplicate、version/ref 漂移、reconcile 重读、迟到结果、断线不合成 terminal、non-readable 直传见 [controller.client.spec.ts](../../packages/client/ui-ordo-agent-ops/tests/controller.client.spec.ts)；stale context、不安全 ref、未知字段与 owner 异常见 [gateway.spec.ts](../../packages/host/ordo-agent-ops/tests/gateway.spec.ts)。fixture 必须保持 safe projection：需要 raw prompt、provider payload、credential 或 host path 的用例应退回 owner 合同，而不是在本地复现。

先运行与改动最接近的命令：

```bash
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run doc-sync
openspec validate ordo-dsh-plugin-visualization-v1 --strict
git diff --check
```

集成证据写入 `temp/integration-test-runs/<run-id>/`，并脱敏 secret、raw prompt、provider payload、private tool arguments、absolute path 和完整思维链。

## 7. 记录合同

配置和生命周期语义更新包 README，开发路径更新本文，字段、动作、owner 或失败行为变化更新本地 OpenSpec。架构或安全边界变化时添加或更新 DSH Agent Note。仅属于 DSH 的实现工作不得再新增根仓库 OpenSpec 任务。
