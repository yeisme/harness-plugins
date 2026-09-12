## Why

图像和制作入口此前共用 Creator Studio 全领域导航，独立 Pane 与错误隔离不足。用户要求 DSH + 本地 CLI，允许用户级配置；图像与制作业务仍由各自 owner 保存。

## What Changes

- 保留 creator.visual、creator.production 及恢复键，分别挂载 Eikona、Scaena 页面。
- 增量增加 snapshotOwner 和本地 CLI adapter；保留旧六领域 snapshot。
- 图像复用准备、批准、运行、审阅与原操作查询；制作使用 canonical production、storyboard table、review-package。
- 明确追踪批量、参考导入、区域编辑、声音绑定、交接、合成和正式装配尚未验收的部分。

## Capabilities

### New Capabilities
- `dsh-independent-creator-panes`: 独立领域页面及本地 CLI 接线。

## Impact

split-owner：本仓拥有页面、绑定与安全引用；Eikona 拥有生成与图像资产；Scaena 拥有制作图和交付。用户级配置不包含新凭据副本。不恢复独立 Workbench。
