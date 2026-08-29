# dsh-semantic-file-editor-pane Specification

(merged from archived change 2026-08-29-dsh-semantic-file-editor-pane-v1)

## Purpose

定义 `desktop.file` 的格式感知语义编辑体验、版本化 mutation、可审查 workspace edit、lazy renderer 与安全降级边界。

## Requirements

### Requirement: desktop.file SHALL render files by format and capability
`desktop.file` SHALL 保持现有 Pane identity，并按文件类型提供格式感知 renderer。代码默认 Editor；Markdown 提供 Rendered/Editor/Split；JSON/YAML/TOML 提供 Editor/Structure。缺 semantic bundle、V2 ref、Worker 或 Language Server 时 SHALL 使用现有安全 fallback。

#### Scenario: 打开代码文件且无 LSP
- **WHEN** 文件可完整读取且 AST provider 可用，但 Language Server 不可用
- **THEN** Pane 显示编辑器、基础高亮、Structure 与 `AST only`
- **AND** 保存能力仍由 File owner capability 决定

#### Scenario: 打开 Markdown
- **WHEN** 用户打开 Markdown 文件
- **THEN** Pane 提供安全 rendered view 与 source/split mode
- **AND** Markdown 不再是其它文件类型的统一 renderer

#### Scenario: truncated 文件
- **WHEN** File owner 返回 truncated 或 binary
- **THEN** Monaco/LSP 完整模式禁用
- **AND** Pane 使用 bounded source/media fallback 并显示原因

### Requirement: Editor SHALL expose bounded structure, diagnostics and safe language mutations
当 Host capability 可用时，Editor SHALL 提供 Outline、Problems、format、rename 与 edit-only code action，并按 capability 独立启用。Language Host SHALL 同时归一化 semantic tokens、symbols、hover、completion 与 definition/references，供后续 renderer contribution 渐进采用；Client 不得仅从 languageId 猜测能力。

#### Scenario: definition target 在 workspace 内
- **WHEN** server 返回可解析到 owner opaque ref 的 definition
- **THEN** Host facade 返回 owner opaque ref 与 range；只有存在显式 Pane navigation adapter 时才打开目标
- **AND** 浏览器不接收目标绝对路径

#### Scenario: definition target 越界
- **WHEN** target 不属于授权 workspace 或无法映射 ref
- **THEN** action 返回空结果、被禁用或显示 unavailable reason
- **AND** 不打开 external/file URI

### Requirement: Editor mutation SHALL be version-fenced and reviewable
单文件保存 SHALL 使用 `FileHostV1.writeText(expectedVersion)`。format、rename 与 code action 产生的多文件 edit SHALL 先显示 bounded diff，并经 `FileWorkspaceEditHostV1` preflight、明确确认和 receipt 后执行。

#### Scenario: 单文件保存冲突
- **WHEN** 文件在打开后被外部修改
- **THEN** 保存返回 conflict，Pane 保留草稿并进入 stale/conflict
- **AND** 不覆盖 owner 新版本

#### Scenario: 多文件 rename 确认
- **WHEN** rename 影响多个现有文件且全部版本匹配
- **THEN** Pane 展示目标与 diff，用户确认后由 File owner 执行
- **AND** receipt 明确每个文件结果

#### Scenario: workspace edit 包含资源操作
- **WHEN** edit 请求创建、删除或移动文件
- **THEN** V1 拒绝整个 action
- **AND** 不产生 partial mutation

### Requirement: Heavy renderer SHALL load lazily and dispose symmetrically
Monaco renderer、stylesheet 与 worker SHALL 从 bundle-owned same-origin versioned assets 按需加载，不进入核心 Workbench client bundle。Pane suspend/close/unload MUST release model、handle、listeners 和 worker-facing resources。

#### Scenario: Worker 或 CSP 加载失败
- **WHEN** Monaco asset 无法加载
- **THEN** registry 回退 builtin Markdown/source renderer
- **AND** Pane 显示可恢复原因而非白屏

#### Scenario: Pane 重复打开关闭
- **WHEN** 同一文件多次 preview、pin、move、close
- **THEN** 每个可见 view 最多一个 model 和 document handle
- **AND** close 后不存在 stale diagnostics、listener 或 duplicate worker registration
