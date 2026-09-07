## Why

企业 Harness Platform 已将 tenant、workspace、plugin installation、runtime binding 和领域 owner 的事实拆分给各自的控制面；Workbench 仍需要一个可实施的 Studio 消费契约，避免浏览器把这些安全边界重新拼成私有状态或直连领域服务。现在冻结该 UI 契约，才能让 DSH Web 的紧凑桥接体验与 Workbench 的全尺寸运营工作区共享同一组 server-authored 合同而不复制领域真相。

## What Changes

- 新增 Harness Studio 的 tenant/workspace 上下文、重置和缓存边界，以及仅通过 Workbench BFF/typed facade 消费控制面与 owner 投影的规则。
- 新增受控插件 surface slot、descriptor、native-reviewed surface 与 sandboxed iframe 的呈现及隔离契约；插件不能向浏览器注入任意代码、路由或网络目标。
- 新增 typed view/action/resource/event/receipt/reconcile 消费模型，明确 owner action、成本、rights、approval、版本、幂等与未知结果的 UI 语义。
- 新增 Eikona、Scaena、Anatomia、Ordo/MCP、统一资产库和 Episode Workspace 的消费者边界；Canvas 仅持有布局与注释。
- 新增 Studio 与 DSH Web 的职责分界、响应式、无障碍、性能、安全、owner handoff 和验证证据要求。

## Capabilities

### New Capabilities

- `workbench-harness-studio-context`: 多租户 Harness Studio 的上下文、导航、查询重置、产品面分界和基础可访问性契约。
- `workbench-harness-plugin-surface`: 受控插件 descriptor、surface slot、trusted/sandboxed 渲染、typed action 和 receipt/reconcile 消费契约。
- `workbench-harness-production-projection`: Eikona、Scaena、Anatomia、Ordo/MCP 与资产/Canvas/Episode Workspace 的安全生产投影和 handoff 契约。

### Modified Capabilities

无。此 change 只新增 Workbench 的消费者合同；现有 Eikona、Scaena、Anatomia、DSH、Identity、Harness Control Plane 与 Ordo 的稳定 owner 合同不在此处重写。

## Impact

后续实现会影响 Workbench Web 的 Studio 路由、BFF/`WorkbenchClient` typed facade、查询缓存、Panel registry、Action/Receipt UI 与相关测试；不新增浏览器直连 owner、domain SDK、provider 调用或持久化 canonical state。实现依赖 Harness Control Plane、Identity、Harness Plugins、Eikona、Scaena、Anatomia、Ordo/MCP 各自发布并验证的版本化 server contract；合同缺失时必须显示 `needs_contract` 或安全降级，而不是由 UI 伪造能力。
