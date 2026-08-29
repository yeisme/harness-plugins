# file-preview-formats Specification

(merged from archived change 2026-08-29-dsh-file-preview-formats-v1)

## Purpose

定义 CSV/TSV、文本、DOCX、XLSX/XLSM 等文件的有界、安全、可取消预览，以及未知或不支持格式的诚实降级行为。

## Requirements

### Requirement: CSV/TSV SHALL 有界解析进网格
`@yeisme/dsh-rich-media` SHALL 提供零依赖 RFC4180 解析器，支持引号字段、转义引号、内嵌换行与 CRLF；解析 SHALL 受字节（4MB）、行（20000）、列（256）预算约束，超限 SHALL 截断并置 truncated 标志，SHALL NOT 抛未捕获异常。解析结果 SHALL 经 `createPreviewAccessHandle` 的 `table` 输入进入 `PreviewTableRenderer`。

#### Scenario: 带引号与内嵌换行的 CSV
- **WHEN** 输入含 `"a,b"、"line1\nline2"` 字段
- **THEN** 字段 SHALL 按一个单元格解析
- **AND** 行数与列数 SHALL 正确

#### Scenario: 超行预算截断
- **WHEN** 输入超过 20000 行
- **THEN** 解析 SHALL 在预算处停止
- **AND** 结果 SHALL 带 truncated=true

### Requirement: 文本源码 SHALL 有界窗口预览
渲染器 SHALL 以 2MB fetch 上限取文本，按 64KB 窗口增量渲染并带行号；`application/json` SHALL 尝试 pretty-print，失败 SHALL 回退原文；窗口用尽 SHALL 显示截断提示。fetch SHALL 绑定选区 AbortController，切换 SHALL 中止且不闪错误。

#### Scenario: JSON pretty-print
- **WHEN** 打开 mediaType 为 application/json 的资源且内容可解析
- **THEN** 渲染器 SHALL 显示缩进格式化文本

#### Scenario: 大文本截断
- **WHEN** 内容超过 fetch 上限
- **THEN** SHALL 只显示已加载窗口
- **AND** SHALL 显示截断提示

### Requirement: DOCX SHALL 懒加载并消毒渲染
DOCX 渲染器 SHALL 经懒工厂加载 `mammoth`（首次打开才求值），转换结果 SHALL 经 DOMPurify 消毒后才渲染；文件 SHALL 受 16MB 预算；转换或消毒失败 SHALL 显示 typed unsupported 状态与打开/下载出口，SHALL NOT 渲染未消毒 HTML。

#### Scenario: 首次打开 DOCX
- **WHEN** 用户选择 mediaType 为 OOXML wordprocessingml 的资源
- **THEN** mammoth 懒工厂 SHALL 求值并转换
- **AND** 渲染 SHALL 只包含消毒后节点

#### Scenario: 损坏的 DOCX
- **WHEN** mammoth 转换抛错
- **THEN** SHALL 显示 typed unsupported
- **AND** SHALL 提供打开/下载出口

### Requirement: XLSX/XLSM SHALL 有界多 sheet 网格
Sheet 渲染器 SHALL 经懒工厂加载 `@e965/xlsx`，提供 sheet 列表切换；每个 sheet SHALL 受 10000 行/256 列预算，单元格字符串截断 2000 字符；结果 SHALL 复用 `PreviewTableRenderer` 分页网格；超限 SHALL 显示截断提示。

#### Scenario: 多 sheet 切换
- **WHEN** 工作簿含多个 sheet
- **THEN** SHALL 显示 sheet 切换器
- **AND** 切换后网格 SHALL 展示所选 sheet 的有界行

#### Scenario: 超行预算
- **WHEN** sheet 超过 10000 行
- **THEN** 网格 SHALL 只装载前 10000 行
- **AND** SHALL 显示截断提示

### Requirement: 不支持格式 SHALL 诚实降级
PPTX、legacy Office（DOC/XLS/ODT）及未知二进制 SHALL 显示 typed unsupported 状态与打开/下载出口，SHALL NOT 猜测格式或渲染未验证内容。

#### Scenario: PPTX 降级
- **WHEN** 选择 mediaType 为 OOXML presentationml 的资源
- **THEN** SHALL 显示不支持内嵌预览的明确文案
- **AND** 打开/下载能力存在时 SHALL 提供出口

### Requirement: 重依赖 SHALL 内联懒工厂
`mammoth`、`@e965/xlsx`、`dompurify` SHALL 以 tsdown alwaysBundle 内联进 client 单文件并保持 `import()` 懒工厂；未打开对应格式时 SHALL NOT 求值其代码；`PreviewRendererRegistry` 分发 SHALL 保持 exact MIME 优先的确定性。

#### Scenario: 未打开 Office 文件
- **WHEN** 会话只预览图片与 CSV
- **THEN** mammoth/xlsx 懒工厂 SHALL 未求值

#### Scenario: registry 解析顺序
- **WHEN** 资源 mediaType 精确命中 descriptor 且 family 亦有回退候选
- **THEN** exact MIME descriptor SHALL 胜出

### Requirement: 生产映射 SHALL 覆盖新格式
`dsh-desktop-workbench` 的文件到媒体映射 SHALL 覆盖 csv/tsv→document+对应 MIME、docx/xlsx/xlsm→document+OOXML MIME、pptx/legacy→document（降级路径）；文本类扩展名（txt/md/json/log/yaml/xml 等）SHALL 保留既有 desktop.file 视图路径（不进媒体 pane）；既有 image/audio/video/pdf 映射 SHALL 不变。

#### Scenario: CSV 文件进入媒体列表
- **WHEN** FileEntry 名为 data.csv 且无 mediaType
- **THEN** 映射 SHALL 产出 kind=document、mediaType=text/csv

#### Scenario: 文本文件保持既有视图
- **WHEN** FileEntry 名为 README.md
- **THEN** 映射 SHALL 不产出媒体投影且文件 SHALL 走 desktop.file 内容视图

#### Scenario: XLSX 文件映射
- **WHEN** FileEntry 名为 report.xlsx
- **THEN** 映射 SHALL 产出 OOXML spreadsheetml MIME 并进入网格预览路径
