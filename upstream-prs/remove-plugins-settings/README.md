# 移除未完成的插件设置页

用户确认删除设置窗口里的插件页签。该补丁使 `ui-settings-plugins` 浏览器入口不再注册导航、子 tab、卡片与后台副作用；保留包入口和所有导出类型，使既有 profile 继续可加载。插件安装、CLI 查询、host settings 和工具执行能力不变。

基线：`141eb6fef8`（DSH 0.1.0-rc.8）。在独立 staging worktree 开发；本目录为正式交付，不修改插件宿主 DOM，不推送或发布。

应用到需要该改动的 DSH checkout：

```bash
bash upstream-prs/remove-plugins-settings/apply.sh /path/to/deepseek-harness
node upstream-prs/remove-plugins-settings/verify.mjs /path/to/deepseek-harness
```

应用前 `git apply --check` 检查整个补丁，冲突时不部分写入。验证使用该 checkout 的既有 Vitest 配置，证据落在 harness-plugins 的 `temp/integration-test-runs/`。两个回归场景覆盖无服务加载与插件导航/子 tab 不再注册。

回滚：对同一 checkout 运行 `git apply -R` 撤回本补丁；没有配置或数据迁移。公开类型至少保留一个 release，本轮不删除库组件。生效需宿主重新构建并加载；仅构建第三方工具 Pane 不会修改官方设置页。
