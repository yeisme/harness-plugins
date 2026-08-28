## Why

DSH 插件已经统一了一部分主题 token，但 Pane、dialog、overlay、dock 与微表面仍各自维护内容骨架和控件样式，Source Control 甚至存在有 class 无 CSS 的裸控件退化。当前 Creator、工具与运维能力已基本交付，必须在继续扩展功能前冻结一个可复用、可验证的 Web surface 合同，避免每个插件继续产生新的视觉代际。

## What Changes

- 新增 React/Web surface composition 包，在现有零依赖 visual kit 与官方 DSH primitives 之上统一 Context Bar、Section、State 与 Action Bar；不创建第二套 Button/Input/Modal/Menu。
- 统一 `navigator|workspace|inspector|dialog|micro` 五类 Web surface，使用 container query 而不是 viewport JS 决定内容密度；布局变化不得改变 mutation admission。
- 按四波迁移全部 React/Web 表面：基础层、工作台与工具面、创作与 Agent workspace、dialog/overlay/微表面。TUI 不在本 change 内。
- Creator Studio 在 `dsh-creator-unified-pane-workspace-v2` 已交付的资产、生成、审批与 Drama 能力上增加生命周期视觉分组，保留现有多 Pane tab、view kind、command 与兼容别名。
- 新增 Source Control、Creator Studio 与代表性 surface 的语义测试、全仓 conformance 门和确定性 Playwright 截图回归；每次视觉运行写入脱敏 integration-test evidence。
- 全部变更 additive：不删除现有公开 TypeScript API、view kind、command、data attribute、Owner 投影或操作入口，不增加运行时新旧 UI feature flag。

## Capabilities

### New Capabilities

- `dsh-web-surface-system`: 定义全部 React/Web 插件 surface 的 composition API、官方 primitives 复用、容器密度、状态、可访问性、迁移与视觉验收合同。
- `creator-studio-lifecycle-surface`: 定义 Creator Studio 的 Start/Create/Produce/Review/Library 生命周期视觉分组、首页层级、Owner 状态入口和多 Pane tab 保持规则。

### Modified Capabilities

无。本 change 通过新增 surface capability 叠加到现有 Pane/Creator 合同，避免与并行的 `dsh-creator-unified-pane-workspace-v2` 重复修改同一 Requirement。

## Impact

- 新包：`packages/client/ui-surface`（`@yeisme/dsh-client-ui-surface`），React composition only，消费 `@yeisme/dsh-client-ui-visual-kit` 与官方 `@deepseek-ai/dsh-client-ui-primitives`。
- 采纳面：`packages/client/ui-*` 的全部 React/Web surface，以及 bundle 内自有的 file/document、rich-media、terminal、workbench composition Web UI；`ui-command-experience-tui` 明确排除。
- 重点行为：Pane Workbench Source Control、Creator Studio、Desktop Workbench、MCP Inspector、DevTools、Token Usage、Cookie Manager、AI Drama Director、Domain/Agent/Ordo Pane 和各类 overlay/dialog。
- 工具与证据：根 package 增加 surface conformance 与 `pnpm run test:visual`，证据写入本子仓 `temp/integration-test-runs/<run-id>/`。
- 兼容：官方 primitives 只使用 rc.6/rc.7 公共交集；旧 `cs-*`/`pwr-*` class 本 change 不删除；回滚按波次回退包版本或提交，无数据迁移。
