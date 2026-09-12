# 工具页正文调宽隔离

在 session-tools-workspace 之后应用。只改变 ConversationRoot 的工具内容布局：隐藏正文专用调宽手柄和命中区域，工具 slot 使用全部宽度。返回对话保留宽度偏好，外层工作台 splitter 不受影响。

```bash
bash upstream-prs/tools-pane-layout-v1/apply.sh temp/dsh-unified-host-source
node scripts/test-tools-pane-layout.mjs
```

补丁仅含本次CSS增量，不包含脏 staging 的其他源码。apply 前检查基线并支持幂等；冲突时保持原文件并退出。回滚只反向应用本 packet，再重建客户端，不重置会话和配置。

浏览器布局门使用真实 Chromium 和 canonical Host CSS，但 slot 内容是明确 fixture；真实 Host 的会话/草稿操作另行验收。
