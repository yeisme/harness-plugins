# @yeisme/dsh-plugin-example

DSH 参考插件（G21 `dsh-plugin-consistency-coverage-v1` §3）：以**单个包**展示
host+client+bundle 三层最小结构与 probe-first 降级写法。不接管 core state、
零运行时依赖（`dependencies` 为空；react/cordis 等均为宿主提供的 optional peer）。

## 三层最小结构（同一包内演示）

| 层 | 本包位置 | 真实仓对应 |
| --- | --- | --- |
| host | `src/index.ts` + `src/host/example-service.ts` | `packages/host/<name>` |
| client | `src/client/index.ts`（构建为 `lib/client.js`） | `packages/client/<name>` |
| bundle | `package.json` 的 `dsh` 声明 + `cordis.patch.yml` + tsdown ModuleLoader 单文件构建 | `packages/bundle/<name>` |

## probe-first 降级（三态合同）

合同源：`packages/sdk/dsh-plugin-contracts`（probe/projection/dispose）。本包为
零运行时依赖的自包含参考，源内镜像 `src/probe.ts`；`tests/probe.spec.ts` 与
sdk 实现做行为与形状双 parity（防漂移）。

三个被探测的 seam：

| seam | 到岗 | needs_contract（未到岗） | unavailable（抛错） |
| --- | --- | --- | --- |
| `slots` | header 入口注册 | 不注册任何死按钮 | 同左（结构探测吞错） |
| `paneWorkbench` | 面板落 workspace 视图 | 降级 `shell.overlay` 座位；再缺 → 面板不出现 | 同左 |
| `exampleCounter`（演示数据 seam） | 入口可用、面板显示 fresh 快照 | **入口可见但禁用 + 可读原因**，面板明说缺什么 | 禁用 + 如实 reason（不吞错） |

演示数据 seam 在干净 profile 中通常缺席——这正是本示例要演示的诚实降级：
seam 缺失时显示禁用与原因，而非死按钮或伪造宿主。真实插件中该面经 typert
Remote 到达（完整参照：`packages/host/dsh-token-usage` 的 `tokenUsage` Remote）。

## 安装（干净 profile）

```bash
pnpm --filter @yeisme/dsh-plugin-example run build
dsh plugin --profile web add ./packages/example/dsh-plugin-example
```

安装行（`cordis.patch.yml`）只有一条：`- id: dsh-plugin-example /
name: '@yeisme/dsh-plugin-example'`。

## 验证

```bash
pnpm --filter @yeisme/dsh-plugin-example run typecheck
pnpm --filter @yeisme/dsh-plugin-example run test      # build + vitest（probe parity/host/client/bundle 合同自检）
pnpm --filter @yeisme/dsh-plugin-example run smoke:bundle   # 真实 lib/client.js 的 ModuleLoader 冒烟
```

冒烟脚本 stub `window.__ModuleLoader__` 并在真实构建产物上跑四种 seam 组合
（全到岗 / 数据缺席 / 宿主读取抛错 / 放置面全缺）。官方 `dsh web` 宿主的
安装运行属可选 host 集成，不是插件完成门（见 `docs/plugin-host-protocol.md`）。

## 边界

- 不接管 DSH core state：host 面只折叠自有演示数据（有界环 + 幂等 dispose）。
- 不实现 AppFrame 几何 / PTY / host 职责；官方 seam 未合入时继续 probe。
- 面板探测结果在 apply 时定格（无 hooks）；动态刷新的 controller +
  `useSyncExternalStore` 参照 `packages/client/ui-token-usage`。
