## Why

本仓库已有大量本地 DSH bundle，但开发者仍需手工 build、逐个 `dsh plugin add`、维护 HMR root 并在 patch 变化时重启进程。新增一条可重复的开发入口，让“加载全部插件并实时开发自己的插件”成为默认工作流。

## What Changes

- 新增 `pnpm dsh:dev`：自动发现所有声明 `dsh.bundle.patch` 的本地 bundle，构建并以 link 方式同步到指定 DSH profile，然后启动 Web。
- 新增 `--plugin <path>` 可重复参数，用于加载仓库外的自研插件。
- 生成临时 HMR overlay，监听 workspace 与外部插件；源码变化时增量构建受影响的 workspace dependents，产物变化由 Cordis HMR 接管。
- `package.json`、`cordis.patch.yml` 或 bundle 集合变化时重新同步 profile 并安全重启 DSH。
- 增加 dry-run/check 模式、单元测试和脱敏 integration evidence runner。
- 修正全量启动暴露的本地 package runtime 契约：补齐 externalized Typert peer、为 terminal 增加纯 Host 子入口，并让 semantic route 使用 Cordis effect 生命周期。
- 现有 `dsh`、`dsh plugin`、各 bundle 与 profile 命令保持不变；本变更仅新增开发入口。

## Capabilities

### New Capabilities

- `dsh-all-plugins-hot-dev`: 本地 bundle 自动发现、profile 同步、增量构建、HMR overlay、进程生命周期和外部插件开发合同。

### Modified Capabilities

无。

## Impact

- 新增 `scripts/dsh-dev.mjs`、对应测试和 integration evidence runner。
- 根 `package.json` 新增 `dsh:dev`、`test:dsh-dev` 与 `test:dsh-dev:integration` 命令。
- `@yeisme/dsh-terminal` 新增 additive `./host` export；相关 bundle 补齐既有 runtime import 的 peer/dev dependency 声明，无删除或重命名。
- DSH 用户级 profile 在命令执行时由官方 `dsh plugin` 写入 link dependencies；仓库不持久化用户 profile 或绝对路径。
- 临时 HMR patch 与测试证据写入本子项目 `temp/`，不提交。
