## Why

Workbench Core 需要第二个模块验证可扩展性。File/Document 是 DSH 工作台最常用的模块之一：文件树、文档预览、PDF/Office/文本提取。当前 `@yeisme/dsh-file-document` 已是骨架；需要把 `FileEntryV1` 安全投影、文件/文档面板与 Workbench Core 接入正式化，为后续真实 DSH fs/文档 owner seam 留出契约。

准入结论为 `fit + split-owner`：Harness Plugins 拥有 File/Document 展示壳、`FileEntryV1` 合同与面板；文件树、watcher、文档解析、权限与 canonical state 归 DSH/领域 owner。

## What Changes

- 新增 `FileEntryV1` 安全投影合同：id、name、kind、mediaType、size、summary、capabilities；禁止 raw path、凭据、无界文本。
- 新增 `FileDocumentPanel`：文件列表/文档列表、空状态、图片/PDF/文本预览占位。
- 将 `fileDocumentModule` 接入 Workbench Core 注册。
- 为后续真实文件树、watcher、文档提取保留 typed seam。

## Required Capability Ledger

| 能力 | 状态 | canonical owner | 本切片 | 验收证据 |
| --- | --- | --- | --- | --- |
| FileEntry 合同 | required | Harness Plugins | deliver-now | validation tests |
| File/Document Panel | required | Harness Plugins | deliver-now | render tests |
| Workbench Core 接入 | required | Harness Plugins | deliver-now | module registry test |
| 真实 fs/文档 seam | required | DSH/domain owner | retain-next | owner OpenSpec |

## Capabilities

### New Capabilities

- `file-document-entry`: FileEntryV1 安全投影与校验。
- `file-document-panel`: 文件/文档列表与预览面板。
- `file-document-workbench-module`: Workbench Core 模块描述符。

### Modified Capabilities

无。

## Impact

- 新 owner package：`packages/bundle/dsh-file-document/`。
- 依赖：`@yeisme/dsh-workbench-core`、React；不依赖 DSH-better-sidebar。
- 后续：真实 fs/文档 owner 通过 typed seam 提供 entries。
