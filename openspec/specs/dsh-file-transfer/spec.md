# dsh-file-transfer Specification

## Purpose
TBD - created by archiving change dsh-file-resource-mutation-v1. Update Purpose after archive.
## Requirements
### Requirement: Session-bound chunked upload
系统 SHALL 通过 `FileTransferCapabilityV1` 创建 session-bound、可取消、分块的 upload session，且大文件内容 MUST NOT 使用 JSON/base64。

#### Scenario: Upload chunks
- **WHEN** 客户端创建 upload session 并发送多个二进制 chunk
- **THEN** owner 按 offset/digest 写入 workspace 外 staging，返回已接收范围而不把内容投影到 JSON

#### Scenario: Cancel upload
- **WHEN** 用户取消、owner 切换、generation 漂移或 upload 过期
- **THEN** owner 关闭 session、清理 staging，并拒绝后续 chunk/commit

#### Scenario: Import commit
- **WHEN** 所有 chunk 完整且 digest 匹配
- **THEN** transfer capability 只返回 import resource ref，最终写入仍必须经过 mutation preflight/execute

### Requirement: Transfer integrity and quotas
upload session SHALL 验证 chunk offset、总大小、digest、expiry 和 owner fence，并实施 owner 配额。

#### Scenario: Invalid chunk
- **WHEN** chunk 越界、重复范围内容不一致、超过配额或 digest 不匹配
- **THEN** owner typed 拒绝该 chunk，不提交部分文件到 workspace

### Requirement: One-time download ticket
下载 SHALL 使用 owner 签发的短期一次性 ticket，并绑定 session、resource ref、version 和 disposition。

#### Scenario: Successful download
- **WHEN** ticket 未过期、未使用且 session/ref/version 仍匹配
- **THEN** owner 流式返回资源并立即消费 ticket

#### Scenario: Expired or replayed ticket
- **WHEN** ticket 过期或已被使用
- **THEN** owner 非枚举地拒绝下载，不返回资源 metadata 或路径

### Requirement: Download availability is independent from preview
不可预览资源只有在 owner 声明独立 download availability 时 SHALL 可导出。

#### Scenario: Downloadable but not previewable
- **WHEN** inspect 返回 preview unavailable 但 download available
- **THEN** Explorer 禁止打开和引用，同时允许通过一次性 ticket 下载

#### Scenario: No download capability
- **WHEN** owner 未声明 download availability
- **THEN** UI 不显示导出动作，且不得从 preview URL 推导下载地址

### Requirement: Browser request safety
浏览器 transfer 请求 MUST NOT 包含绝对路径、任意 URL、credential 或客户端声明的 workspace authority。

#### Scenario: Malicious transfer request
- **WHEN** 请求包含路径穿越、绝对路径、任意 URL 或不匹配 owner fence
- **THEN** owner 非枚举地拒绝请求并清理关联 staging/ticket

