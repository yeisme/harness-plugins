# DSH 兼容运行时与 Target 清理

本轮将 `dsh:dev`、`dsh:workbench` 的宿主解析统一到同一 release base 与 staging 产物。全局 `dsh` 由 npm 本地 link 指向同一 CLI，旧安装及 521 个依赖已退出默认执行路径；旧安装保存在用户级 `~/.local/state/dsh/retired-20260907/global-dsh-before-workbench.tgz`，需要时可恢复。未删除 `.dsh`、会话、凭据、草稿或布局数据。日常入口见 [运行指南](../runtime/dsh-workbench.md)。

底部内置 Target 控件及其订阅、按钮和 CSS 已移除；引用折叠摘要不再重复目标。`chooseTarget` 服务与全局按需 Modal、第三方 slot、引用事件和版本检查保持兼容。

## 验证

| 检查 | 结果 | 证据 |
|---|---|---|
| 会话引用、选择和取消 | 41 项通过 | focused ui-conversation tests |
| 宿主 Pane、renderer、侧栏等 | 480 项通过 | `temp/integration-test-runs/unified-host-tests-2026-09-07T04-10-42-386Z/` |
| 视觉回归 | 92 项通过 | `temp/integration-test-runs/ui-visual-2026-09-07T04-10-14-800Z-2120765/` |
| 真实浏览器双栏及无 Target | 4 条检查通过 | `temp/integration-test-runs/workbench-cleanup-2026-09-07T04-13-33-289Z/` |
| 开发入口集成与错误 profile 拒绝 | 通过 | `temp/integration-test-runs/2026-09-07T04-13-36-142Z-2166512/` |
| 干净 release 重放三个补丁、重复应用 cleanup、八文件逐字节一致 | 通过 | `temp/integration-test-runs/workbench-patches-2026-09-07T04-22-23-254Z/` |
| UI surface、plugin contract、focused 类型检查和构建 | 通过 | `check:surfaces`、`check:plugins`、ui-conversation tsc + bundle |

`reference-composer-multi.e2e.ts` 的较大场景在本容器创建终端时遇到 `SandboxUnavailableError`，发生在新增导航断言之前；未将该端到端场景计为通过，未放宽产品 sandbox。失败及未消费录制脚本的次生错误保留在 `temp/integration-test-runs/composer-host-2026-09-07T04-06-33-836Z-2067167/`。本轮 pane/Target 需求由独立真实浏览器检查覆盖，不调用模型或终端。

## Git 存档边界

宿主增量保存于 `upstream-prs/workbench-runtime-cleanup`，而不是把脏 staging 全量提交。技能源位于 Skills 子仓库，目标项目双 runtime 由同步脚本生成；根目录只记录入口规则与子模块指针。本轮提交排除同步期间出现的搜索功能、toolchain 和 credential skill 等其他任务改动；不推送远端。
