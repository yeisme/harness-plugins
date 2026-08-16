## Why

当前 @yeisme/dsh-ordo-agent-ops 只是一个 profile bundle，实际通过四个 patch 行加载三个 Ordo 叶包与一个组合预览包。前三项共同构成一个用户可感知的 Ordo Agent Ops 功能，却被拆成多个可发布、可解析、可兼容的单元；在干净 DSH profile 中只安装聚合包时，这会把 pnpm 的嵌套依赖解析、版本对齐和重复挂载风险暴露给用户。

现在应在 ToolView、审批与回执能力继续扩展前收敛发布面：一个 Ordo 用户功能对应一个双端 DSH 插件包，同时保留 DSH composition facts 和 Anchored Standard preset 分发的独立 owner 边界。

## What Changes

- 将既有 @yeisme/dsh-ordo-agent-ops 从仅含 patch 的聚合 bundle 迁移为唯一的 Ordo Agent Ops 安装包。该包同时发布 Host bridge、/ordo 命令、浏览器 client 入口和 profile patch；源码仍按 host 与 client 模块分层。
- 将当前 @yeisme/dsh-host-ordo-agent-ops、@yeisme/dsh-host-ordo-commands、@yeisme/dsh-client-ui-ordo-agent-ops 的运行逻辑迁入该包，保持 Ordo safe projection、只读命令和紧凑值班摘要的既有语义。
- 将 Ordo bundle patch 的 Ordo 部分收敛为一个根插件行，不再以 patch 行挂载旧 Ordo 叶包；@yeisme/dsh-agent-composition-preview 保持独立命名的直接合同依赖与单独 row，而不是被吸收为 Ordo 实现。
- 保持 @yeisme/dsh-agent-composition-preview 为独立 DSH composition facts 能力；Ordo 只能通过显式、可选的事实合同消费它，不能写入或推导 maturity、risk、qualification、receipt 等 Ordo owner 字段。
- 保持 @yeisme/dsh-anchored-standard 为独立实验 preset 分发包；它属于当前六个 workspace package，但不属于 Ordo 包收敛范围。
- **BREAKING（受兼容迁移保护）**：旧叶包不再是新安装的主入口。下一发布周期保留三项旧叶包的兼容 shim，并验证旧配置、新配置和混合配置均不会重复 mount；旧入口不得早于 0.1.0-rc.8 移除。
- 明确不创建通用 dsh-plugin-ui-kit；复用只在至少三个插件已证明同一稳定需求后，以小型私有库另行提案。
- ToolView 的单项审批/回执位置在包内预留为后续切片；本 change 不新增 mutation、审批决策、复杂 DAG、跨 run 证据比对或 Workbench 功能。

## Admission Decision

结论：split-owner。

| 能力 | Canonical owner | DSH 中的体验宿主 | 本 change 的处理 |
| --- | --- | --- | --- |
| run、task、lease、approval、verification、evidence 与 owner receipt | agent/ordo | Ordo Agent Ops sidebar、后续单项 ToolView、Workbench | 保留在 Ordo；DSH 仅消费 safe projection 与 server-authored action |
| Host Remote、/ordo、DSH client、profile patch、安装 conformance | agent/harness-plugins | @yeisme/dsh-ordo-agent-ops | 本 change 的唯一实现 owner |
| 完整 DAG、跨 run、证据比对与多租户运营 | client/yeisme-workbench | Workbench | 保留并以安全深链进入；不复制到 DSH |
| preset 的 composition facts、digest、health、drift | @yeisme/dsh-agent-composition-preview | 独立 DSH composition surface | 保留独立 package；Ordo 只按合同读取 |
| Anchored Standard preset 文件分发 | @yeisme/dsh-anchored-standard | 独立 preset 安装 | 不改动、不计入 Ordo 收敛 |

## Required Capability Ledger

| 用户所需能力 | 状态 | Canonical owner | 交付切片 | 验收证据 |
| --- | --- | --- | --- | --- |
| 单条安装命令完整安装 Ordo Agent Ops | required | harness-plugins | deliver-now | 干净 web profile 只添加 @yeisme/dsh-ordo-agent-ops 即可装载 Host、/ordo 与 sidebar |
| 安全 Ordo projection Remote | required | Ordo contract；DSH adapter 实现 | deliver-now | 浏览器仅获得 opaque ref、有界摘要、freshness、evidence ref 与允许动作 |
| /ordo 命令 | required | harness-plugins | deliver-now | 统一包注册唯一只读命令，旧/新配置皆仅一份 |
| DSH 值班摘要 | required | harness-plugins | deliver-now | 原生 sidebar slot、生命周期 reset、a11y 与窄屏状态通过 |
| 单项 ToolView | required/retained | Ordo action/receipt contract | retain-next | 仅在 server-authored descriptor 和 owner receipt 已冻结后接入 |
| composition facts 独立能力 | required | dsh-agent-composition-preview | deliver-now | Ordo bundle 以独立 package row 直接消费；其 schema 不含 Ordo maturity/risk/qualification |
| 旧叶包外部安装者兼容 | required | harness-plugins | deliver-now | 0.1.0-rc.7 shim、mixed profile 无重复 mount、清晰弃用说明 |
| Rollback | required | harness-plugins release | deliver-now | 恢复已发布的旧 @yeisme/dsh-ordo-agent-ops bundle 版本 |
| 通用 DSH UI 底座 | not-requested | none | excluded | 本 change 不创建 ui-kit |
| 文件系统、Git 写入、预览器、SCM 或 AionUI SSE 路由 | rejected | none | excluded | package、patch、测试与文档均无这些能力 |

## Capabilities

### New Capabilities

- dsh-ordo-agent-ops-unified-package：定义唯一双端 Ordo 安装包、其 Host/client/command 分层、官方 DSH seam 与单行 profile patch。
- dsh-ordo-agent-ops-package-compatibility：定义旧叶包的一个发布周期 shim、弃用窗口、混合 profile 去重和回滚行为。
- dsh-composition-preview-owner-boundary：定义 Ordo 对独立 composition facts 的只读合同消费，以及不把 preset 分发或事实 owner 吸收到 Ordo package 的边界。

### Modified Capabilities

无。当前 OpenSpec 主 specs 尚为空；现有 active change 的实现约束会在本 change 中以新增、可测试的 package contract 表达，而不重写其 canonical Ordo 或 composition 语义。

## Impact

- 主要代码范围：packages/bundle/ordo-agent-ops/，以及三个旧叶包的兼容 shim、测试与 package README。
- 受影响的公开合同：@yeisme/dsh-* package name、exports、dsh.client metadata、dsh.bundle.patch、cordis patch row id/name、profile 安装与旧 profile 配置。
- 依赖：已发布的 @deepseek-ai/dsh-* 与 @deepseek-ai/cordis 官方扩展 seam；不依赖 DSH core fork。
- 不改动：agent/ordo 的 canonical facts/actions、client/yeisme-workbench 的运营台、packages/preset/agent-composition-preview 的 owner 范围、packages/bundle/anchored-standard。
