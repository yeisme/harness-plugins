## Why

AI Drama Director 已完成六个 Pane、命令、上下文和 Workbench handoff 的注册，但除 Context 外仍主要展示外壳，无法直接消费 Creator Studio 已有的 production、resource、review、run、approval 和 owner action 投影。现在需要先完成当前剧集的可操作闭环，避免在新增全剧控制台前继续复制状态与请求。

## What Changes

- 发布 additive `CreatorStudioRuntimeV1`，让 Creator Studio 与 Director 共享同一 snapshot store、订阅、显式 refresh、资产分页、artifact resolve、owner action 和 approval receipt。
- 保留旧 `remote.creatorStudio` 兼容面；runtime 缺失时 Director 进入显式只读兼容路径，不创建第二个轮询器。
- 将 Context、Story、Visual、Audio、Run、Review 六个 Director Pane 接入真实 Creator/Drama/Ordo safe projection。
- 抽取无副作用的 Creator projection components，复用资源网格、owner action composer、review queue 与 run list。
- 在 context、runtime generation 或 snapshot axis 变化时清理选择、草稿和过期 receipt；stale/partial/gap/unknown 禁止 mutation。

## Capabilities

### New Capabilities

- `creator-studio-shared-runtime`: Creator Studio Client 发布的共享只读状态与受控动作 application service。
- `dsh-ai-drama-operational-panes`: 六个 Director Pane 的真实投影、动作、状态和恢复体验。

### Modified Capabilities

- `dsh-ai-drama-client-runtime`: 已注册的六个视图从 capability shell 提升为共享 runtime 驱动的 operational panes，同时保持原 kind、preset 和 dispose 合同。

## Impact

- 影响 Creator Studio Host/Client、AI Drama Director Client/Bundle 及其测试。
- Public TypeScript 面只增加新接口和可选 probe 字段；现有 remote、command、Pane kind 和 Bridge V2 不变。
- 不新增 scheduler、domain store、approval ledger 或浏览器轮询 owner。
