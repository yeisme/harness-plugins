## Why

创作侧 owner 工具（Eikona/Scaena/Sonora/Auctra/Pinax/Anatomia、Creator Studio、AI Drama Director）的 host 合同与投影已经完备，但面板表现层是四代并存的碎片：

- `ui-creator-studio` 有一套完整自绘 CSS；`ui-pane-workbench` 的 chrome 有另一套 token fallback；`ui-desktop-workbench`/`ui-pane-subagent` 用同义但不同名的 token 词汇（`label-*`/`state-*`/`interactive-*` vs `text-*`/`fill-*`/`accent`）；`ui-pane-domain`（六个创作工具的 domain pane）完全无样式，裸 DOM 直接进 Pane。
- 同一个 `--dsw-alias-*` token 名在仓库内携带 2–4 个不同 fallback：`region-chrome.ts` 单文件内 `--dsw-alias-bg-elevated` 有 `#1c1c1f/#202024/#222226/#242429` 四个值；`label-primary` 有 `#ececf1/#f2f2f4/#fff` 三个值；`bg-base` 有 `#151517/#171719`。官方 host 未定义变量时（本地测试、降级环境），同一窗口里相邻面板颜色、圆角（6/7/8/9/10/11/12px）、控件高度（28/30/34px）、状态色各不相同。
- 状态语义没有单一事实源：`running` 在 creator-studio 是蓝、在其他面板可能没有色；`unknown/reconcile_required` 的红/中性归属不一致；部分面板状态只靠颜色表达。
- 交互底线不统一：empty/loading/error/disabled/focus-visible/reduced-motion 有的面板齐全、有的完全没有。

用户当前的产品诉求是"直接完善面板交互体验和统一风格"。继续让每个插件各自推导样式只会扩大债务；需要一个插件侧共享的视觉系统核心，同时不越过边界：官方 `dsh web` host 仍是主题与 slot 的 owner，插件只通过 `--dsw-alias-*` 变量消费主题并提供 canonical fallback。

## What Changes

- 新增共享包 `@yeisme/dsh-client-ui-visual-kit`（`packages/client/ui-visual-kit`）：零运行时依赖，导出 canonical token registry（token 名 → 唯一 fallback + 同义词映射）、状态 tone 语义表、以及 `buildPanelStyles()` 作用域 CSS 构建器（base/chrome/state 三层）。
- Token registry 成为 `--dsw-alias-*` fallback 的唯一事实源：采纳面板不得再手写分歧 fallback 或裸 hex 状态色；同义词（`label-*`→`text-*`、`interactive-bg-hover`→`fill-hover`、`state-business-primary`→`accent` 等）在采纳时归一到 canonical 名。
- `buildPanelStyles({ scope, accent?, extra? })` 在面板根 `[data-<scope>]` 上一次性声明全部 token fallback（`--vk-*` 内部变量链到 `var(--dsw-alias-…, canonical)`），规则全部限定在 scope 内，杜绝跨插件泄漏与单文件内多 fallback。
- 状态语义单一化：`statusTone()` 把 owner status/freshness 词表（ready/completed/running/partial/stale/approval_required/offline/failed/contract_mismatch/reconcile_required/unknown…）映射到 positive/info/warn/critical/neutral 五个 tone；状态表达不得只靠颜色（需同时有文本或 aria）。
- 交互底线：采纳面板必须提供 empty+recovery action、loading 有界指示、error 原因+retry、disabled 原因（title/aria）、focus-visible 焦点环、`prefers-reduced-motion` 降级；390px 无横向溢出。
- 采纳切片按用户价值排序：V1 先落地 `ui-pane-domain`（当前零样式、是六个创作工具的 pane）与 `ui-creator-studio` 的 token 归一；后续切片覆盖 pane-workbench chrome fallback、session-tags/cookie-manager/next-step/conversation-rewrite、desktop-workbench/subagent 的同义词迁移。
- 采纳面板的单测断言样式串来自 kit（snapshot/相等断言），形成防回归门；不新增重依赖、不 fork DSH core、不把官方 `dsh web` 合入或 host 变量存在作为完成条件。

## Capabilities

### New Capabilities

- `dsh-panel-visual-system`: 定义插件侧面板视觉系统的 token registry、scoped 样式构建、状态 tone 语义、交互底线与采纳/验证合同。

### Modified Capabilities

无。本 change 只新增能力；既有 `dsh-pane-workbench-extension`、`dsh-unified-core-pane` 等 spec 的 Requirement 不修改。面板采纳属于各包实现工作，落在 tasks 中，不改写其既有 spec 语义。

## Impact

- 新包：`packages/client/ui-visual-kit`（`@yeisme/dsh-client-ui-visual-kit`），纯 TS 常量与 CSS 字符串构建器，无 react/cordis peer。
- 采纳包（V1）：`packages/client/ui-pane-domain`、`packages/client/ui-creator-studio` 增加 workspace 依赖并改造样式注入；后续切片触及 `ui-pane-workbench`、`ui-session-tags`、`ui-session-cookie-manager`、`ui-next-step-suggestions`、`ui-conversation-rewrite`、`ui-desktop-workbench`、`ui-pane-subagent`。
- 风险与约束：不改变任何 host/owner 合同与投影数据；样式串进各插件 bundle（每包内联一份相同规则，scope 隔离，接受该重复）；官方 host 定义变量时必须继续生效（fallback 只在缺失时兜底）。
- 回滚：移除各包对 kit 的依赖与 `<style>` 注入即可，DOM/合同不变；kit 包无消费者时可整包删除。
