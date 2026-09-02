## ADDED Requirements

### Requirement: 最小完整基础 bundle

仓库 SHALL 提供可由 `dsh plugin --profile tui add` 安装的 `@yeisme/dsh-personal-coding-base`，只组合黄金路径所需的 command experience、file/document、Git typed actions、terminal、devtools/diagnostics、plugin contracts 和 Ordo command projection；bundle MUST 不拥有 Session、candidate、run、lease 或领域 canonical state。

#### Scenario: 安装基础包

- **WHEN** setup 将基础 bundle 加入 tui profile
- **THEN** catalog/probe SHALL 报告核心 command/file/git/terminal/diagnostic 能力及其 owner，且不默认启用创作或领域 panes

### Requirement: Packs 显式且静态可发现

可选 packs SHALL 来自构建时静态 catalog，并通过稳定 pack id 显式选择；系统 MUST 不自动安装全部 bundle、不访问远程 registry 或发送遥测。

#### Scenario: 请求未知 pack

- **WHEN** setup 请求 catalog 中不存在或不可安装的 pack id
- **THEN** 安装 SHALL fail closed 并列出可用 ids，现有 profile MUST 不改变

### Requirement: 组合可重复验证

base/packs 的 bundle graph、insert ids、build output、safe projection 和启动 smoke SHALL 进入 toolchain 检查；重复组合 MUST 产生稳定顺序且无 duplicate insert。

#### Scenario: Pack 与 base 重复声明 insert id

- **WHEN** 新 pack 引入已被基础包使用的 insert id
- **THEN** declaration/bundle contract check SHALL 红灯并指出冲突包，catalog MUST 不把该组合标为可用
