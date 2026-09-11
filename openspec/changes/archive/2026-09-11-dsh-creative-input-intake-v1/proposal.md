## Why

创作输入宿主合同支撑无产品 CLI 的创作输入。

## What Changes

CreatorInputIntake 复用现有 creator-studio host 和 Remote；owner adapter 从 MCP 发现结果映射控制动作。文件选择、打开页面通过显式 host seam 注入，缺少 seam 返回 unavailable。链接和文件句柄只在 host 内存，Remote 只返回安全请求、进度和引用。没有新增 DSH 主壳或资产服务。

## Capabilities

### New Capabilities
- `creative-input-intake-host`: 创作输入宿主合同

### Modified Capabilities

## Impact

增量本地实现；新入口保持显式启用，旧合同保留，发布与部署独立。
