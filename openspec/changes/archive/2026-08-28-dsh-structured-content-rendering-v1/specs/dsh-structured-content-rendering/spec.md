## ADDED Requirements

### Requirement: Mermaid 与表格 SHALL 共用内容层级

系统 SHALL 使用同一 React 内容壳表达 inline/pane、工具区、主内容和可见状态，但 Mermaid、Markdown table 与 data table MUST 保留各自语义和安全边界。

#### Scenario: Inline 与 Pane
- **WHEN** 同一结构化内容出现在聊天和 Pane
- **THEN** 聊天 SHALL 优先快速阅读，Pane SHALL 提供深度工具
- **AND** 无稳定 ref 时聊天 SHALL 不显示无效 Pane action

### Requirement: Mermaid SHALL 在窄视口保持可读

Mermaid renderer SHALL 提供键盘与指针可操作的缩放、平移和重置。渲染失败 SHALL 保留源码与错误，MUST NOT 白屏或隐藏错误。

#### Scenario: 非法 Mermaid
- **WHEN** Mermaid render 或 sanitize 失败
- **THEN** 原代码块 SHALL 可见
- **AND** 错误状态 SHALL 以文本和 alert 语义呈现

### Requirement: Markdown table SHALL 复用 DSH GFM 安全策略

文件 Markdown SHALL 使用 DSH `MarkdownText`。聊天与文件中的 semantic table MAY 被增量装饰，但装饰器 MUST NOT 重新执行 raw HTML 或替换 canonical Markdown source。

#### Scenario: 宽 Markdown table
- **WHEN** table 宽于当前聊天或 Pane
- **THEN** table SHALL 在可聚焦区域横向滚动并保留表头
- **AND** 卸载装饰器后宿主 DOM SHALL 完整恢复

### Requirement: CSV/TSV SHALL 使用 owner schema 和有界 rows

CSV/TSV renderer SHALL 消费 owner-provided columns、page/query result 与 loaded/total，并使用虚拟化保持 DOM 有界。公式 SHALL 作为纯文本。

#### Scenario: Partial rows 无全局查询
- **WHEN** 只加载部分 rows 且 owner 不支持 global sort/filter
- **THEN** 全局操作 SHALL disabled 并说明范围
- **AND** 系统 MUST NOT 只处理可见 rows 却声称处理了完整数据

### Requirement: 兼容演进 SHALL additive

新实现 SHALL 保留现有 Mermaid 导出、bundle、kill-switch、`PreviewTablePageV1` 与 `readTablePage()`；新增字段、方法和 props SHALL optional 或位于新 package。

#### Scenario: 旧消费者升级
- **WHEN** 现有消费者只调用 `hydrateMermaidFences()` 或 `readTablePage()`
- **THEN** 升级后 SHALL 继续编译和运行
- **AND** 新 React 壳、table schema 与 query surface SHALL 不成为必填依赖
