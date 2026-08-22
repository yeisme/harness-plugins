## Context

`@yeisme/dsh-workbench-core` 已提供模块注册与 React shell。File/Document 作为第二个模块，用于验证 Core 的可扩展性，并给 DSH 用户一个文件/文档预览入口。

当前实现不连接真实文件系统；它只消费安全的 `FileEntryV1` 投影。这样可以把展示层与 DSH fs/domain owner 解耦。

## Goals / Non-Goals

**Goals:**

- 提供安全 `FileEntryV1` 合同。
- 提供可渲染文件/文档列表与预览的面板。
- 通过 Workbench Core 注册模块。
- 为真实 fs/文档 seam 留下 typed 接口。

**Non-Goals:**

- 不实现文件树、watcher、目录遍历。
- 不实现 PDF.js、Office 转换、文本提取。
- 不拥有文件系统 canonical state。
- 不复制 DSH-better-sidebar 源码。

## Decisions

### 1. FileEntryV1 是安全投影

`FileEntryV1.id` 是 opaque id，`name` 只含显示名，禁止路径分隔符。浏览器不得收到 raw filesystem path。

### 2. Panel 只渲染投影

`FileDocumentPanel` 接收 entries 数组和可选 `resolvePreviewUrl`；没有 entries 时显示空状态。预览 URL 必须由 Host/owner 提供。

### 3. 模块注册进 Workbench Core

`fileDocumentModule` 注册 files/documents 两个 Tab，后续 Workbench Core 宿主出现后即可直接使用。

## Test Specification

| 层 | 场景 | 命令 | 证据 |
| --- | --- | --- | --- |
| unit | FileEntry valid/invalid、raw path 拒绝 | `pnpm --filter @yeisme/dsh-file-document run test` | Vitest result |
| unit | Panel 文件/文档过滤与空状态 | `pnpm --filter @yeisme/dsh-file-document run test` | Vitest result |
| integration | 模块注册进 Workbench Core | `pnpm --filter @yeisme/dsh-file-document run test` | Vitest result |
| build | typecheck/build | `pnpm --filter @yeisme/dsh-file-document run typecheck && pnpm --filter @yeisme/dsh-file-document run build` | exit 0 |

## Risks / Trade-offs

- [过早预览实现] → 预览仅占位，真实 PDF/Office 渲染后续单独评审。
- [与 fs owner 边界不清] → 明确 FileEntry 是投影，mutation 归 owner。

## Migration Plan

1. 发布 `@yeisme/dsh-file-document@0.1.0-rc.1`。
2. 后续 DSH fs seam 提供 entries 后，Panel 直接消费。
3. 真实文档解析按 owner readiness 接入。

Rollback：移除模块或回退到占位；无数据迁移。

## Open Questions

- 文件树是 Workbench Tab 还是独立 Pane？
- PDF 预览采用 PDF.js、iframe sandbox 还是仅下载？
