# @yeisme/dsh-plugin-catalog

DSH 插件静态目录（G21 `dsh-plugin-consistency-coverage-v1` §2 catalog 薄做）。
构建工具从仓库包生成静态清单 + 本地查询 CLI。

## 定位边界

- **静态清单**：数据由 `src/discover.ts` 只读扫描 `packages/bundle` 目录
  （package.json + cordis.patch.yml）生成，绝不手写。
- **无网络服务、无遥测、不建第二 registry**：查询只读本地 JSON 文件；
  不启动任何 server，不上报任何数据，不替代 npm 安装通道（安装仍走
  `dsh plugin add`）。
- 内部工具（`packages/catalog` 层），private，不发布、不承诺 semver。

## 清单生成

`pnpm --filter @yeisme/dsh-plugin-catalog run build`（或 `pnpm manifest:generate`）
重新生成 `lib/catalog.json`：

```text
catalog: 30 bundles (28 installable) -> lib/catalog.json
```

覆盖 `packages/bundle` 下全部子目录；**新增 bundle 重建即含，无需手工登记**。
条目字段：

| 字段 | 含义 |
| --- | --- |
| `id` / `name` | 目录名 / 包名（安装行名） |
| `description` | package.json description |
| `path` | 仓库相对安装路径（`dsh plugin add ./<path>` 可用） |
| `installable` | 声明 `dsh.bundle.patch` 且 `cordis.patch.yml` 存在 |
| `preset` | preset/data bundle（无 scripts.build） |
| `pluginDependencies` | dependencies 中的 @yeisme 插件行 |
| `installRows` | cordis.patch.yml 解析出的 insert 安装行 |

覆盖策略：**全部** `packages/bundle` 子目录各一条目（含 preset 与暂不可独立
安装的组装面，后者 `installable=false` 仍列出供对账）。

## 查询 CLI

bin `dsh-plugin-catalog`，或 scripts 入口 `pnpm catalog`：

```bash
pnpm --filter @yeisme/dsh-plugin-catalog run catalog -- list
pnpm --filter @yeisme/dsh-plugin-catalog run catalog -- show dsh-token-usage
pnpm --filter @yeisme/dsh-plugin-catalog run catalog -- search mermaid
pnpm --filter @yeisme/dsh-plugin-catalog run catalog -- list --json
pnpm --filter @yeisme/dsh-plugin-catalog exec dsh-plugin-catalog list   # bin 形态
```

`--manifest <path>` 可指向任意清单副本。退出码：0 成功、1 查询目标不存在、
2 用法/输入错误。

## 程序化 API

```ts
import { buildCatalog, loadCatalog, findBundle, searchBundles } from '@yeisme/dsh-plugin-catalog'
```

## 职责边界

patch 行解析只接受本仓收敛语法（`- insert:` 下的 `- id:` / `name:` 行），
解析不了的行静默跳过——catalog 是查询工具，**红灯归 declaration-lint 所有**
（`pnpm check:plugins --only=declaration-lint`）。测试以真实仓库对账
（条目数、installable 行齐全）防止两套解析漂移。
