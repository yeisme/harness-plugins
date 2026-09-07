## Why

现有引用链路已经提供来源、目标会话与结构化发送，但引用展示、源码编辑和发送内容之间的关系不够直接。用户已确认本轮以“引用是可编辑的提示词内容”为核心：客户端提供紧凑引用块和按需预览，同时通过侧边成果面板完成工程与媒体创作闭环。

## What Changes

- 新增经过能力协商的可编辑提示词引用模式：插入时固定有界内容，修改不影响来源，刷新前比较差异；不把自由编辑文本宣称为来源原文。
- 主输入框默认紧凑、可展开；引用显示标题及约三行内容，原位切换源码编辑；显示、编辑、发送预览和实际提交共用内容投影。
- 统一 @、选区、拖入和再次引用入口，保留明确目标、光标、跨面板反馈、发送确认和草稿隔离。
- 侧边成果面板同等覆盖文档、代码、图表、网页及图片音视频：直接编辑或标注、候选版本、比较、采纳和再次引用。采纳与源文件写回分开。
- 网页连接当前工作区开发／测试环境，显示连接状态；服务启动为显式动作，沿用既有 owner 和工具权限。
- 沿用统一视觉系统，补全状态、响应式、键盘、中文输入法和实际 Web 验收场景。

## Capabilities

### New Capabilities

- `dsh-editable-prompt-references`：固定内容、自由编辑、来源追溯、显式刷新、多入口插入与目标隔离。
- `dsh-prompt-composer-preview`：紧凑内容块、源码往返、发送预览、兼容协商、提交确认与历史冻结。
- `dsh-creative-artifact-workspace`：工程和媒体成果预览、编辑、标注、候选版本、比较、采纳、再次引用及独立写回。
- `dsh-development-app-preview`：工作区开发测试环境连接、显式启动、运行隔离、状态与恢复。

### Modified Capabilities

无。按项目约定只新增 ADDED requirements。既有 `dsh-conversation-reference-drafts`、`dsh-composer-reference` 与 `creator-studio-artifact-composition` 保留原合同；新模式由显式能力选择启用，不改变 V1 语义，也不作为旧结构化引用失败后的 fallback。兼容矩阵见 design.md。

## Impact

- 插件 owner：引用与选区 UI、Pane Workbench、Creator Studio、现有媒体及结构化内容 renderer、相关 SDK 合同。
- DSH Host owner：唯一 Composer、会话草稿、提交与历史、Pane 几何、主题、运行环境接入。缺失 seam 使用 `upstream-prs` 增量补丁，不创建第二套 Composer 或 core fork。
- 成果／开发环境服务 owner：资源授权、候选版本、采纳与写回、服务状态和启动回执。客户端不复制领域账本，不引入 scheduler 或直接调用 provider。
- 文档阶段已交付规格、设计与任务，用户随后授权代码实施；当前不声称功能已完成。插件协议与宿主实际 Web 分别记录；用户要求的完整产品可用性仍以真实 Web 证据为准。
- 非目标：生产环境预览、外部知识库、跨工作区搜索、自动工具执行、图片图层编辑器、多轨剪辑器、发布部署、第三方内容强制换肤。
