# Composer multi-reference V1

此补丁为 DeepSeek Harness 增加显式主对话目标、目标切换、原子引用 chip、owner 重校验、持久化引用标签与模型上下文。`@` 菜单按来源列出文件、目录、选区、历史消息、终端、图像、Agent、skill 与 tool；选择 Agent、skill 或 tool 只附加上下文，不会自动执行 tool 或启动 Agent。“引用并询问”只在插入成功后激活目标并聚焦输入框，不会自动发送。

补丁以 `a66e4702047846cdaa10c66c9d3df3951f5ea70d` 为发布基线，并依赖同目录层级的 `../unified-multi-pane-workbench/` 先行补丁。引用补丁只记录该先行补丁之后的功能增量与三文件窄屏响应式修复，不复制其 `Workbench` 新文件，也不混入 staging 工作区中的其他并行修改。普通 `@path`、`@session` 与 `/skill` 行为保持兼容。

在干净的对应 DeepSeek Harness checkout 中依次运行：

```sh
bash ../unified-multi-pane-workbench/apply.sh /path/to/staging-checkout
bash ./apply.sh /path/to/staging-checkout
```

`apply.sh` 会校验 release base、先行补丁的 tracked hunks 与新增文件，再执行 `git apply --check changes.patch`。基线、补丁摘要与验证命令见 `BASELINE.md`，精确 Host owned 路径见 `host-files.txt`。
