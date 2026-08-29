## Context

官方 `dsh plugin --profile <name> add <path>` 已能把 link dependency 纳入 profile layer，Web profile 也内置 Cordis HMR，但当前 HMR root 不覆盖本仓库，且本地 TypeScript package 的 runtime 入口依赖 build 产物。仅添加 symlink 或仅监听 `src/` 都不能形成稳定热更新闭环。

仓库包含 host、client、bundle 与共享依赖。一个 host/client package 改动可能被多个 bundle 内联，因此 watcher 必须重建其 transitive dependents，而不是只 build 发生变化的目录。

## Goals / Non-Goals

**Goals:**

- 一条命令发现、构建、安装并启动全部本地 DSH bundle。
- 支持重复 `--plugin <path>` 加载仓库外自研 bundle。
- 源码变化只重建受影响 package 与 dependents；成功后触发 Cordis HMR。
- manifest/patch/bundle 集合变化自动重新同步 profile 并重启 DSH。
- Ctrl+C、build 失败、DSH 退出与重复变更均有可预测生命周期。

**Non-Goals:**

- 不修改或 fork 官方 DSH/HMR。
- 不删除 profile 中用户已有的非本仓库依赖。
- 不承诺跨进程状态无损；需要 profile 重组时明确重启。
- 不把用户 profile、绝对路径或测试 evidence 提交进仓库。

## Decisions

### 1. 以官方 `dsh plugin` 作为唯一 profile writer

脚本发现 bundle 后调用 `dsh plugin --profile <profile> add link:<absolute-dir>`。官方命令负责初始化 profile、写 dependency 与 reconcile `dsh.profile.bundles`。脚本不直接编辑用户 `package.json`。

备选：直接生成 profile manifest。拒绝，因为会复制官方 reconciliation 规则并覆盖用户状态。

### 2. 使用 workspace graph 做增量 dependent build

脚本读取 `packages/*/*/package.json`，建立 dependency → dependents graph。变更发生后计算 transitive dependent closure，通过 pnpm filters 运行现有 `build` scripts，保持各 package 自己的 tsdown/tsc 配置。

备选：为所有 package 启动永久 `tsdown --watch`。拒绝，因为 package entry/config 不统一，且大量 watcher 会重复构建内联依赖。

### 3. build 成功后 pulse runtime artifacts

部分 build 使用 clean + recreate，文件系统可能只产生 add/unlink，而 Cordis HMR 只对已加载模块的 change 做 reload。脚本在成功 build 后更新受影响 package 已声明 JS runtime artifacts 的 mtime，保证产生 change 事件；失败时保留旧运行进程和旧产物。

### 4. HMR overlay 是临时生成资产

脚本在 `temp/dsh-dev/<profile>/hmr.patch.yml` 生成 JSON-compatible YAML overlay，root 仅包含 workspace/外部插件已声明的运行时入口目录与 `lib`/`dist`/`build` 目录，并保留现有 DSH source checkout。源码监听和 build 由开发脚本负责，Cordis HMR 不直接观察半成品 `src/`。该文件通过 `dsh --profile <profile> --patch ...` 使用，不修改用户持久化 HMR 配置。

### 5. 配置变化走同步与进程重启

普通源码变化：build → pulse → Cordis HMR。

`package.json`、`cordis.patch.yml`、bundle 新增/删除：build → `dsh plugin add` reconcile → 重写 overlay → graceful restart。脚本自身变化要求开发者重启脚本。

### 6. 单写队列和对称清理

所有 rebuild/sync/restart 串行执行；短时间事件合并。DSH 意外退出后自动重启，连续三次快速失败则暂停以避免 crash loop。SIGINT/SIGTERM 时关闭 watcher，先 SIGTERM DSH，超时后 SIGKILL，避免遗留端口与子进程。

## Risks / Trade-offs

- [全部 bundle 组合可能暴露 bundle 间配置冲突] → prepare 后运行 `dsh --dump-config`；失败则不启动，并保留 profile 供检查。
- [大依赖图的首次 build 较慢] → 仅首次或显式 prepare 构建 bundle dependency closure，后续增量构建。
- [外部插件不是单 package bundle] → 要求 `--plugin` 指向声明 `dsh.bundle.patch` 的 package；其 build script 自行管理内部 monorepo。
- [HMR 无法覆盖 profile layer 顺序变化] → manifest/patch 变化统一重启，不伪装为局部 reload。
- [用户 profile 已有额外插件] → 只 add/reconcile 发现的 bundle，不 remove 其它 dependency。

## Migration Plan

1. 新增 `pnpm dsh:dev`，不改变既有命令。
2. 首次运行把全部本地 bundle 以 link dependency 添加到选定 profile。
3. 回滚时停止脚本即可恢复普通 DSH 启动；若要移除本仓库 bundle，使用现有 `dsh plugin --profile web remove <package...>`。

## Open Questions

无。V1 以 Web profile 为默认值，同时保留 `--profile` 参数。
