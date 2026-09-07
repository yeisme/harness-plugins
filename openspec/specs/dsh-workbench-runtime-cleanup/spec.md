# dsh-workbench-runtime-cleanup Specification

## Purpose
统一 DSH 本地开发宿主及其 Pane 组件，保持会话和草稿隔离，移除内置重复 Target 展示，并规定可恢复清理与 Git 存档要求。
## Requirements
### Requirement: Development commands use one compatible runtime
开发命令 SHALL 使用同一经验证的 staging CLI 进行 profile 安装、配置探测与 Web 启动，不得静默回退到全局旧版。

#### Scenario: Compatible launcher from any working directory
- **WHEN** 用户执行项目开发入口
- **THEN** 命令解析到项目固定 staging CLI，并检查 release base 与独立 Pane 组件

#### Scenario: Missing or incompatible runtime
- **WHEN** staging 缺失或构建未支持独立会话
- **THEN** 命令报告明确准备步骤，不启动旧版

### Requirement: Composer context belongs to its pane
每个会话 Pane SHALL 绑定自身会话；内置 composer SHALL NOT 常驻渲染全局 Target 状态栏。

#### Scenario: Two visible sessions
- **WHEN** 拖拽另一会话创建分屏并切换当前会话
- **THEN** 两栏内容和草稿保持独立，页面没有内置 Target 状态控件

#### Scenario: Cross-session reference requires a choice
- **WHEN** 引用操作调用 chooseTarget
- **THEN** 唯一全局 Modal 按需打开；选择后验证 owner，取消不改变会话

### Requirement: Cleanup is recoverable and reviewable
清理 SHALL 保留会话、草稿、布局、无关改动与可回退安装副本，提交仅包含本轮拥有的源码补丁、操作指引、技能与规格。

#### Scenario: Old installation retired
- **WHEN** 用户批准清理旧版默认入口
- **THEN** 先保留可恢复安装副本，再绑定匹配 CLI；Git 存档不包含凭据或运行日志
