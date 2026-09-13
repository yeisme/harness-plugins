# Verification — dsh-provider-presets-v1

## 门禁（2026-09-12）

- `pnpm --filter @yeisme/dsh-client-ui-provider-presets run typecheck|test|build`：通过（44 tests）。
- `pnpm --filter @yeisme/dsh-provider-presets run typecheck|test|build`：通过（6 tests）。
- `pnpm run check:surfaces`：通过（29 client + 8 bundle；`ui-provider-presets: adopted` 已登记）。
- `pnpm run check:bundles`：29/29 PASS（client.js 自包含 + ModuleLoader banner id == 包名）。
- `pnpm run check:plugins`：bundle-contract / declaration-lint / safe-projection / visual-token / personal-coding PASS。dispose-hmr 有 1 项发现位于并行 lane 未跟踪文件 `packages/bundle/ordo-agent-ops/src/host/project-owner.ts`（非本 change 引入）。
- 全仓 `pnpm -r run typecheck`：0 error。
- `pnpm run test:visual`：全量红为已知容器基线漂移（记忆 ui-visual-env-drift；未跑 update-snapshots）；本插件 UI 证据走 visual-adoption.spec（token 单点/scope/交互底线字符串断言）。

## 集成证据（browser-e2e，14/14 passed）

`pnpm --filter @yeisme/dsh-provider-presets run test:integration`
→ `temp/integration-test-runs/2026-09-12T14-46-*/summary.json`（status=passed，redaction policy yeisme.integration-test-redaction.v1）

覆盖：runtime 锚点（dsh 0.1.2-rc.1）→ 单 insert 行组合 → web boot → Settings > Models → 渠道市场渲染 → 自定义卡引导流（本地 OpenAI 兼容 echo provider：GET /models 2 models/27ms）→ 保存（dialog 关闭 + receipt）→ 落盘断言（settings.yaml `llm-pi-ai.providers.custom-openai` 含容量字段映射；`.credentials.yaml` refs 新增 CUSTOM_API_KEY）→ Models 页行可见 → 设为默认（`agent-default-model: {provider: custom-openai, model: preset-echo-small}`）→ 卸载后 user 层设置保留。

## 预设端点核验（匿名，无密钥）

9/9 在线：bigmodel-anthropic / openrouter / modelscope 返回 200（公开列表）；bigmodel-openai / moonshot / siliconflow / dashscope / volcengine-ark / deepseek 返回 401（端点存在、鉴权门生效）。无连接失败或 DNS 残端点。

## 已知边界

- 真实渠道的完整添加流（真实 key 拉模型）未在自动化证据中执行——涉及真实凭据，由用户在 Models 页「渠道市场」实测；机制面已由本地 echo provider 全覆盖。
- 低于 0.1.2-rc.1 的运行时（含 rc.6）零注册：footer slot 与 remote 子命名空间不存在，Models 页保持原生形态，boot 无 pending entry（静态 inject 仅 `['locale']`）。
