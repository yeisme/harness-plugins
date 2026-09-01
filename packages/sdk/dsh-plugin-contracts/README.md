# @yeisme/dsh-plugin-contracts

DSH 插件内部契约 SDK（G18 `dsh-plugin-dev-toolchain-v1` Wave 1 §6）。收口
harness-plugins 各包重复的三类形状，供包间保持一致，并以 contract 测试防漂移
（消费方类型与本声明不一致即红；消费试点自身的 typecheck 是第二层漂移网）。

## 定位（R6）

**内部一致性工具，不承诺对外 semver**：本包随仓库内部演进自由变更；
外部插件作者请依赖官方 `@deepseek-ai/dsh-*` 发布面。`packages/sdk/*` 的
对外稳定 API 议题不在本 change 范围。

## 契约组

- **projection**：`ProjectionFreshness`（fresh/stale/unknown 三态）、
  `SafeProjectionMeta`（freshness + 可选 version/cursor）、`BoundedSummary`。
- **probe**：`probeCapability(acquire)` 三态探测——`undefined → needs_contract`
  （官方 seam 未到岗，不注册入口）、抛错 → `unavailable`（附脱敏 reason）、
  返回值 → `available`。probe-first 降级教义的统一实现。
- **dispose**：`Disposable`（幂等 dispose 面-reference）、`Disposer`、
  `SubscribeFace`、`composeDisposers`（多 disposer 组合为单个幂等 disposer）。
  dispose-hmr-conformance 观测门以本合同为对称性参照。

## 消费试点（G18 §6.3）

- `packages/client/ui-pane-domain`：`DomainOwnerSourceService` 的 dispose 面。
- `packages/client/ui-next-step-suggestions`：source registry 的 disposer 返回。
- `packages/client/ui-session-tags`：controller dispose 面。

全量迁移不在本 change 范围（G21 后按需推进）。
