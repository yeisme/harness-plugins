# @yeisme/dsh-ordo-agent-ops

Ordo Agent Ops 的唯一 DSH 安装包。它同时提供安全 Host projection、只读 `/ordo`、官方 sidebar 值班摘要和 profile patch；复杂 DAG、跨 run、证据比对与运营操作继续进入 Workbench。

## 安装

    dsh plugin --profile web add @yeisme/dsh-ordo-agent-ops
    # 本地 checkout：
    dsh plugin --profile web add ./packages/bundle/ordo-agent-ops

## 包边界

本 checkout 的 `cordis.patch.yml` 当前只插入一行统一 bundle row：

- `ordo-agent-ops`：本 package 的 Host bridge、`/ordo` 与 sidebar 三个运行面。

独立的 `agent-composition-preview` 是后续 profile composition 的外部 owner/artifact，尚未在本
checkout 中 vendoring、伪造 patch row 或作为当前 package dependency 发布。本 package 只在
owner 已挂载时消费严格的 safe preview envelope，不拥有 maturity、risk、qualification 或 Ordo
canonical facts；缺失时保持 `needs_contract`/unavailable。

旧的 `@yeisme/dsh-host-ordo-agent-ops`、`@yeisme/dsh-host-ordo-commands` 和 `@yeisme/dsh-client-ui-ordo-agent-ops` 在 `0.1.0-rc.7` 仍可用作兼容 shim，并会给出一次迁移提示；最早可在 `0.1.0-rc.8` 之后由单独变更移除。不要在新 profile 中安装这些 leaf package。

## 检查与回滚

    dsh --profile web --dump-config
    dsh plugin --profile web remove @yeisme/dsh-ordo-agent-ops

候选版本出现安装或 Loader 回归时，恢复到此前 bundle-only 的 `@yeisme/dsh-ordo-agent-ops` 版本即可；本迁移不写入 Ordo 数据，也没有数据迁移需要回滚。

本实现不复制 dsh-web-ui 的 AionUI pane 代码，也不使用 DOM selector、grid 劫持、文件系统、Git 写入或 SSE route。

## Event cursor boundary

The Host package now exports `ordo.agent_ops.event.v1alpha1` validation and a bounded
`OrdoAgentOpsEventCursor`. It requires an authoritative stream anchor, ignores exact
duplicates, advances only the next sequence, and clears state for gaps, entity-version
regressions, tenant/context or digest drift. A cleared cursor requires a new snapshot;
it never retries transport or synthesizes terminal state. The cursor is a consumer-side
safety utility only: this bundle still does not provide the Ordo event source,
subscription transport, or production profile/browser evidence.
