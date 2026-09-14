# @yeisme/dsh-template-registry-bundle

DSH 可安装 bundle：模板目录（`template-registry.catalog`）与引导编译（`template-registry.compile`）两个 pane，加 `/template catalog`、`/template compile` 命令入口。变更：`openspec/changes/dsh-template-registry-integration-v1/`。

## 结构

- `@yeisme/dsh-template-registry`（host 库）：stdio MCP 连接管理、目录/会话 typed RPC、`yeisme_template_registry_v1` 存储 domain、`templateRegistryCompile` 会话投影。host 侧根入口是 no-op cordis 插件；把 `createTemplateRegistryService(...)` 组装为 `templateRegistryHost` Remote 是宿主运行时（profile）的组合步骤。
- `@yeisme/dsh-client-ui-template-registry`（client）：浏览器面 `./client` —— capability probe（pane 槽 + `templateRegistryHost` 结构校验）通过后注册两个 pane 与命令；probe 未过时不注册任何入口，只在 context 提供 probe-only face（`templateRegistryPane`）并携带禁用原因。

## 状态语义（诚实降级）

- 目录 pane：loading 骨架 / MCP 离线错误+重试 / 降级 catalog 快照徽标+刷新 / 过滤空态+清除 / owner 错误码 / rights fail-closed 预览禁用+原因。
- 编译 pane：合同表单（host inspect 合同为唯一事实源，中英 i18n 标签）/ 确认门（显式 `decision_ref`，绝不自动）/ 结果卡（`provider_calls = 0` 声明）/ 导出（digest 漂移禁用+重新固定）。本 bundle 不产生任何模型调用。

## 安装

`dsh plugin add @yeisme/dsh-template-registry-bundle`（等价于本包 `cordis.patch.yml` 的 `dsh-template-registry` 行）。

## 验证

```bash
pnpm --dir packages/bundle/dsh-template-registry run test      # metadata + build + smoke
pnpm --dir packages/client/ui-template-registry run test      # 45 个组件/控制器用例
pnpm run check:bundles                                        # client.js 自包含（无 @yeisme/* require）
pnpm run check:surfaces                                       # adopted Surface 分类
```
