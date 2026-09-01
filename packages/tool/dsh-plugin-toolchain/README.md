# @yeisme/dsh-plugin-toolchain

DSH 插件一致性工具链（G18 `dsh-plugin-dev-toolchain-v1` Wave 1）。`packages/tool/*`
层的只读检查器聚合：只 inspect 被测包，不修改任何 source。

## 统一入口

```bash
pnpm check:plugins            # 闸门模式：发现红灯 exit 1
pnpm check:plugins --baseline # 基线模式：红灯只记录进报告（首跑允许既有红灯，清零归 G21）
pnpm check:plugins --only=declaration-lint,visual-token-conformance
```

需在 `pnpm build` 之后运行（bundle-contract 检查构建产物）。报告落
`temp/toolchain-runs/<runId>/report.{json,md}`，脱敏规则与集成证据一致：
仓库相对路径定位、不回显字段值。

## 检查器

| id | 内容 |
| --- | --- |
| bundle-contract | ModuleLoader 单文件契约（自 `scripts/check-bundle-contracts.mjs` 收编，`pnpm check:bundles` 为别名） |
| declaration-lint | `cordis.patch.yml`（本仓无 `dsh.bundle.patch`，30/30 bundle 为双文件形态）与 `package.json` 一致性：行名导出对应、依赖行指向、跨包 id 唯一、workspace 层边界 |
| safe-projection-audit | host→client 投影面与 wire fixture 静态扫描：cookie/token/raw URL/绝对路径/任意 fetch 观测门（R9） |
| dispose-hmr-conformance | 事件监听器/interval/observer/host 订阅四类资源释放对称性 harness（V3 7.5 泛化，R9 观测门主体） |
| visual-token-conformance | 复用 check:surfaces 分类门 + `--vk-/--dsw-` token 使用率基线 |

## 退出码语义

- `0` 全绿（或 baseline 模式下仅记录红灯）
- `1` 检查发现红灯
- `2` 检查器内部错误（与红灯严格分离）

## 定位

内部一致性工具（`packages/tool` 层），不发布、不承诺 semver；观测门语义：
红灯=需要 owner 复核的观测点，首跑基线允许红灯，清零归 `dsh-plugin-consistency-coverage-v1`（G21）。
