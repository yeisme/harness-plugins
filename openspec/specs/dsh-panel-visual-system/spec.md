# dsh-panel-visual-system Specification

(merged from archived change 2026-08-29-dsh-unified-panel-visual-system-v1)

## Purpose

定义插件面板共享视觉 token、状态语义、作用域隔离、交互底线与官方主题优先规则，避免各 Pane 产生互相冲突的样式系统。

## Requirements

### Requirement: Token registry 是面板样式的唯一事实源
插件侧面板使用的每一个 `--dsw-alias-*` 语义 token SHALL 在 visual kit 的 token registry 中登记唯一的 canonical fallback；采纳面板的样式 SHALL 引用 registry（直接常量或 `buildPanelStyles()` 输出），SHALL NOT 手写与 registry 分歧的 fallback 字面量，也 SHALL NOT 在样式串中为同一 token 名产生第二个 fallback 值。

#### Scenario: 同一 token 在一个面板内只有一个 fallback
- **WHEN** `buildPanelStyles({ scope: 'pane-domain' })` 输出被注入面板
- **THEN** 输出中的 token fallback 声明只出现在面板根 `[data-pane-domain]` 的一处变量块，其余规则只消费内部变量，同一 token 名不存在第二个字面量

#### Scenario: 官方 host 定义了变量
- **WHEN** `dsh web` host 在面板容器上定义了 `--dsw-alias-bg-base`
- **THEN** 面板背景使用 host 值，registry fallback 不覆盖它；host 未定义时面板使用 canonical fallback，不产生无样式裸面

### Requirement: 同义 token 归一到 canonical 名
visual kit SHALL 提供同义词映射（至少覆盖 `label-primary/secondary/tertiary/quaternary`→`text-primary/secondary/tertiary/quaternary`、`interactive-bg-hover`→`fill-hover`、`state-business-primary`→`accent`、`state-error-secondary`→`state-error`、`button-ghost-active-fill`→`fill-active`）；迁移中的面板 SHALL 通过映射消费旧名对应的 canonical fallback，SHALL NOT 因新旧名并存而出现双份或互相矛盾的 fallback。

#### Scenario: 迁移期读取旧名
- **WHEN** 尚未迁移的样式串仍引用 `--dsw-alias-label-tertiary`
- **THEN** registry 同义词映射给出与 `text-tertiary` 相同的 canonical fallback，两个名字在视觉上不可区分

### Requirement: 状态语义不得只靠颜色且映射唯一
visual kit SHALL 提供 owner status/freshness 词表到 tone 的单一映射（positive/info/warn/critical/neutral）；采纳面板展示状态时 SHALL 同时提供颜色以外的表达（文本、aria 或图标），SHALL NOT 在 kit 之外另建状态色字面量。

#### Scenario: reconcile 状态
- **WHEN** owner snapshot 的 status 为 `unknown` 或 `reconcile_required`
- **THEN** 面板渲染 critical/warn tone 的同时保留可见文本（如状态行或 reconcile 原因），不出现仅色点可辨的状态

#### Scenario: 词表外状态
- **WHEN** 出现映射表未覆盖的 status 字符串
- **THEN** 该状态落到 neutral tone 并保持文本表达，不抛错、不伪装成 ready

### Requirement: 面板交互底线完整
采纳面板 SHALL 提供一致的交互底线：数据为空时有 empty 状态与 recovery 动作（或明确说明为何无动作）；加载中有有界指示；出错时展示原因并提供 retry 或 reconcile 入口；禁用控件带有原因（title/aria）；键盘 focus-visible 有可见焦点环；`prefers-reduced-motion: reduce` 时关闭非必要动画。

#### Scenario: 空投影
- **WHEN** owner snapshot 的 items 为空
- **THEN** 面板显示 empty 状态文案与 recovery 动作（如刷新/重试），而不是空白区域

#### Scenario: 减少动画偏好
- **WHEN** 用户系统开启 `prefers-reduced-motion: reduce`
- **THEN** 面板内 skeleton/过渡动画停止，布局与信息不缺失

### Requirement: 样式按面板作用域隔离
`buildPanelStyles()` 输出的全部规则 SHALL 限定在调用方声明的 `[data-<scope>]` 之内；kit 输出 SHALL NOT 匹配宿主或其他插件的 DOM；各面板注入的样式串 SHALL 幂等（同 scope 重复注入不改变渲染语义）。

#### Scenario: 相邻面板互不污染
- **WHEN** Pane 工作台同时挂载 creator-studio 与 pane-domain 两个已采纳面板
- **THEN** 任一面板的规则不匹配另一个面板的节点，class 前缀相同的规则因 scope 限定而不跨界

### Requirement: 零运行时依赖与官方主题优先
visual kit SHALL 保持零运行时依赖（无 react/cordis peer，无网络与 DOM 访问）；kit 的价值 SHALL 以本仓库单测验证为准，完成门 MUST NOT 依赖官方 `dsh web` 合入、host 变量存在性或真实浏览器截图。

#### Scenario: 纯 Node 验证
- **WHEN** 在本仓库运行 visual kit 与采纳面板的 vitest
- **THEN** token 唯一性、scope 隔离、状态映射与交互底线均可在 jsdom/纯断言下验证，无需启动官方 host

### Requirement: 采纳面板以 kit 输出为样式门
采纳面板的测试 SHALL 断言其注入样式来自 `buildPanelStyles()`（相等或 snapshot 断言），SHALL 覆盖至少一个 empty、loading、error、disabled 与 focus-visible 场景；面板自有扩展样式 SHALL 作为 `extra` 传入构建器并在同一 scope 内生效。

#### Scenario: 样式回归被拦截
- **WHEN** 面板样式串被改为手写分歧 fallback 或绕过 kit
- **THEN** 该面板的样式断言测试失败，指出与 registry 的分歧
