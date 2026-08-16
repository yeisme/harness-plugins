## ADDED Requirements

### Requirement: composition preview 保持独立 package owner

@yeisme/dsh-agent-composition-preview SHALL 保持独立的 package、version、service/mount lifecycle 和 DSH composition facts owner。@yeisme/dsh-ordo-agent-ops 可以把它作为 direct dependency 及独立命名 patch row 挂载，以维持单条 Ordo 安装命令；但不得把其实现、文件、release ownership 或 canonical facts 迁入 Ordo package。

#### Scenario: 单独安装 Ordo Agent Ops

- **WHEN** 用户只安装 @yeisme/dsh-ordo-agent-ops
- **THEN** profile SHALL 正常加载 Ordo bridge、/ordo、sidebar 与独立 composition preview row，且不得出现未解析的 composition 或旧 leaf package

#### Scenario: 单独安装 composition preview

- **WHEN** 用户独立安装 @yeisme/dsh-agent-composition-preview
- **THEN** package SHALL 继续只提供 composition facts、digest、health 与 drift，而不注册 Ordo Agent Ops state owner

### Requirement: Ordo 对 composition facts 的可选合同消费

Ordo adapter 只有在独立 composition preview 已 mount 且返回兼容安全 envelope 时才可读取其 facts。package 缺席、schema mismatch 或 unknown SHALL 显示 unavailable/needs_contract；Ordo SHALL 不复制、补造或提升 composition facts 为 maturity、risk、qualification、approval 或 receipt。

#### Scenario: 可选合同存在

- **WHEN** 独立 composition service 返回兼容的安全 facts envelope
- **THEN** Ordo adapter SHALL 以只读 ref/summary 使用它，并保留事实的原始 owner attribution

#### Scenario: 可选合同缺席或失效

- **WHEN** composition service 未 mount、不可解析或返回不兼容 envelope
- **THEN** Ordo adapter SHALL 降级为不可用状态，且不得从 local cache、preset 文件或 browser state 推导替代事实

### Requirement: preset 分发与 UI 基础设施不被吸收

@yeisme/dsh-anchored-standard SHALL 保持独立实验 preset 分发 package。此 change SHALL 不创建 dsh-plugin-ui-kit，也不得将 Anchored Standard、文件树、预览器、SCM、FS/Git 写入或 AionUI SSE/route 模型加入 Ordo package。

#### Scenario: package inventory 复核

- **WHEN** 发布前审查 workspace package、package.json、cordis.patch.yml 和 tarball files
- **THEN** Anchored Standard SHALL 保持 Ordo 依赖闭包之外，且 unified Ordo package SHALL 不包含通用 Pane 或禁止的业务能力
