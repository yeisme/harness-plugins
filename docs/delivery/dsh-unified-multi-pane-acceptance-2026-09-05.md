# DSH 完整多 Pane 工作台本机交付

主 `web` profile 已运行兼容宿主，32 个本地 bundle 全量加载，23 个注册工具视图逐一打开且内容非空。21 条真实浏览器动作链与九项插件门禁通过。领域生成、审批和真实模型发送未执行，不把页面打开计作这些业务能力通过。

## 使用

当前兼容入口：[本机工作台](http://127.0.0.1:61818/)。原 61817 入口和全局 DSH 安装保留。若浏览器没有该端口的登录状态，使用启动命令输出的本地授权链接；验收日志与本文不保存授权 token。

```bash
cd /workspaces/yeisme-agent/agent/harness-plugins
pnpm dsh:workbench -- --host 127.0.0.1 --port 61818 --no-open
```

- 从左侧历史会话拖到标签栏可合组；拖到四边可分屏；拖到工作区中间可悬浮。
- 标签单击定位，双击／固定／拖入成为保留 Pane；未固定的对话标签可供下一次单击预览复用。
- 悬浮组标题栏空白处移动整组，边角调整尺寸；拖回标签栏或停靠区可重新停靠。
- 各组右侧按钮最大化／还原。右上“布局”切换布局所属项目、保存命名预设、导入旧布局或恢复默认。
- 轨迹与 Chat 位于同一个 session Pane 内；每个会话独立选择 Chat／Trajectory，移动与刷新保持绑定。
- 所有工具统一从左下“添加面板”进入；目录也包含原有命令。主对话不再被旧 overlay 覆盖。

浏览器存储按 origin 隔离。旧端口保存的布局原样保留；新端口不会读取或搬迁另一 origin 的记录。在同一 origin 升级时，旧格式可通过“布局”显式导入，归属不明的记录不会自动混入项目。

## 验证

| 检查 | 结果 | 证据 |
|---|---|---|
| 插件九项门禁 | 全部通过 | [summary](../../temp/integration-test-runs/full-plugins-2026-09-05T13-02-06-319Z-2792494/summary.json) |
| 最后兼容修复复核 | Desktop 包 typecheck、33 项测试、build；bundle／surface／plugin 三门通过 | [复核](../../temp/integration-test-runs/full-plugins-2026-09-05T13-34-26-838Z-3728958/summary.json)、[包验证](../../temp/integration-test-runs/full-plugins-2026-09-05T13-34-26-838Z-3728958/artifacts/desktop-focused.log) |
| 宿主布局、会话 scope、预设与侧栏测试 | 473 项通过 | [日志](../../temp/integration-test-runs/unified-host-tests-2026-09-05T13-24-52-973Z/stdout.log) |
| 真实鼠标／触控／键盘动作链 | 21 项通过 | [断言与结果](../../temp/integration-test-runs/unified-workbench-2026-09-05T13-34-24-814Z/summary.json)、[真实指针事件](../../temp/integration-test-runs/unified-workbench-2026-09-05T13-34-24-814Z/artifacts/pointer-events.json) |
| 主 web profile | 32 bundle、23 视图；无浏览器运行异常 | [逐项结果](../../temp/integration-test-runs/unified-main-2026-09-05T13-34-26-020Z/summary.json) |
| 官方依赖替换与回退 | 原版本恢复、其他依赖保留 | [独立 profile 证据](../../temp/integration-test-runs/workbench-launcher-2026-09-05T13-11-41-480Z/summary.json) |

完整动作链覆盖跨项目对话、独立原生草稿与 DOM 身份、四边分屏、排序和跨组移动、单 Pane／整组悬浮与重新停靠、调整尺寸、预览固定、已打开会话去重、预设刷新、项目切换、最大化、Escape／失焦／越界／空间不足取消、缺失插件与不可访问会话的长标题占位、360／560／960px、200% 缩放、减少动效、键盘焦点和 HMR。主 profile 截图隐藏了业务正文，完整交互截图使用隔离测试会话。

## 前后截图

- [旧 overlay 拖拽前](../../temp/integration-test-runs/web-plugins-2026-09-05T09-24-39-213Z-1074180/artifacts/drag-before.png)；[拖拽后仍未移动](../../temp/integration-test-runs/web-plugins-2026-09-05T09-24-39-213Z-1074180/artifacts/drag-after.png)。
- [两个原生会话与悬浮 Pane](../../temp/integration-test-runs/unified-workbench-2026-09-05T13-34-24-814Z/artifacts/two-sessions-floating.png)。
- [轨迹与其 session 对话同 Pane](../../temp/integration-test-runs/unified-workbench-2026-09-05T13-34-24-814Z/artifacts/session-trajectory-together.png)。
- [整组重新停靠](../../temp/integration-test-runs/unified-workbench-2026-09-05T13-34-24-814Z/artifacts/group-redocked.png)。
- [主 web，正文已隐藏](../../temp/integration-test-runs/unified-main-2026-09-05T13-34-26-020Z/artifacts/main-profile-redacted.png)。

## 32 个 bundle

| Bundle | 实际加载 | 组合／构建 |
|---|---|---|
| `@yeisme/dsh-ai-drama-director` | 主 web 加载通过 | bundle 合同／组合验证通过 |
| `@yeisme/dsh-anchored-standard` | 主 web 加载通过 | bundle 合同／组合验证通过 |
| `@yeisme/dsh-browser-pane` | 主 web 加载通过 | bundle 合同／组合验证通过 |
| `@yeisme/dsh-command-experience` | 主 web 加载通过 | bundle 合同／组合验证通过 |
| `@yeisme/dsh-conversation-rewrite` | 主 web 加载通过 | bundle 合同／组合验证通过 |
| `@yeisme/dsh-creator-studio` | 主 web 加载通过 | bundle 合同／组合验证通过 |
| `@yeisme/dsh-desktop-workbench` | 主 web 加载通过 | bundle 合同／组合验证通过 |
| `@yeisme/dsh-devtools` | 主 web 加载通过 | bundle 合同／组合验证通过 |
| `@yeisme/dsh-file-document` | 主 web 加载通过 | bundle 合同／组合验证通过 |
| `@yeisme/dsh-interaction-space` | 主 web 加载通过 | bundle 合同／组合验证通过 |
| `@yeisme/dsh-mcp-inspector` | 主 web 加载通过 | bundle 合同／组合验证通过 |
| `@yeisme/dsh-mermaid-render` | 主 web 加载通过 | bundle 合同／组合验证通过 |
| `@yeisme/dsh-next-step-suggestions` | 主 web 加载通过 | bundle 合同／组合验证通过 |
| `@yeisme/dsh-ordo-agent-ops` | 主 web 加载通过 | bundle 合同／组合验证通过 |
| `@yeisme/dsh-pane-agent-context` | 主 web 加载通过 | bundle 合同／组合验证通过 |
| `@yeisme/dsh-pane-domain` | 主 web 加载通过 | bundle 合同／组合验证通过 |
| `@yeisme/dsh-pane-subagent` | 主 web 加载通过 | bundle 合同／组合验证通过 |
| `@yeisme/dsh-pane-workbench` | 主 web 加载通过 | bundle 合同／组合验证通过 |
| `@yeisme/dsh-personal-coding-base` | 主 web 加载通过 | bundle 合同／组合验证通过 |
| `@yeisme/dsh-personal-radar` | 主 web 加载通过 | bundle 合同／组合验证通过 |
| `@yeisme/dsh-plugin-example` | 主 web 加载通过 | bundle 合同／组合验证通过 |
| `@yeisme/dsh-rich-media` | 主 web 加载通过 | bundle 合同／组合验证通过 |
| `@yeisme/dsh-selection-annotation` | 主 web 加载通过 | bundle 合同／组合验证通过 |
| `@yeisme/dsh-semantic-file-editor` | 主 web 加载通过 | bundle 合同／组合验证通过 |
| `@yeisme/dsh-session-cookie-manager` | 主 web 加载通过 | bundle 合同／组合验证通过 |
| `@yeisme/dsh-session-tags` | 主 web 加载通过 | bundle 合同／组合验证通过 |
| `@yeisme/dsh-side-chat` | 主 web 加载通过 | bundle 合同／组合验证通过 |
| `@yeisme/dsh-terminal` | 主 web 加载通过 | bundle 合同／组合验证通过 |
| `@yeisme/dsh-token-usage` | 主 web 加载通过 | bundle 合同／组合验证通过 |
| `@yeisme/dsh-workbench-compose` | 主 web 加载通过 | bundle 合同／组合验证通过 |
| `@yeisme/dsh-workbench-core` | 主 web 加载通过 | bundle 合同／组合验证通过 |
| `@yeisme/dsh-yeisme-commands` | 主 web 加载通过 | bundle 合同／组合验证通过 |

非 UI 包及组合包通过完整 profile 加载与 bundle 门验证，不虚构它们拥有独立面板。

## 注册工具视图

| 视图 | View kind | 入口与关闭 | 业务能力 |
|---|---|---|---|
| Explorer | `dsh.explorer` | 已打开、非空 | 渲染通过；业务动作未执行 |
| Source Control | `dsh.source-control` | 已打开、非空 | 显示不可用原因；业务能力未通过验收 |
| Workspace Capabilities | `dsh.workspace-capabilities` | 已打开、非空 | 显示不可用原因；业务能力未通过验收 |
| Agents | `subagent.monitor` | 已打开、非空 | 渲染通过；业务动作未执行 |
| Tools | `mcp-inspector` | 已打开、非空 | 渲染通过；业务动作未执行 |
| 文件内容 | `desktop.file` | 已打开、非空 | 显示不可用原因；业务能力未通过验收 |
| 文档 | `desktop.documents` | 已打开、非空 | 渲染通过；业务动作未执行 |
| Git | `desktop.git` | 已打开、非空 | 渲染通过；业务动作未执行 |
| 媒体 | `desktop.media` | 已打开、非空 | 渲染通过；业务动作未执行 |
| 对话管理 | `desktop.sessions` | 已打开、非空 | 显示不可用原因；业务能力未通过验收 |
| Home | `creator.home` | 已打开、非空 | 渲染通过；业务动作未执行 |
| Text | `creator.text` | 已打开、非空 | 显示不可用原因；业务能力未通过验收 |
| Visual | `creator.visual` | 已打开、非空 | 显示不可用原因；业务能力未通过验收 |
| Audio | `creator.audio` | 已打开、非空 | 显示不可用原因；业务能力未通过验收 |
| Production | `creator.production` | 已打开、非空 | 显示不可用原因；业务能力未通过验收 |
| Context | `creator.context` | 已打开、非空 | 显示不可用原因；业务能力未通过验收 |
| Media & assets | `creator.assets` | 已打开、非空 | 显示不可用原因；业务能力未通过验收 |
| Analysis | `creator.analysis` | 已打开、非空 | 显示不可用原因；业务能力未通过验收 |
| Generation | `creator.generation` | 已打开、非空 | 渲染通过；业务动作未执行 |
| Approvals | `creator.approvals` | 已打开、非空 | 渲染通过；业务动作未执行 |
| Approvals (legacy) | `creator.review` | 已打开、非空 | 渲染通过；业务动作未执行 |
| Generation (legacy) | `creator.jobs` | 已打开、非空 | 渲染通过；业务动作未执行 |
| Creator artifact | `creator.media` | 已打开、非空 | 渲染通过；业务动作未执行 |

选区批注、Side Chat、Terminal、Token Usage 等嵌入／上下文入口延续原插件合同，其组件／协议／视觉检查包含在门禁中。它们没有全部具备独立目录视图，不将目录数量等同于插件数量。Terminal 的 shell 执行、Side Chat 的模型发送及外部 owner 的真实生成／审批未执行。隔离会话的部分文件 API 曾返回 403，已记录为未验收能力；主 profile 本次目录遍历没有 HTTP 拒绝。

## 兼容与回退

宿主补丁基于 `dsh-v0.1.2-rc.1`／`a66e4702047846cdaa10c66c9d3df3951f5ea70d`，维护于 [upstream-prs](../../upstream-prs/unified-multi-pane-workbench/README.md)。补丁已在另一份干净 release checkout 应用并构建 host/client；安装目录没有修改。

启动器发现主 profile 中 5 个显式官方包依赖覆盖内置源，使用官方 plugin CLI 指向 staging 包；原规格保存在用户 profile 的 `unified-host-rollback.json`。可回退：

```bash
cd /workspaces/yeisme-agent/agent/harness-plugins
pnpm dsh:workbench -- --rollback
dsh web
```

先结束自己启动的兼容宿主，再运行回退命令。回退只恢复仍指向本轮 staging 的依赖；用户后续修改的依赖不会被覆盖。会话、消息、项目归属与原布局记录不删除。切换 origin 时不会自动迁移浏览器私有存储。

## 重跑

```bash
node scripts/run-full-plugin-validation.mjs
node scripts/test-unified-host.mjs
node scripts/test-unified-workbench.mjs
node scripts/test-unified-main-profile.mjs
node scripts/test-dsh-workbench-launcher.mjs
```

浏览器重跑读取各自本地启动日志中的临时授权 URL；隔离动作测试只使用隔离 profile 与离线测试会话。未 commit、push、发布或执行付费业务动作。
