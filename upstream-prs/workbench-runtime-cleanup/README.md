# 工作台启动与 Target 清理

本补丁接在 `unified-multi-pane-workbench` 和 `composer-multi-reference-v1` 后，移除每个会话输入区的全局 Target 控件及其样式。引用目标 Modal、事件、目标版本校验与第三方 slot 保留；引用折叠摘要只显示数量。

```bash
bash upstream-prs/workbench-runtime-cleanup/apply.sh /path/to/staging-checkout
pnpm dsh:workbench -- --rebuild --prepare-only
pnpm dsh:workbench -- --check
```

更改仅包含本轮八个文件的增量（含 owning Agent Note），避免把 staging 中其他未提交功能打包。开发默认入口与回退边界见 [操作指南](../../docs/runtime/dsh-workbench.md)。

补丁使用零上下文格式，避免将 diff 的空白上下文行作为仓库尾随空格保存；必须通过 `apply.sh` 的 `--unidiff-zero` 校验与应用，不能省略先行补丁。

重新导出需在编辑前保留这八个文件的基线副本，再运行 `node scripts/export-workbench-cleanup-patch.mjs <pre-change-source-directory>`；不使用 staging 全量 diff。
