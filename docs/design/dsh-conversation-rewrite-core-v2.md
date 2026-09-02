# DSH Conversation Rewrite Core V2

状态：**已实施（core + Web facade）；发布为显式 operator 动作**（2026-09-02）。证据：`temp/integration-test-runs/conversation-rewrite-core-v2-20260902125803Z-806734/`（pack canary sha256 `b8ce64b5…c12`）  
Owning change：`openspec/changes/dsh-conversation-rewrite-core-v2/`  
首个 consumer：`client/dsh-tui` 的 `dsh-tui-v21-conversation-input-control`

## 目标

现有 Web `ui-conversation-rewrite` 已把 Edit/Retry 定义为 child branch，但 pure boundary/controller 仍位于 React/DSH-specific package。Core V2 把跨 Web/TUI 必须一致的语义抽成独立、host-neutral、零 React 包：

```text
owner history adapter
        -> stable rewrite boundary
        -> typed fork/prompt/activate/hydrate pipeline
        -> success or recoverable receipt
        -> Web/TUI-specific rendering
```

它不拥有 DSH Session，不注册 UI slot，不渲染组件，也不实现自动补偿。

## Package contract

目标包：`@yeisme/dsh-client-ui-conversation-rewrite-core@0.1.0-rc.1`

| Export | Purpose |
| --- | --- |
| `.` | V2 snapshot、boundary、outcome helpers、controller/store |
| `./testing` | Web/TUI 共用 synthetic contract fixtures |
| `./package.json` | package metadata |

生产依赖为空；不得 import React、DOM、Cordis、DSH runtime/private module。Web 和 TUI adapter 各自把 owner 数据规范化成：Session/generation、message key/kind/seq/content/completed、turnEnds、running/removed 与 first-round capability。

## Boundary semantics

所有动作使用同一规则：找到目标 user/steering prompt 之前最近的 stable `turn/end`。

| Target | Decision |
| --- | --- |
| completed + text-only + previous turn/end | executable target |
| first round + `forkBeforeMessage` | executable，`boundarySeq=null` |
| first round without capability | `first-round` |
| running/open turn | `running` / `settlement-pending` |
| image/attachment/mixed content | `not-text` |
| removed/stale/missing boundary | matching typed disabled reason |

V2 提供 `computeUserTurnTargetV2` 给 Web Edit 与 TUI historical Edit/Retry，提供 `computeRetryTargetV2` 给已由 adapter 准确寻址的 assistant。DSH Web 特有的 messageId/turn-tail heuristic 继续留在 Web adapter，不能污染公共 core。

## Typed owner outcomes

每一个 owner call 必须返回：

- `accepted(value)`：有证据证明 owner 接受；
- `rejected(code)`：有证据证明 owner 未接受；
- `unknown(code, partial?)`：无法证明，可能带已知 child ID 等安全事实。

timeout、disconnect、abort 和未分类异常默认 unknown。Core 不把网络错误猜成 rejected，也不基于 message 文本推断成功。

## Pipeline 与 recovery

```text
fork / forkBeforeMessage
  -> prompt
  -> activate
  -> hydrate? 
  -> succeeded
```

controller 是 single-flight；重复 run 共享同一 operation，不创建第二 child。Observable state 只包含 operation/source/target key、stage、outcome、reason、safe summary 和 child ID，不包含 prompt。

| Failure | Core result | Prohibited action |
| --- | --- | --- |
| fork rejected | recoverable_error，无 child | 自动重试 |
| fork unknown | reconcile required，child 可知/未知 | 自动再 fork |
| prompt rejected/unknown | child ID 保留 | 自动 resend / delete child |
| activate/hydrate failed | child ID 保留 | 重发 prompt |

UI 可以基于 receipt 提供 Inspect/Open/Retry activation；“再次 prompt”只有在外部 owner reconciliation 明确证明未接受后，才能由用户启动一个全新的显式 operation。

## Web V1 compatibility

以下 surface 必须原样保留：

- `ChatRewriteController`、`ChatRewriteHost`、`ChatRewritePhase`、`ChatRewriteViewState`；
- `computeEditTarget`、`computeRetryTarget`、`disableReasonKey`、`previousTurnEndSeq`、`textOfContent`；
- Edit/Retry components、lineage、locales、seams；
- package root/client export paths 和 slot registration。

V1 facade 把 V2 的 forking/prompting/activating/hydrating 折叠成 `submitting`，success 折叠成 `opened`，所有 recoverable error 折叠成旧 `error`。V2 新能力只从新 core package 导出，不重用旧 symbol 名改变返回 shape。

## Cross-surface fixtures

`./testing` 提供一份 expected table，Web 和 TUI 直接运行，不能各复制一份预期。覆盖：

- completed Edit/Retry；
- first-round enabled/disabled；
- running、non-text、removed、stale、missing boundary；
- fork rejected/unknown；
- prompt rejected/unknown；
- activate/hydrate failure；
- duplicate run、dispose 与 late result。

fixtures 只使用虚构 ID/text，不包含真实 prompt、绝对路径、provider payload 或 secrets。

## Privacy and evidence

prompt 只作为 controller 到 host.prompt 的短生命周期参数，不能进入 store、receipt、error、log、snapshot 或 integration evidence。safe summary 限单行 256 字符并执行 credential redaction。

integration runner 必须在成功和失败时写入：

```text
temp/integration-test-runs/<run-id>/
  summary.json
  command.txt
  stdout.log
  stderr.log
  env.json
  artifacts/
```

`summary.json` 由 runner 生成，不由 Agent 手写。

## Delivery and rollback

1. 新 core package 与 fixtures 独立完成；
2. Web adapter/facade 迁移并锁旧 exports；
3. `pnpm pack` 验证 files/exports/types；
4. dsh-tui 使用 exact version/tarball 跑 consumer fixtures；
5. 全部门通过后，由有权限的 operator 决定 publish。

publish 是外部动作，不在自动实施范围。Web adapter 回归时恢复旧 V1 internal implementation，已发布 core 与 additive exports 保留；TUI 回归由 v16 input selector 回滚。没有 deprecation、Session migration 或数据回滚。

## Specification validation

```bash
cd /workspaces/yeisme-agent/agent/harness-plugins
openspec validate dsh-conversation-rewrite-core-v2 --strict --no-interactive
```

实施完成后的完整门：

```bash
cd /workspaces/yeisme-agent/agent/harness-plugins
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run check:bundles
```
