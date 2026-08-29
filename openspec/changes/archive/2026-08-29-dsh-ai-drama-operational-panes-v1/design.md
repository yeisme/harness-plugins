## Context

Creator Studio 已有一个 `CreatorStudioController` 和完整 safe projection，但它只被 Creator views 持有；Director 目前只探测 raw snapshot remote，六个 Pane 未消费 resources/actions/runs/reviews。两个 client 若各自创建 controller 会产生重复读取、context drift 与 receipt 竞争。

## Goals / Non-Goals

**Goals:**

- 发布一个共享、可订阅、可精确 dispose 的 Creator application service。
- 让六个 Director Pane 使用同一 authoritative browser projection 和 owner receipt。
- 保持旧 remote、Pane kind、command、preset 与 Bridge V2 兼容。

**Non-Goals:**

- 不新增领域数据、scheduler、approval ledger 或媒体 byte cache。
- 不在 Director 内复制完整 Creator navigation shell。
- 不以隐藏 timer 建立第二刷新循环。

## Decisions

1. `CreatorStudioRuntimeV1` 包装现有 controller，而不公开 controller concrete type。它提供 `getSnapshot/subscribe/refresh/loadAssets/dispatchAction/decideApproval/resolveArtifact`，由 Creator Client 在 context 中发布并在 dispose 时撤销。
2. Director 优先消费 runtime；仅有旧 remote 时创建一次只读 legacy snapshot adapter，动作入口保持 disabled。这样保持兼容而不引入第二 polling owner。
3. Creator 投影组件抽到纯 React 模块，接收 snapshot/runtime/pane callbacks；组件不自行读取 context、注册 plugin 或启动 timer。
4. Director view model 同时投影 drama context 与 creator runtime state。两者任一 identity 变化都会清除 selected artifact/review、表单草稿和旧 receipt。
5. UI 使用现有 Surface/Button/visual tokens，采用 dashboard、artifact browser、approval queue 和 timeline/list 模式，不增加新视觉系统或动画依赖。

## Risks / Trade-offs

- [Legacy raw remote 无动作能力] → 显示只读投影与明确安装 runtime 指引。
- [Creator 与 Drama context 短暂不一致] → 以 workspace/project/context revision 栅栏禁用 mutation，并要求 reconcile。
- [共享 runtime dispose 次序] → context provider 使用幂等 disposer，Director 只订阅不拥有 runtime 生命周期。

## Migration Plan

1. 添加 runtime public interface 和 provider，不改变旧 remote。
2. Creator 自身切换为消费同一 runtime。
3. Director probe/runtime/view 逐步接入。
4. 回滚时删除 runtime provider 与 Director 消费，旧 Creator 与 shell views 继续工作。

## Open Questions

无；真实 owner adapter 缺失继续按 needs_contract 处理。
