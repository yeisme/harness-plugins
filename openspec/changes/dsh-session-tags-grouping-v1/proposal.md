## Why

DSH Web 会话侧栏目前只支持“按工作区”和“单列表”，且 `sidebar.workspaces` 是整块单占 slot；第三方插件若要增加 tags 分组，只能替换整块侧栏或依赖 DOM，都会复制上游交互、放大版本维护成本，也无法形成稳定的社区扩展生态。

准入结论为 `split-owner`：DSH 上游只拥有与 tags 无关的通用会话分组扩展 seam；Harness Plugins 拥有 tags 的持久化、Remote、编辑交互、分组投影和发布。用户继续使用 DSH 原生侧栏，不维护 `client/deepseek-harness` 源码 fork。

## What Changes

- 通过 `upstream-prs/session-grouping-provider/` 设计并提交一个 additive、experimental 的 DSH `ui-workspace` 分组提供者注册表，不添加任何 tag-specific 类型、存储或业务规则。
- 新增聚焦的 `dsh-session-tags` Host、Client 和 Bundle 包；不把未发布的 `dsh-session-manager`/Desktop Workbench 骨架升级为 tags canonical owner。
- 使用公开 `ctx.storageDomain` 保存按 Session 生命周期绑定的 tags sidecar，并通过 Typert Remote 暴露只读快照与 CAS 写入。
- 在原生视图菜单中增加插件提供的“按标签”；一个会话有多个 tags 时同时出现在多个组，无 tags 的会话进入“未标记”。
- 通过同一分组提供者合同贡献“管理标签”会话动作，插件使用现有 `shell.overlay` 打开标签编辑器；DSH 不持有编辑状态。
- 增加社区接入文档、能力探测、HMR/dispose、兼容矩阵和 provider conformance 测试，禁止整块侧栏替换、私有 import 与 DOM patch。
- 所有公开合同均为新增 surface，标记 `v1alpha1`/experimental；无 breaking change、无既有数据迁移。

## Required Capability Ledger

| 能力 | 状态 | canonical owner | 本切片 | 验收证据 |
| --- | --- | --- | --- | --- |
| 通用会话分组注册表 | required | DSH `ui-workspace` 上游 | upstream seam | DSH contract/component tests |
| 原生侧栏按 tags 分组 | required | Harness Plugins Client | deliver-now | component/profile e2e |
| tags 持久化与并发保护 | required | Harness Plugins Host | deliver-now | Host persistence/CAS tests |
| 多 tag 多组出现 | required | Harness Plugins Client | deliver-now | projection tests |
| 未标记分组 | required | Harness Plugins Client | deliver-now | empty/membership tests |
| 标签搜索与管理 | required | Harness Plugins Host + Client | deliver-now | Remote/component tests |
| capability probe 与诚实降级 | required | Harness Plugins Bundle | deliver-now | old-DSH compatibility test |
| 社区 provider 文档与样例 | required | DSH seam + Harness Plugins | deliver-now | cookbook/conformance tests |
| tag 颜色、层级、全局重命名 | optional | Harness Plugins | retain-next | 后续独立 change |
| Session 日志内嵌 tags | rejected | DSH Session domain | not-requested | sidecar 路径成立 |

## Capabilities

### New Capabilities

- `dsh-session-grouping-extension`: DSH 原生侧栏可注册、选择、卸载并渲染第三方会话分组投影及其会话管理动作。
- `dsh-session-tags`: Harness Plugins 的 tags sidecar、Remote 合同、标签编辑器、搜索和多组投影行为。

### Modified Capabilities

无。既有 `workspace`/`flat` 分组、Session 日志、Workspace 排序和侧栏所有权保持不变。

## Impact

- 新 owner packages：`packages/host/dsh-session-tags/`、`packages/client/ui-session-tags/`、`packages/bundle/dsh-session-tags/`。
- 唯一 DSH core 通道：`upstream-prs/session-grouping-provider/`；不直接修改或长期维护 DSH fork。
- 新公开 TypeScript surface：experimental `SessionGroupingProviderV1Alpha1` 注册合同；分类为 additive。
- 新 Remote surface：`sessionTags.list`、`sessionTags.set`；分类为 additive、`specVersion: 1.0`。
- 新持久化 domain：`yeisme_session_tags_v1`，只保存 sidecar，不写 SessionEvent、不进入模型上下文、不改变会话最近更新时间。
- Rollback：从 profile 移除 `@yeisme/dsh-session-tags`；DSH 自动回退“按工作区”，sidecar 数据保留以便重装恢复。
