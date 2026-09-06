# DSH 全插件 UI 与本机验收

本机 `web` profile 已启用全部 32 个本地 bundle，并通过真实浏览器启动与主要入口检查。隔离环境遍历了 23 个注册视图，没有浏览器异常或 HTTP 错误。领域生成、审批与外部 owner 的真实业务流程仍为部分覆盖，不以入口打开代替业务验收。

## 已落地的修复

- 重建全部 bundle，消除用户截图中的 Creator Studio runtime 模块加载错误；新增执行真实客户端 factory 的回归测试。
- Creator Studio 支持 Pane 服务晚到、撤销和替换，避免启动顺序造成永久禁用；过期异步挂载会被丢弃。
- 共享 Surface 统一字号、宿主字体继承和输入框样式，补齐触控与间距变量；选区批注统一分区、控件、焦点与窄屏布局。
- 示例插件默认不占据 overlay，显式打开后使用官方 Modal 与共享 Surface，不再拦截“添加工作区”。
- Agents 没有当前会话时明确禁用并说明原因，会话变化后刷新入口。
- 对话管理对受保护 Remote Proxy 的命名空间读取安全降级，不绕过 injection 权限，不产生未处理异常。
- 自定义 profile 缺少官方 Web app 时准备命令明确失败，避免配置能合成却无法启动。

## 验证证据

| 验证 | 结果 | 证据 |
|---|---|---|
| 全仓 typecheck、test、build、bundle、surface、visual、plugin、开发脚本单测与集成检查 | 九项通过 | [完整门禁](../../temp/integration-test-runs/full-plugins-2026-09-05T07-37-24-837Z/summary.json) |
| 视觉回归 | 35 项通过，含真实批注中英文、360/560/960px、焦点、宿主 token 与触控尺寸 | [视觉日志](../../temp/integration-test-runs/full-plugins-2026-09-05T07-37-24-837Z/artifacts/test-visual.log) |
| 最后补充的 Remote namespace 修复 | session-tags 57 项测试与包 typecheck 通过，重建相关 bundle；bundle/surface/plugin 门重新通过 | [补充门禁](../../temp/integration-test-runs/full-plugins-2026-09-05T07-59-19-847Z/summary.json) |
| 隔离 Web，全量注册视图遍历 | 32 bundle 在 profile 中，23 个视图可打开，零 page error／HTTP error | [逐项清单](../../temp/integration-test-runs/web-plugins-2026-09-05T07-51-51-671Z-1550602/artifacts/report.md) |
| 本机日常 web profile | 启动通过；Agents、创作、对话、文件、Git 均有可见打开结果 | [本机清单](../../temp/integration-test-runs/web-plugins-2026-09-05T08-02-20-309Z-2031004/artifacts/report.md) |
| 真实 Web HMR | 修改客户端构建产物后，浏览器收到带标记的新产物且无加载错误；随后恢复原产物 | [HMR 证据](../../temp/integration-test-runs/web-plugins-2026-09-05T08-10-07-872Z-2388339/summary.json) |
| OpenSpec 与工作树空白检查 | strict validation、git diff --check 通过 | `dsh-full-plugin-ui-acceptance` |

视觉基线在检查布局差异后更新；普通视觉验证不会自动创建或更新基线。共享 Surface 夹具与真实批注组件测试分开，夹具截图不冒充所有领域插件的业务验收。

## 前后截图

- [用户提供的启动错误截图](../../temp/integration-test-runs/web-plugins-2026-09-05T08-02-20-309Z-2031004/artifacts/before.png)
- [本机修复后启动](../../temp/integration-test-runs/web-plugins-2026-09-05T08-02-20-309Z-2031004/artifacts/web.png)
- [本机 Creator Studio](../../temp/integration-test-runs/web-plugins-2026-09-05T08-02-20-309Z-2031004/artifacts/surface-3.png)
- [真实中文窄屏批注组件](../../tests/ui-visual/__screenshots__/selection-zh-360.png)

## 本机历史会话修复

最终启动检查还发现一个既有会话日志的压缩封装不符合当前官方读取器要求。只读扫描共检查 208 个日志，定位到一个文件；其 JSON 内容完整，但首个 Zstandard frame 同时包含 header 与事件。

修复前确认没有文件占用、校验原文件摘要并完整备份，再原子替换压缩分帧。24 条事件全部保留，解压内容逐字节相同，官方读取器验证通过。本机随后成功启动。

原始文件备份与 receipt 位于用户级 `.dsh/repair-backups/session-framing-1788595110602/`；未删除或重写会话正文。临时修复工具不作为插件公共功能发布。

## 使用与剩余边界

本机启动：

```bash
dsh web
```

继续全插件热开发：

```bash
cd /workspaces/yeisme-agent/agent/harness-plugins
pnpm dsh:dev
```

重复正式检查与隔离视图遍历：

```bash
node scripts/run-full-plugin-validation.mjs
DSH_HOME="$PWD/temp/dsh-acceptance-home" pnpm dsh:dev -- --prepare-only
DSH_HOME="$PWD/temp/dsh-acceptance-home" DSH_ACCEPTANCE_SCAN_PANES=1 node scripts/run-web-plugin-acceptance.mjs
DSH_HOME="$PWD/temp/dsh-acceptance-home" DSH_ACCEPTANCE_HMR=1 node scripts/run-web-plugin-acceptance.mjs
```

测试进程结束后会关闭自己启动的 Web 实例；profile 配置与插件启用状态保留。现有其他依赖和未提交代码保留，未 commit、push、发布或部署。

未连接的创作 owner、缺失的冻结 tenant/workspace 上下文、部分宿主合同，以及没有当前会话的 Agent 场景继续显示真实限制。本轮未调用付费生成、未发送模型请求、未执行真实外部审批或业务写入，因此不宣称所有领域功能已完成端到端验收。
