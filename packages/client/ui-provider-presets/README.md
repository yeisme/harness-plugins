# @yeisme/dsh-client-ui-provider-presets

DSH 渠道市场 client 面：在 Models 设置页预留的 `settings.models.footer` 扩展 slot 注册 cc-switch 式「渠道市场」——预设渠道卡片、引导式添加（`GET /models` 拉取 + 密钥写入 host + `llm-pi-ai.providers` 保存 + 可选设为默认）与已配置渠道总览快切。

- 目标运行时：DSH 0.1.2-rc.1 起（`remote.settings/credentials/llm` 子命名空间与 footer slot）。rc.6 运行时零注册、无死按钮（诚实降级）。
- 密钥边界：API key 输入值只单程传给 `remote.credentials.set`（host `.credentials.yaml` refs）；浏览器侧读取仅 `CredentialInfo{configured, writable, source}`，永不回流明文。
- 写入语义：`settings.mutate('llm-pi-ai', [set providers.<route>])`（经 `assertServiceable` 校验，`settings-rejected`/`settings/conflict` 如实展示）；设为默认整段替换 `agent-default-model`（live 生效）。
- 视觉：`@yeisme/dsh-client-ui-surface` + `ui-visual-kit` token（adopted 档，scope `provider-presets`）。

浏览器半经 `./client` 导出（ModuleLoader 单文件）；`.` 为 no-op host 面。规格与设计见 `openspec/changes/dsh-provider-presets-v1/`。

## Commands

```sh
pnpm --filter @yeisme/dsh-client-ui-provider-presets run test
pnpm --filter @yeisme/dsh-client-ui-provider-presets run typecheck
pnpm --filter @yeisme/dsh-client-ui-provider-presets run build
```
