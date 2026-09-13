# 实施与验收任务

由 scripts/openspec-tasks.py 维护状态。

- [x] 1.1 冻结 wire 契约：`wire.ts` 本地结构化类型镜像 0.1.2-rc.1 `dsh-api-remotes/client` 面（discovery/credentials/settings/list*），静态 inject 白名单（locale）与 `ctx.get` 点分名 + `internal/service` 事件晚绑定策略。 | evidence: `packages/client/ui-provider-presets/src/client/wire.ts`；浏览器 guard facade 拦截属性路径（实测 "cannot get property remote.settings without inject"），点分名 `ctx.get` 为官方 optional-service 通道（ui-mcp-inspector 先例）
- [x] 2.1 client：`presets.ts` 预设目录数据 + 契约校验纯函数（协议集、POSIX ref、种子容量、zh/en 双语）。 | evidence: `tests/presets.spec.ts` 通过；建议 route key 避开 pi-ai 内置 catalog 名单（deepseek/openrouter/moonshotai/zai 等 34 项）；9 端点匿名探测全部在线（7×401 鉴权门 + openrouter/modelscope/bigmodel-anthropic 200 公开列表）
- [x] 2.2 client：`operations.ts` remote 封装（describe/set/unset、mutate 冲突分流、discoverModels 错误码分流）+ `store.ts` 目录快照与事件刷新（dispose 对称）。 | evidence: `tests/operations.spec.ts`、`tests/store.spec.ts` 通过（found/401/UNSUPPORTED/conflict/rejected 全路）
- [x] 2.3 client：`ProviderPresetsSection.tsx` 渠道市场区（总览 row + 预设卡网格 + 状态矩阵全态）与 `PresetAddDialog.tsx` 引导流（key→拉取→勾选→保存→可选默认）。 | evidence: `tests/section.spec.tsx`、`tests/dialog.spec.tsx` 通过；`check:surfaces` 通过（29 client + 8 bundle）
- [x] 2.4 client：`index.ts` 注册（footer slot、zh/en 字典、能力探针、dispose 汇聚）+ visual-adoption.spec。 | evidence: `tests/visual-adoption.spec.ts` 通过；`check:plugins` 本包零发现（safe-projection 豁免登记：预设端点静态目录数据，owner 复核 2026-09-12）
- [x] 3.1 bundle：`packages/bundle/dsh-provider-presets`（package.json exports、cordis.patch.yml insert 行、tsdown、dsh.compatibility.json、README）。 | evidence: `check:bundles` 29/29；`tests/bundle.spec.ts` 6/6
- [x] 3.2 门禁登记：`check-ui-surface-contracts.mjs` catalog 行 + safe-projection `REVIEWED_EXEMPTIONS` 豁免（owner 复核注记）。 | evidence: `check:surfaces` 通过、`check:plugins` safe-projection PASS（0 findings）
- [x] 4.1 端到端：workbench 起 web profile，Models 页出现渠道市场；假 key 401 反馈；真渠道拉到模型→保存→`~/.dsh/settings.yaml` 新 route + `.credentials.yaml` refs 落盘断言；设为默认后新会话模型生效。 | evidence: `pnpm --filter @yeisme/dsh-provider-presets run test:integration` 14/14 passed（temp/integration-test-runs/2026-09-12T14-46-*/summary.json）；本地 echo provider 完成 拉取(2 models/27ms)→保存→route+ref 落盘→设默认→卸载保留 user 层
- [x] 4.2 降级验证：rc.6 面（或模拟缺 slot）下零注册无死按钮；文档（README：安装、渠道列表、降级语义）。 | evidence: 静态 inject 仅 `['locale']`（remote.* 经 ctx.get 探针，缺面零注册，bundle.spec 钉住）；README INCOMPATIBLE 注记（<0.1.2-rc.1）
