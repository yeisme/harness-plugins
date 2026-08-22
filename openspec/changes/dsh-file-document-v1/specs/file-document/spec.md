## ADDED Requirements

### Requirement: FileEntry SHALL 是安全投影而非文件句柄
`FileEntryV1` SHALL 包含 id、可选 parentId、name、kind、mediaType、size、summary 与 capabilities。id 与 parentId SHALL 是 opaque id，name SHALL 不含路径分隔符；浏览器 MUST NOT 收到 raw filesystem path、凭据或任意 URL。

#### Scenario: 文件模块收到文件投影
- **WHEN** DSH/domain owner 返回一个文件条目
- **THEN** 条目 SHALL 只包含安全 id/name/元数据
- **AND** 浏览器 SHALL 只能通过 Host 授权 previewUrl 访问内容

### Requirement: FileDocumentPanel SHALL 只渲染投影
`FileDocumentPanel` SHALL 根据 tabId 显示文件或文档树，支持目录展开/折叠、条目选择与打开回调，无 entries 时显示空状态。所有 preview URL SHALL 来自 Host 授权结果；面板 MUST NOT 根据 id/name 拼接路径或 URL。

#### Scenario: 文档 Tab 过滤
- **WHEN** 用户在文档 Tab 且 entries 同时包含 text 与 pdf
- **THEN** 面板 SHALL 显示文档类条目
- **AND** 不得尝试读取文件系统

#### Scenario: 文件树目录展开与选择
- **WHEN** 用户点击目录展开按钮并选择文件
- **THEN** 面板 SHALL 显示子条目并标记 aria-selected
- **AND** 打开回调 SHALL 只接收安全 `FileEntryV1` 投影

### Requirement: 模块 SHALL 通过 Workbench Core 注册
`fileDocumentModule` SHALL 注册 files/documents Tab 与 file.open/document.extract 命令到 `WorkbenchRegistry`，并保持 effect-scoped dispose。

#### Scenario: 注册 File/Document 模块
- **WHEN** Workbench Core 注册 `dsh-file-document` 模块
- **THEN** Registry SHALL 接受并排序其 tabs/commands
- **AND** dispose 后 SHALL 移除该模块贡献

### Requirement: 实现 SHALL 不复制参考 sidebar 项目
`@yeisme/dsh-file-document` SHALL 不 import 参考 sidebar 项目、不复制其源码/CSS/构建产物，不读取其私有 API。

#### Scenario: 源码独立性检查
- **WHEN** 扫描 source/manifest/build output
- **THEN** SHALL 不包含参考项目 import/require/私有 API 调用
