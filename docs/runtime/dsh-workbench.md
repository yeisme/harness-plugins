# DSH 本地工作台

DSH 开发预览使用 `agent/harness-plugins` 维护的兼容 staging 构建。布局、renderer、侧栏和 conversation 必须来自同一构建；仅版本号相同不代表具有相同补丁。全局旧版启动器与本地新版 pane 混用会导致左右会话跟随同一个 current session、侧栏拖拽入口缺失。

## 日常启动

```bash
cd agent/harness-plugins
pnpm dsh:workbench -- --check
pnpm dsh:workbench -- --no-open --host 127.0.0.1 --port 40869
```

所有本地插件热开发：

```bash
pnpm dsh:dev -- --no-open --host 127.0.0.1 --port 40869
```

两个命令都使用同一 staging CLI。`dsh:dev` 保留外部 bundle、自定义 profile、增量构建与 HMR。`--check` 只读检查基线与产物，不启动、不修改 profile。准备或重建：

```bash
pnpm dsh:workbench -- --rebuild --prepare-only
```

源码位于 `temp/dsh-unified-host-source`；Git 存档的事实源是按顺序应用的 `upstream-prs/unified-multi-pane-workbench`、`composer-multi-reference-v1`、`workbench-runtime-cleanup`。不要整体导出脏 staging；新增修复只导出自有文件增量。不要把临时 checkout 删掉后仍保留指向它的安装链接。

快捷键增量接续应用 `upstream-prs/pane-interaction-completion`；`dsh:workbench` 会检查并准备该补丁。交互与按键说明见 [Pane 风格交互](../design/dsh-pane-interaction-completion.md)。

## 全局入口与旧版清理

本机 `dsh` 可通过 npm 的本地 link 安装指向该 staging CLI，避免从其他项目启动时使用旧版。仅在用户要求安装或清理旧版本时执行；先检查 `command -v dsh`、解析符号链接，并保留旧安装的可恢复副本。真实命令为：

```bash
npm install --global --ignore-scripts --offline --install-links=false ./temp/dsh-unified-host-source/apps/cli
dsh --version
```

不删除 `.dsh`、session、credential、settings、workspace、浏览器 localStorage 或其他项目数据。仅结束已经核实属于旧预览的 PID，不按名称批量杀进程。新进程使用原端口时，浏览器刷新并按启动输出重新认证；token 不进入 Git、文档或证据。

`--rollback` 仅供明确要求恢复 profile 依赖时使用，且只恢复仍指向本轮 staging 的条目；它不启动旧宿主。需要恢复全局安装时用保存的本地副本或明确版本包，不把旧版设为自动失败回退。

## Pane 与引用

Pane 标题就是会话上下文。内置 composer 不显示全局 Target 常驻行；引用列表只显示数量。选择其他引用目标由引用操作按需打开唯一 Modal，取消不改会话。切换活动 Pane 不能替换另一栏内容或草稿；关闭或重排 Pane 不应触发业务发送。

## 验证

```bash
node --test scripts/workbench-runtime.spec.mjs scripts/dsh-dev.spec.mjs
node scripts/test-unified-host.mjs
node scripts/test-workbench-cleanup.mjs
pnpm dsh:workbench -- --check
openspec validate dsh-workbench-runtime-cleanup --strict --no-interactive
```

浏览器回归通过临时环境变量 `DSH_PREVIEW_URL` 接收启动输出的本地授权 URL，不将 URL 写入日志。脚本使用独立浏览器上下文，不发送业务消息；结果保存在 `temp/integration-test-runs/`。应检查真实拖拽、两栏独立、草稿隔离和 Target 数量为零，不能只检查 tab 的标题或 HTML 返回 200。
