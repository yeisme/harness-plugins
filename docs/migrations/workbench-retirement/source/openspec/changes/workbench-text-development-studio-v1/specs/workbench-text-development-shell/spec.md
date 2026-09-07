## ADDED Requirements

### Requirement: Text Development SHALL be one registered domain lens

Workbench SHALL 将 `agent.text-development.v1alpha1` 注册为既有 `/agent` Document Dock 内的 domain-lens document，并通过现有 Pane registry、layout reducer、UnifiedSurfaceFrame 与 shared Context rail 呈现。它 MUST NOT 创建独立主壳、第二个 dock、owner iframe 或 browser-authoritative capability。

#### Scenario: 用户打开 Text Development
- **WHEN** server descriptor 声明 compatible Auctra text capability
- **THEN** 现有 palette SHALL 启用 Text Development entry 并在中央 Document Dock 打开
- **AND** Agent timeline/composer SHALL 保持挂载且浏览器只访问同源 BFF。

#### Scenario: Owner contract 不可用
- **WHEN** capability 缺少、stale、revoked 或 offline
- **THEN** palette/surface SHALL 显示 `needs_contract`、`stale` 或 `offline` 与 declared recovery action
- **AND** MUST NOT 打开 synthetic editor 或读取本地项目文件。

### Requirement: Create and Collaborate SHALL be postures of one layout

`Create` 与 `Collaborate` SHALL 复用同一 session-scoped layout tree；Agent rail、Document Dock 和 Context rail 的区域身份固定，仅改变宽度 token、焦点和默认 active Pane。

#### Scenario: 编辑中切换姿态
- **WHEN** editor 存在 unsaved buffer、selection 和 pending candidate 时切换 posture
- **THEN** editor instance、buffer、selection、session、Task 和 owner subscription SHALL 保持连续
- **AND** composer MUST NOT remount 或丢失 draft。

### Requirement: Text Development SHALL provide a shared core and bounded lenses

Surface SHALL 提供 Document、Outline、Entities、Materials、Review 共享 Lens，并按 capability 增加 Novel Timeline/Foreshadowing、Screenplay dual Timeline/Scene-Beat、Self-media Brief/Claims/Channel Checks。未知 Lens MUST fail closed。

#### Scenario: 项目只支持小说 Lens
- **WHEN** descriptor 未声明 screenplay 或 self-media capability
- **THEN** Workbench SHALL 只呈现 shared + Novel Lens
- **AND** MUST NOT 根据项目文件名推断或启用其它 Lens。

### Requirement: Mobile SHALL remain a review surface

窄屏 SHALL 支持正文只读、Agent 对话、Context、findings、diff、comment 和 accept/reject，并将完整编辑与结构拖拽标记为 desktop-required。Sheet SHALL 使用既有 focus trap、Escape、scroll lock 和 focus restore。

#### Scenario: 手机打开候选改写
- **WHEN** 用户在 phone viewport 打开 pending candidate
- **THEN** Workbench SHALL 显示可滚动 diff、影响摘要和允许的 decision actions
- **AND** SHALL NOT mount CodeMirror edit mode 或高密度结构拖拽。

### Requirement: Every shell state SHALL be truthful

Working Copy、Context、Candidate 和 Team surface SHALL 覆盖 loading、empty、ready/running、error/offline、partial/stale、permission/cost 与 unknown 状态；unknown MUST only expose original-operation reconcile。

#### Scenario: Candidate apply outcome unknown
- **WHEN** BFF 无法确认 Auctra 是否接受 apply
- **THEN** Workbench SHALL 保留 last-confirmed text 和 candidate correlation
- **AND** SHALL 禁用 retry/duplicate accept，只显示 Reconcile。

### Requirement: Context information SHALL use four stable decks

Text Development SHALL 将右侧领域信息组织为 `Structure`、`Review`、`Versions` 和 `Team` 四个稳定 deck。Outline/Entities/Materials、candidate/findings、Working Copy/Checkpoint/ReviewItem/Canon、Ordo Plan/Run SHALL 分别归入其 owner；Workbench MUST NOT 将所有子能力渲染为一排平级标签或重复侧栏。

#### Scenario: 用户从写作切到候选审阅
- **WHEN** 当前文档出现 pending candidate
- **THEN** Review deck SHALL 显示 attention 并可由用户显式打开
- **AND** Structure、Versions、Team 的 selection/scroll state SHALL 保留且不 remount editor。

### Requirement: Layout posture SHALL respect effective-width budgets

Create 与 Collaborate SHALL 依据有效宽度选择三域、双域或 Sheet 组合。`1280–1535px` 的 Collaborate posture MUST NOT 通过同时扩大 Agent 与 Context rail 将 Document 压到低于可用编辑宽度；`<1024px` SHALL 提供 review decision 等价路径而不挂可编辑 CodeMirror。

#### Scenario: 1440px 进入 Collaborate
- **WHEN** 用户在 1440px 宽度打开 Team Plan
- **THEN** Team Plan SHALL 成为中央 active document且 Chat 保持可用
- **AND** Context MAY 折叠或转 Sheet，但不得静默删除 risk、writer、budget 或 approval 信息。

### Requirement: New Text Development UI SHALL reuse the Workbench component system

Text Development SHALL 使用现有 semantic tokens、icon registry、primitives 与 shared composites。Feature-local editor、selection、candidate、version 和 Team composition MUST NOT 注册第二套 Button、Dialog、Tabs、Status、empty/recovery、palette、font stack 或 color system。

#### Scenario: 实现 selection action bar
- **WHEN** 现有 Button、Popover、DropdownMenu 与 Tooltip 能表达动作、overflow 和说明
- **THEN** 实现 SHALL 组合这些组件并保持统一 focus/motion/token 合同
- **AND** MUST NOT 直接导入 Radix/Lucide 或创建局部 modal/focus trap。
