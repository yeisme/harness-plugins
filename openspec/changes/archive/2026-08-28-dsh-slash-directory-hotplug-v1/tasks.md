# Tasks: dsh-slash-directory-hotplug-v1

## 1. Core live directory

- [x] 1.1 fail-closed 合并、保留名、可订阅目录。
  - **Owner/Scope**：`packages/client/command-experience-core/src/live-directory.ts`
  - **Validation**：`pnpm --filter @yeisme/dsh-client-ui-command-experience-core test`
- [x] 1.2 pane 投影与 inspect resolver。
  - **Owner/Scope**：`pane-projection.ts`、`inspect-resolve.ts`、`slash-runtime.ts`、`p0-catalog.ts`
- [x] 1.3 `/agent` alias `agents`；`/pane` `/explorer` `/git` `/mcp` `/skills` 按 surface 启用。

## 2. Protocol and examples

- [x] 2.1 `PaneCommandDescriptor.slash?` ADDED。
  - **Owner/Scope**：`packages/host/pane-protocol`
  - **Validation**：`pnpm --filter @yeisme/dsh-pane-protocol test`
- [x] 2.2 Creator `/creator` 短名；Agent Context 读取 `metadata.tab`。

## 3. Bundle apply

- [x] 3.1 `bindSlashRuntime` + host/client `apply()`。
  - **Owner/Scope**：`packages/bundle/dsh-command-experience`
  - **Validation**：`pnpm --filter @yeisme/dsh-command-experience test`

## 4. Docs and gate

- [x] 4.1 cookbook 双语 `docs/cookbook/slash-commands.md`
- [x] 4.2 `openspec validate dsh-slash-directory-hotplug-v1 --strict --no-interactive`

## 5. Real-runtime integration hardening (2026-08-28)

- [x] 5.1 Host 面改 `inject: ['commands']`（wait-for 语义），修静默丢注册。
  - **Owner/Scope**：`packages/bundle/dsh-command-experience/src/index.ts`
  - **Validation**：`pnpm --filter @yeisme/dsh-command-experience test` + 真实 `dsh --profile web` boot
- [x] 5.2 官方拥有名让位：core `OFFICIAL_OWNED_INSPECT_NAMES`（goal/plan）+ bundle 注册前 `find()` 检查。
  - **Owner/Scope**：`p0-catalog.ts`、`slash-runtime.ts`、`slash-bind.ts`
  - **Validation**：同上 + `pnpm --filter @yeisme/dsh-client-ui-command-experience-core test`
- [x] 5.3 插件清单投影 `ctx.loader.entries()`（与官方 plugin-inventory 同源）。
  - **Owner/Scope**：`packages/bundle/dsh-command-experience/src/slash-bind.ts`
  - **Validation**：`tests/slash-bind.test.ts` 新 3 例；真实 profile `/mcp` success 文本
- [x] 5.4 真机证据：临时最小 profile boot + `/plugins` 持久 command/run|done；真实 profile `/` 菜单全量 + `/mcp` success。
  - **Evidence**：会话记录 `~/.dsh/sessions/.../session.jsonl.zstd` command/run name=mcp → command/done success
