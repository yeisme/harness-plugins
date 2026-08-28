## ADDED Requirements

### Requirement: Web surfaces SHALL share one composition contract
仓库 SHALL 提供 `@yeisme/dsh-client-ui-surface`，且公开 composition 面 SHALL 限于 Surface、SurfaceContextBar、SurfaceSection、SurfaceState 与 SurfaceActionBar 及其类型。该包 SHALL 复用 visual-kit token/fallback 与官方 DSH primitives，MUST NOT 重建 Button、Input、Modal、Menu、Pill、StateDot 或 DiffBlock。

#### Scenario: A plugin adopts the surface package
- **WHEN** 一个 React/Web 插件迁移 pane、dialog、overlay、dock 或 micro surface
- **THEN** 它 SHALL 使用共享 composition 骨架，并直接使用官方 primitives 实现已存在的原子控件

#### Scenario: Official primitives versions differ
- **WHEN** 消费包当前使用 rc.6 或 rc.7 primitives
- **THEN** surface package SHALL 只依赖两版公共 API 且不得迫使消费包升级 React major

### Requirement: Surface density SHALL follow container width without changing authority
Surface SHALL 支持 navigator、workspace、inspector、dialog 与 micro 类型，并使用 CSS container query 在 compact、standard 与 wide 密度间切换。容器尺寸 MUST NOT 参与 mutation、approval、permission 或 owner readiness 判定。

#### Scenario: A pane is narrow inside a wide browser
- **WHEN** pane 容器宽度不超过 420px 但浏览器 viewport 仍是桌面宽度
- **THEN** 内容 SHALL 使用 compact 布局，且高风险 action 的启用状态 SHALL 继续由既有 admission 逻辑决定

#### Scenario: Workspace becomes wide
- **WHEN** workspace surface 容器宽度超过 720px
- **THEN** 它 MAY 使用主内容+composer 双栏，但 MUST 保持相同数据和操作合同

### Requirement: Surface states SHALL be complete and accessible
SurfaceState SHALL 统一 loading、empty、error、stale、partial、success 与 disabled 的 tone、可见文本、role/aria-live 和 recovery action。状态 MUST NOT 只靠颜色表达；disabled action SHALL 暴露原因；focus-visible、coarse pointer 与 reduced-motion SHALL 在共享层生效。

#### Scenario: Stale data remains visible
- **WHEN** surface 进入 stale 或 partial 且仍有最后安全内容
- **THEN** surface SHALL 保留内容、显示状态原因并禁用不安全 mutation，而不是清空页面

#### Scenario: Keyboard user opens a dialog
- **WHEN** dialog 或 menu 使用官方 primitive 打开
- **THEN** Escape、focus trap/return、accessible title 与 disabled item 行为 SHALL 由官方 primitive 或现有宿主合同保持

### Requirement: All React Web visual surfaces SHALL adopt or explicitly embed
所有 `packages/client/ui-*` React/Web surface 与 bundle 自有 Web UI SHALL 被 surface catalog 覆盖。完整 pane/dialog/overlay/dock SHALL 采纳 Surface；Mermaid、Markdown table、structured content 等嵌入 renderer SHALL 标记为 embed 并只消费统一 token/排版。TUI SHALL 被显式排除，MUST NOT 被 Web CSS 或组件依赖污染。

#### Scenario: Conformance scans the repository
- **WHEN** 运行 Web surface conformance
- **THEN** catalog 中每个 Web UI package SHALL 被分类为 adopted 或 embed，未分类的新 Web surface SHALL 使检查失败

#### Scenario: TUI package is present
- **WHEN** catalog 遇到 `ui-command-experience-tui`
- **THEN** 检查 SHALL 将其标记为 excluded 且不得要求 React surface 依赖

### Requirement: Migrated surfaces SHALL not regress to unstyled controls
迁移 surface 的 select 与 textarea SHALL 位于共享 field 结构；官方已有 atom 的控件 SHALL 优先使用官方 primitive。已迁移业务 surface MUST NOT 引入分歧 token fallback、业务硬编码颜色或未白名单的顶层 inline layout；动态进度、拖拽和测量几何 MAY 使用具名白名单。

#### Scenario: Source Control renders repository controls
- **WHEN** Source Control 显示 repository selector、commit composer 或 remote 状态
- **THEN** 控件 SHALL 使用统一 field/button/state 样式，且不得回退为浏览器原生外观

#### Scenario: Dynamic geometry is used
- **WHEN** drag ghost、virtual row、progress 或 measured pane 需要运行时 style
- **THEN** conformance SHALL 只允许已记录文件与用途，其他顶层 inline style SHALL 失败

### Requirement: Visual acceptance SHALL produce deterministic redacted evidence
仓库 SHALL 提供 `pnpm run test:visual`，在固定数据、locale、时间、动画与 360/560/960px 容器下运行 Playwright screenshot regression。每次运行 SHALL 在本子仓 `temp/integration-test-runs/<run-id>/` 生成 summary.json、command.txt、stdout.log、stderr.log、env.json 与 artifacts，失败 MUST 保持原 exit code并脱敏。

#### Scenario: Visual baseline matches
- **WHEN** 所有 screenshot 的 diff 不超过 maxDiffPixelRatio 0.005 且无 console error
- **THEN** summary SHALL 标记 passed 并列出 baseline 与 evidence artifact

#### Scenario: Visual regression occurs
- **WHEN** 截图、console 或 interaction assertion 失败
- **THEN** runner SHALL 保存 actual/diff/log、写 failed summary 并以非零状态退出

### Requirement: Surface migration SHALL remain backward compatible
本 change SHALL 只新增 package/export 与 UI composition。现有公开 TypeScript symbol、view kind、command、bundle path、DOM data attribute、Owner projection 与操作入口 MUST 保持；旧 `cs-*`/`pwr-*` class SHALL 在本 release 保留。

#### Scenario: Old persisted pane is restored
- **WHEN** persistence 或 deep link 使用旧 view kind 打开已迁移 surface
- **THEN** 对应新视觉组件 SHALL 正常渲染且不得报 unknown view

#### Scenario: A migration wave is rolled back
- **WHEN** 单波 package 版本或提交被回退
- **THEN** Owner canonical state、持久化 schema 与 visual-kit token 合同 SHALL 不受影响
