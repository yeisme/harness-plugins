## Why

DSH Web 当前把选中行为、交互空间和各个 Pane 的局部按钮分别实现。任何文本
选中都会立即出现一条很宽的动作栏，并可能在一次交互内打开紧凑 Composer；相同
动作在文本、图片、表格和编辑器中重复出现，宿主也无法稳定决定哪些动作适用。
这造成三个问题：

1. 选中从“准备上下文”变成了高频打断，用户只是阅读或复制时也会被浮层占用视线。
2. 每个 Pane 都在局部维护选择、菜单、Composer 和关闭规则，视觉 token、键盘路径、触控退化和能力缺失文案不一致。
3. 扩展只能追加按钮，不能声明上下文、能力、危险级别、预览要求和 owner，导致“看起来能点”与“实际能执行”脱节。

本 change 把选区视为统一 interaction context，而不是所有动作的自动入口。只有
稳定且明确的文本/源码、图片区域、表格范围或编辑控件选择才进入全局单例交互层；
交互层按上下文和 capability 解析有限的动作，并在用户明确选择动作后才打开
Composer 或 owner flow。

## What Changes

- 正式替代 V1 的选区触发语义：取消“选中即自动打开 Composer”，改为稳定选区后的短生命周期 Actions 入口；重新选择、滚动、Esc、点击外部均关闭，只有显式 Pin 才进入持久入口。
- 新增全局 singleton interaction layer。Workbench、Interaction Space、Selection Annotation 和未来 Pane 只提供 selection context，不各自创建工具条或 Composer。
- 统一动作描述与注册合同：动作使用 namespaced id、上下文过滤、能力探测、优先级、危险级别、执行 owner、预览策略和可本地化标签；descriptor 不包含 React/DOM callback、URL、patch 或 provider payload。
- 统一密度：桌面端显示 1 个 primary、2 个 secondary 与 More；不适用动作隐藏，适用但能力缺失的动作只在 More 中 disabled 并解释原因。
- 建立 per-context user/workspace preferences：workspace > user > built-in；配置动作显示/顺序、快捷键、密度与 preset，入口位于 Workspace Designer 的“Selection & Interaction”区。
- 覆盖编辑控件选择：默认 input、textarea、contenteditable、代码编辑器均可接管，但始终排除密码/敏感区域、交互层自身、Composer 和宿主显式 opt-out 区域。
- 支持触控退化：触摸端只显示一个 Actions 入口，点击后使用 Bottom Sheet；键盘保留原焦点，默认 `Alt+Enter` 聚焦 Actions，快捷键可配置。
- 保留旧 action id 作为 alias，采用 capability probe + V1 adapter 完成一个 release 的迁移；随后删除 V1 runtime，不改变安装包名。

## Capabilities

### Modified Capabilities

- `dsh-selection-agent-review`：修改选区触发、Composer 打开时机、工具条动作密度与兼容要求；锚点、版本围栏、逐位置审批、隐私和 split-owner 语义继续有效。

### New Capabilities

- `dsh-selection-interaction-v2`：统一 singleton interaction layer、typed action descriptor/registry、上下文解析、偏好、触控/键盘、编辑控件接管、扩展 SDK、V1 migration 与证据门。

## Compatibility classification

这是一次**有迁移窗口的行为替代**，不是 additive-only change：

- **稳定保留**：安装包名、现有 action id（作为 alias）、anchor 协议、`dsh-selection-annotation:submit` 和 `add-to-batch` 事件的 owner 语义、preview-first、逐位置审批、版本围栏。
- **有意改变**：选择后不再自动打开 Composer；默认工具条从多主按钮收敛为 1+2+More；Pane 不再拥有独立 selection toolbar。
- **兼容策略**：旧宿主 capability 只支持 V1 时，由 bundle 内 adapter 投影旧行为一个 release；新宿主优先 V2。adapter 产生 deprecated diagnostic/evidence 标记，但不记录原文、prompt 或 provider payload。
- **移除条件**：V2 bundle 连续一个 release 满足浏览器、键盘、触控、HMR/dispose 和宿主集成验收，且 rollback window 关闭后，下一 removal release 删除 V1 runtime 和 adapter。

## Impact

- `packages/client/ui-interaction-space`：承载 V2 contracts、registry、controller、preference merge 与全局 overlay bridge。
- `packages/client/ui-selection-annotation`：改为提交 selection context 并消费 singleton overlay；保留 anchors、Composer、审批和批注能力。
- `packages/client/ui-pane-workbench`：提供 Workspace Designer 配置入口与 context owner handoff，不再复制 selection toolbar。
- `packages/bundle/dsh-selection-annotation`、`packages/bundle/dsh-interaction-space`：协商 V2 capability，旧宿主走 adapter。
- `packages/client/ui-visual-kit`、`packages/client/ui-surface`：作为唯一视觉基础；不新增第三套 token 或 CSS reset。
- 文档与验证：增加 V2 设计摘要、包 README、Playwright screenshot 规格和迁移/回滚 runbook。

## Non-goals

- 不把浏览器变成会话、评论、文件、审批或配置的 canonical owner。
- 不在本 change 实现跨会话评论恢复、多人实时协作、桌面截图或无审批自动修改。
- 不引入新的 CSS-in-JS、菜单、快捷键或状态管理依赖。
- 不删除现有 anchor、proposal、receipt 或 owner dispatch 合同；不把 raw patch、URL、provider payload 暴露给浏览器。
- 不为每个领域 Pane 建独立动作栏；领域动作必须注册到统一 registry。

## Acceptance summary

完成必须同时满足：OpenSpec 严格校验通过；V2 component/integration tests 覆盖 context、registry、dismissal、focus、touch sheet、preferences、capability disabled、HMR/dispose；Playwright 在 360/560/960px、dark/reduced-motion 下通过；V1 adapter 可回滚且无旧宿主回归；所有集成证据写入脱敏的 `temp/integration-test-runs/<run-id>/`。
