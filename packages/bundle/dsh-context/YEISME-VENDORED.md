# Yeisme vendored provenance — dsh-context

本目录是上游 [bowenliang123/dsh-context](https://github.com/bowenliang123/dsh-context) 的
**fork 副本**（2026-09-10 起由 Yeisme 自行开发管理），不是只读 vendor。初始 pin 为上游
`v0.48.0`；此后本目录的演进由本仓负责，回同步上游时在此记录。

## Pin

| 项 | 值 |
|---|---|
| 上游 | https://github.com/bowenliang123/dsh-context |
| 初始 pin commit | `40bb97c563`（2026-09-10, tag `v0.49.0`；首个 pin `8357bcf7` v0.48.0 已于 2026-09-10 升级） |
| 许可 | Apache-2.0（上游 `LICENSE`） |
| Fork 日期 | 2026-09-10 |
| 分工 | 上下文洞察/组成/演进（Context 面板、浏览器、命令）归本插件；会话工具 Tab 的活动检测已从 `@yeisme/dsh-mcp-inspector` 移除，工具 Tab 聚焦工具启停与 MCP 管理 |

## 初始 fork 与上游的差异（除本文件外均为上游字节原样）

- 排除 `.git/`、`.github/`、`.husky/`、`.gitignore`、`.oxlintrc.json`、
  `pnpm-workspace.yaml` 与 `pnpm-lock.yaml`（本仓 workspace 统一管理）、
  `scripts/{watch,web,register,publish}.sh`（上游独立开发流）、`docs/social-preview/`。
- `package.json` 适配本仓：删 `packageManager`；scripts 收敛为
  `build`/`typecheck`/`test`；devDependencies 移除 lint 栈
  （husky、oxlint、oxlint-tsgolint、@stylistic/eslint-plugin、eslint-plugin-sonarjs）、
  coverage 与 playwright-core（本仓测试不依赖）。
- 其余（`src/`、`tests/`、`tsdown.config.ts`、`tsconfig*.json`、`vitest.config.ts`、
  `cordis.patch.yml`、`docs/`、`AGENTS.md`、`README.md`、`LICENSE`、
  `scripts/diff-fold.ts`）保持上游字节原样。

## 运行时要求

- 宿主 DSH >= 0.1.2-rc.1（`dsh.compatibility.dshReleases` 声明 0.1.2-rc.1 /
  0.1.3-alpha.2 / 0.1.5-rc.1 compatible；本仓 staging 宿主为 0.1.2-rc.1-a66e470）。
- 2026-09-10 升级 v0.48.0 → v0.49.0（richText 复制、定价更新、compat 矩阵换
  0.1.5-rc.1、guide-entry 契约重构；26 文件 +182/-68，无新增网络/执行面）。
- Node >= 22.19；client 经 `dsh.client.inject` 声明 slots 依赖，运行时仅 require
  平台基线模块（react/cordis/dsh-client-store/ui-slots/ui-primitives）。

## 安装（用户 profile）

```bash
dsh plugin --profile web add ./packages/bundle/dsh-context
```

本机 web profile 已挂 `link:` 本目录；改动后重建 `pnpm --filter dsh-context run build`
并重启预览即生效。

## 与上游同步（按需）

1. clone 上游到 `/tmp`，`diff -r` 对照本目录（忽略上方排除项与本仓自有改动）。
2. 人工复核后合入，更新本文件 Pin 表与差异清单。
3. `pnpm --filter dsh-context run typecheck && pnpm --filter dsh-context run test`、
   `pnpm run check:bundles`，重新 add 到 profile 后 boot 冒烟。
