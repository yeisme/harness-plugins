# 会话工具工作区与 Pane 会话管理 V2

## Why

Tools 当前注册为全局 singleton Pane，却通过 sessions.list.current 读取调用记录，不能表达多个并排会话的固定绑定。目录来自全局 toolHub，活动来自会话快照；两者的作用范围、可用性与错误状态混在同一首屏。用户还遇到“工具目录不可用”，此前重启与页面冒烟不能证明目录功能正常。

本方案来自已确认的 grill-me 决策：会话工具 Tab 为主，默认活动与失败定位；可以固定到绑定会话的旁栏；Pane 标题管理会话标签组；全局工具管理独立；Tools 全功能与全部插件加载/入口分别验收。

## What Changes

- 通过 conversation.view 提供会话工具 Tab，复用同一内容组件渲染固定工具旁栏。
- 目录分别读取会话实际可见能力与全局管理数据；修复连接失败后的重探测和恢复。
- 活动采用紧凑列表、状态筛选、时间线与选中调用详情；提供脱敏错误摘要及原消息定位，不新增直接重试。
- Pane 标题支持会话搜索、切换、固定和重新打开原会话；固定工具旁栏不追随全局 current。
- 对现有 view kind、命令、持久布局采用兼容迁移；保持 VS Code 风格按键，不恢复 tmux 前缀。
- 建立 Tools 全功能验收与动态插件 inventory 冒烟矩阵。当前发现 33 个本地 bundle，执行时重新发现，不硬编码数量。

## Capabilities

### New Capabilities

- `dsh-session-tools-views`: 会话工具 Tab、目录恢复、活动诊断与全局管理边界。
- `dsh-pane-session-affinity`: 标题会话管理、固定绑定与生命周期。
- `dsh-tools-formal-acceptance`: Tools 全功能、插件冒烟和可审计验收。

### Modified Capabilities

无；按本项目规则，新 change 仅新增 requirements。既有 dsh-tools-center-observability 的安全投影、CAS 启停、列表/时间线与 i18n/a11y 约束继续有效。本 change 对会话 Tools 的首屏布局明确替代其旧目录优先、宽屏 58/42 与“详情”一级切换方案；归档时同步旧 spec 的适用范围，避免同时要求两种首屏。

## Impact

fit：Tools 内容、目录适配和状态管理归 harness-plugins；会话和工具执行归现有 DSH Host。
split-owner：Pane 标题、会话标签组、绑定传递与消息聚焦 seam 归宿主 ui-layout/ui-conversation；仅通过 upstream-prs 增量维护，不建立 core fork。

不新增工具执行器、会话数据仓库、自动重试、外部服务配置或模型调用。不扩展 33 个插件为逐项业务全功能验收。此次提交只交付规格、文档与任务，功能仍待实现。
