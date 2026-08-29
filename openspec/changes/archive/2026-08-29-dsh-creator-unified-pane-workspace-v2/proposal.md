## Why

Creator Studio 已有统一创作入口和多 owner 安全投影，但当前入口会强制同时打开 Home 与混合的“生成、审批与证据”队列，资产也只能散落在各 owner 面板中。需要把“创作”收敛为唯一入口，并让用户通过独立 Pane 完成创作、资产管理、生成观察、审批决策与当前项目做剧流程。

## What Changes

- “创作”常驻入口和 `/creator` 只打开 Creator Home；所有功能 Pane 从 Home、Pane 管理中心或显式命令按需打开。
- 保留文字、视觉、音频、做剧、资料和分析 Pane，新增跨 owner 资产管理 Pane，并把生成队列与审批队列拆成两个独立 Pane。
- 资产管理默认当前项目，可显式切换为当前 tenant/principal 授权范围内的全部项目；Host 负责验证、过滤、合并与分页。
- 生成与审批事实改由 Ordo 安全投影提供，领域 review/artifact 只作为关联引用；unknown、partial、stale 和 reconcile 状态不自动重试。
- Creator Home 接入 AI Drama Director face，使用户可在 Pane 内按需打开故事、视觉、音频、运行与审批视图并完成当前项目的做剧流程；Workbench handoff 保留为可选专业入口。
- 公共合同只做增量扩展：增加可选 `projectRef`、资产查询及独立 generation/approval 投影；旧 `jobs`、`reviews`、`creator.jobs` 和 `creator.review` 保留一个发布周期并作为兼容别名。

## Capabilities

### New Capabilities

- `creator-studio-asset-library`: 当前项目默认、全部授权项目可选的跨 owner 资产查询、分页、过滤、预览与 fail-closed 权限合同。
- `creator-studio-operations-panes`: 独立生成与审批 Pane、Ordo 投影来源、兼容别名和不自动重试语义。
- `creator-studio-drama-workflow`: Creator Home 到 AI Drama Director Pane 的完整当前项目做剧流程及可选 Workbench handoff。

### Modified Capabilities

- `creator-studio-host-projection`: 冻结可选 projectRef，增加资产与 Ordo operations 安全查询，并保留旧 projection 字段。
- `creator-studio-pane-experience`: 单入口只打开 Home，扩展 Pane 目录并将旧 review/jobs View 保持为兼容别名。

## Impact

- Host：`@yeisme/dsh-creator-studio-host` 的公开 TypeScript 合同、validation、gateway 与 adapter seam。
- Client：`@yeisme/dsh-client-ui-creator-studio` 的 Controller、Home/资产/生成/审批视图、命令与兼容注册。
- Drama：复用 `@yeisme/dsh-client-ui-ai-drama-director` 已发布的 client face，不复制 Show canonical state；更新其 Pane 定位与验收。
- Operations：复用 Ordo Agent Ops 安全投影；缺少 adapter 时显示 `needs_contract`，不回退到 browser fan-out。
- 兼容策略：所有新增字段、Remote 方法、View 和 Command 均为 additive；旧字段与 kind 在本 release 保留，回滚为恢复旧 Creator client/host bundle。
