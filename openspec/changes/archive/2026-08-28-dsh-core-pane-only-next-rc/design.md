## Context

Pane Workbench 已有完整的 `workspace.core-pane.v1` 实现，但当前代码又加入 official overlay/footer 宿主，并通过改写 `layout.openDetails()` 尝试接管旧 DSH。DSH staging 同时保留独立 Details column。两条路径无法共享真正的 owner-authored Details renderer，截图中的 Bash 仍落入旧列。

上一 RC 的 `dsh-unified-core-pane-v1` 已把兼容期限定为一个 RC，并要求下一 RC 另开 change 删除。本次就是该 removal release。

## Goals / Non-Goals

**Goals:**

- Tool Details 只由 `dsh.tool-details` Core view 渲染。
- DSH AppFrame 只保留 Sidebar、Conversation、Right、Bottom 与 Overlay，不再保留独立 Details track。
- Pane Workbench 只加载在完整 Core seam 上，缺失时立即报告版本不兼容。
- 删除 overlay/footer、方法 monkey patch、partial-host 和 legacy geometry 测试。

**Non-Goals:**

- 不为旧 DSH 提供运行时迁移或 feature flag。
- 不保留旧 package 与新 package 混装能力。
- 不改变 Tool Details 的 canonical selection/content owner。

## Decisions

### 1. 版本组合是唯一兼容边界

新 Pane Workbench peer floor 对齐包含 `workspace.core-pane.v1` 的新 DSH RC。旧 DSH 直接加载失败。相比运行时 probe 后降级，这能保证所有入口、几何和内容只有一个 owner。

### 2. 删除 Details geometry，不隐藏它

AppFrame、layout store 和 CSS 直接移除独立 Details 宽度、优先级与 occupant 分支；不会保留零宽列或 dead state。`layout.openDetails()` 保留为调用入口，但无条件转发给已 attach 的 Core host；未 attach 时报告明确错误。

### 3. 插件不再修改宿主方法

Pane Workbench 只通过 `workspaceLayout.attach(..., corePaneHost)` 接收 open/close 回调。删除 `shell.overlay`、`sidebar.footer.action` 和 `layout.openDetails()` 替换逻辑。

### 4. 回滚以完整 RC 为单位

不设计双运行时兼容。回滚时同时恢复上一版 DSH、Pane Workbench 与 profile lock，避免新插件加载旧 seam 或旧插件占用新布局。

## Risks / Trade-offs

- [未安装 Pane Workbench 时 Tool Details 不可用] → 新 Web profile 把 Pane Workbench 设为必装组成，并在启动期验证 Core owner attach。
- [旧 package cache 导致混装] → 提升 DSH 与 Pane package RC 版本及 peer floor，conformance 测试拒绝旧 seam。
- [上游 patch 漂移] → 从 clean upstream baseline 重新生成 `changes.patch`，并保留 focused ui-layout/ui-conversation 测试证据。
- [其他插件仍注册 overlay 降级] → 本 change 只删除 Pane Workbench/Tool Details 的历史兼容；通用 modal overlay 不属于 Details 几何，不一并删除。

## Migration Plan

1. 删除 Harness Plugins 的 official fallback 与对应测试，恢复 Core-only probe。
2. 删除 DSH staging 的 legacy Details geometry/fallback，令 Tool Details 必须走 Core adapter。
3. 更新所有内仓消费者、peer floor、bundle 和 focused tests。
4. 重建 Pane bundle，重新生成 upstream patch，跑 strict validation。
5. 发布时先发布新 DSH RC，再发布匹配 Pane Workbench RC，最后更新 profile lock。
6. 回滚时恢复上一组完整 RC；不得只回滚其中一个包。

## Open Questions

无。用户已明确选择删除历史兼容并直接切换新版本。
