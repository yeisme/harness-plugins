# DSH 插件全量热开发

`pnpm dsh:dev` 是本仓库统一的 DSH 插件开发入口。它不会替代官方 `dsh plugin`，而是编排现有 build、profile reconciliation 和 Cordis HMR。

## 默认启动

```bash
pnpm install
pnpm dsh:dev
```

首次启动执行：

1. 扫描 `packages/*/*/package.json`，发现所有声明 `dsh.bundle.patch` 的 bundle。
2. 构建这些 bundle 的 workspace dependency closure。
3. 通过官方命令把 bundle 以本地 link dependency 加入 Web profile。
4. 在 `temp/dsh-dev/web/hmr.patch.yml` 生成只监听运行时产物目录的临时 HMR overlay。
5. 校验 composed config，随后启动 DSH Web。

脚本只 add/reconcile 发现的 bundle，不删除 profile 中其它依赖。

## 开发自己的插件

如果插件位于本仓库 `packages/bundle/`，无需额外参数；新建或修改 manifest 后会自动发现。

仓库外 bundle 使用可重复的 `--plugin`：

```bash
pnpm dsh:dev -- --plugin ../my-dsh-plugin
```

目标目录必须包含合法 `package.json`，且声明：

```json
{
  "dsh": {
    "bundle": {
      "patch": "./cordis.patch.yml"
    }
  }
}
```

外部 bundle 如果声明 `build` script，源码变化时脚本会执行该 script。外部 monorepo 应让 bundle 的 build script 自行构建所需内部 package。

Host 产物刻意 externalize 的 DSH runtime package（例如 Typert protocol）必须同时声明为 peer/dev dependency；本地 `link:` 会从插件真实目录解析这些依赖。

## DSH Web 参数

未被开发脚本消费的参数会传给 DSH Web：

```bash
pnpm dsh:dev -- --no-open --port 8080
pnpm dsh:dev -- --host 127.0.0.1 --port 0
```

使用其它 profile：

```bash
pnpm dsh:dev -- --profile web-dev --no-open
```

自定义 profile 必须已包含官方 DSH base 和 Web app；仅安装业务 bundle 不会自动创建 Web 宿主。准备阶段会检查这一点。完整隔离验收优先保留官方 `web` 模板，只隔离 DSH_HOME：

```bash
DSH_HOME="$PWD/temp/dsh-acceptance-home" pnpm dsh:dev -- --prepare-only
DSH_HOME="$PWD/temp/dsh-acceptance-home" node scripts/run-web-plugin-acceptance.mjs
```

## 热更新规则

| 变化 | 行为 |
| --- | --- |
| `src/`、CSS、运行时代码 | 重建 changed package 与 transitive dependents，pulse runtime artifacts，由 Cordis HMR reload |
| `package.json` | 重新发现 bundle、build、运行官方 profile reconciliation、重启 DSH |
| `cordis.patch.yml` | 重新同步 profile layer 并重启 DSH |
| build 失败 | 保留当前 DSH 和上一版产物；下一次保存重新尝试 |
| DSH 意外退出 | 自动重启，连续 3 次快速失败后暂停，避免 crash loop |

脚本将 build 事件合并成单写队列，避免同一依赖链并发写产物。HMR 只观察 `lib`/`dist`/已声明运行时入口，源码由开发脚本先构建再触发 reload，避免半成品源码抢先重载。

## 检查与准备

只读检查 DSH、pnpm、workspace manifests 和外部插件路径：

```bash
pnpm dsh:dev -- --check
```

构建、安装并校验 profile，但不启动长期 watcher：

```bash
pnpm dsh:dev -- --prepare-only
```

复用当前产物或已安装 profile：

```bash
pnpm dsh:dev -- --skip-build
pnpm dsh:dev -- --skip-install
```

## 验证

```bash
pnpm test:dsh-dev
pnpm test:dsh-dev:integration
pnpm run check:bundles
```

Integration evidence 写入 `temp/integration-test-runs/<run-id>/`，失败也保留 summary、stdout、stderr、环境和 artifacts。

完整门禁按顺序执行，避免 build 清理产物时其他测试正在读取：

```bash
node scripts/run-full-plugin-validation.mjs
```

实机验收启动 loopback Web、检查浏览器异常及可见入口，随后关闭本次启动的进程。每个 bundle 的加载结果和功能未验证状态分别记录；`entry_opened` 不代表领域业务流程完成。该命令不发送模型请求。视觉基线更新仍须先检查变化，再执行 `pnpm run test:visual:update`；普通视觉验证不会自动创建或更新基线。

隔离环境可额外设置 `DSH_ACCEPTANCE_SCAN_PANES=1` 遍历注册视图，或 `DSH_ACCEPTANCE_HMR=1` 检查真实客户端热更新。HMR 检查要求上述隔离 DSH_HOME，临时给示例插件构建产物追加标记，确认浏览器收到后恢复原字节；不要与 build 同时运行。

## 停止与回滚

按 `Ctrl+C` 后脚本会关闭 watcher，并先向 DSH 发送 `SIGTERM`；超时才使用 `SIGKILL`。

停止脚本即可恢复普通启动：

```bash
dsh --profile web
```

需要从 profile 移除某个本地 bundle 时，继续使用官方命令：

```bash
dsh plugin --profile web remove @yeisme/dsh-semantic-file-editor
```
