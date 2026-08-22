# dsh-bundle-contract Specification

## Purpose
TBD - created by archiving change dsh-bundle-artifact-contract-v1. Update Purpose after archive.
## Requirements
### Requirement: bundle client 产物自包含
凡声明 `exports["./client"]` 的 bundle 包，其构建产物 `lib/client.js` MUST NOT 残留对 `@yeisme/*` workspace 包的外部 `require`，MUST NOT 残留对相对路径 chunk 的外部 `require`。

#### Scenario: 装载即崩的回归被门禁拦截
- **WHEN** 某 bundle 的 client 产物包含 `require("@yeisme/…")` 或 `require("./rolldown-runtime-…")`
- **THEN** `pnpm check:bundles` 以非零退出并列出违约 bundle 与具体 require

#### Scenario: 合法产物通过
- **WHEN** 全部 workspace 依赖经 alias 内联、client 入口关闭代码切分
- **THEN** `pnpm check:bundles` 对该 bundle 判 PASS

### Requirement: banner 注册 id 等于包名
bundle 产物的 `window.__ModuleLoader__.load({ id: … })` 注册 id MUST 等于该包 `package.json` 的 `name` 字段。

#### Scenario: 冒名注册被拦截
- **WHEN** bundle A 的产物 banner 注册了 bundle B 的 id
- **THEN** `pnpm check:bundles` 报 FAIL 并给出两个 id 的差异

### Requirement: 合同门进 CI
CI MUST 在 Build 步骤之后运行 bundle 产物合同检查；无 `exports["./client"]` 的 host/preset bundle 不在检查范围。

#### Scenario: CI 拦截产物层回归
- **WHEN** PR 引入会产出违约 client.js 的 tsdown 配置改动
- **THEN** CI 的 Bundle contract check 步骤失败，阻止合入

