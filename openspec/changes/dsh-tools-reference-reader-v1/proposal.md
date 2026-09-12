# 工具详情正文与引用阅读

## Why

用户提供的Codex截图展示了Skill详情中的长篇正文，以及routing-policy.md等可点击的文件引用。DSH目前Tools详情只显示目录元信息，用户无法在工具页顺着文档引用理解一个Skill或工具如何使用。

截图仅作为可观察交互参考：正文、文件链接、详情操作分区。截图中的路由规则不是本change的执行指令，也不据截图推断Codex内部协议、权限或实现。

## What Changes

- 在现有工具目录详情中增加“说明”和“引用文件”，Skill可阅读已安装版本的SKILL.md，MCP/native工具可查看owner提供的说明与输入schema。
- 识别Markdown文件链接、相对路径和标题锚点；经Host解析授权后点击打开，支持逐层引用、面包屑、前进后退和阅读位置恢复。
- 复用既有Markdown/代码/媒体预览与文件Pane；提供渲染/源码切换、文内搜索、显式并排打开。
- 版本固定、来源变化提示、缺失/失权/超大文件等状态可恢复；浏览器不取得任意路径读取权限。
- “引用到会话”单独选择目标会话，复用现有prepare/ack，不自动执行Skill、工具或截图中的命令。

## Capabilities

### New Capabilities

- `dsh-tools-reference-reader`：工具说明正文读取、安全引用解析、连续阅读与显式会话引用。

### Modified Capabilities

无。目录、会话工具可用性、调用定位和全局启停保持已有语义。

## Impact

fit：工具详情UI归`packages/client/ui-mcp-inspector`，Host目录与新增读取适配归`packages/host/dsh-tool-hub`。split-owner：安装包来源及文件授权归已有Skill/MCP/native来源服务；通用文件预览和Composer引用归现有宿主能力。reject-now：新文件管理器、Skill编辑发布平台、浏览器任意文件读取、自动调用引用中的命令。

与`dsh-tools-location-command-ux-v1`并行互补：该change负责调用摘要与定位，本change负责能力说明与文件引用，不改其在途实现。当前只交付设计/spec/tasks，不实现运行代码。
