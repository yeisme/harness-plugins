# DSH 本地图像与制作 Pane

`creator.visual` 打开 Eikona 图像工作台，`creator.production` 打开 Scaena 制作台。旧命令和布局恢复键保留，两个页面不再带 Creator Studio 全领域导航。当前共用安装包。

## 本机使用

DSH host 从 PATH 调用 `eikona` 和 `scaena`，沿用 CLI 自身的用户级配置。也可通过配置命令指定可执行文件、项目目录和 owner 配置文件；不需要另建 HTTP 服务，不复制 CLI 凭据。

在 harness-plugins 目录运行：

```bash
node scripts/creator-studio-config.mjs show
node scripts/creator-studio-config.mjs set --workspace /path/to/creative-project --eikona-project PROJECT_ID
pnpm dsh:workbench -- --check
pnpm dsh:workbench -- --no-open --host 127.0.0.1 --port 40869
```

`/path/to/creative-project` 和 `PROJECT_ID` 应替换为现有创作目录及 Eikona 注册项目 ID。省略项目 ID 时按 Eikona 注册目录匹配；未匹配不将其他项目数据作为默认内容。

配置保存在 `~/.config/yeisme/dsh-creator-studio.json`，由命令校验并原子保存。额外选项：`--eikona`、`--scaena` 指定可执行文件；`--eikona-config`、`--scaena-config` 指向各 CLI 已有配置。修改后重启本地预览。用户级设置由用户显式选择，测试不覆盖该文件。

需要包含本轮新增合同的 CLI 构建：Eikona `list --project --offset`、`preparation approval-status/reconcile`、`artifacts read`、`review status/decide/reconcile`；Scaena `storyboard table reconcile`、`storyboard package export-status`。旧 CLI 缺少合同会显示 unavailable/unconfirmed；不能把旧命令的演示结果作为正式制作。

## 当前交付与边界

图像：固定提示词版本的准备、批准、单图执行、候选读取/比较/采用和原操作恢复已通过本地 CLI + HTTP fixture 链路。图像窗口支持 fit、原尺寸和缩放平移。默认模型是 `openai/gpt-5.4-image-2`。参数中可传既有 artifact 引用和遮罩，但渠道编辑能力及完整导入路径仍须分别验证。资产历史按项目分页；列表变化使旧游标失效时保留已显示内容并要求刷新。

制作：已接入真实制作会话、canonical 镜头表查询、字段/时长/场景顺序保存、制作包读取、草稿/正式导出门和原导出查询。选择、打开和关闭均不自动执行制作。镜头表修改产生新候选；草稿导出不表示 production-ready。

完整计划仍开放：批量本地 CLI、参考图导入、区域编辑、继续修改、Eikona→Scaena 固定版本交接、项目/镜头创建、声音绑定、候选替换、审阅与合成，以及正式宿主的双项目/双会话完整验收。已通过的组件和 fixture 证据不替代这些步骤，也不替代视觉认可或真实付费 provider 验收。

后续按已批准顺序推进：项目画布与连续性；开发会话/文件/终端/差异/Ordo 联动；再按独立领域入口补 Auctra、Sonora、Anatomia、Pinax。

## 验证

```bash
pnpm --filter @yeisme/dsh-creator-studio-host run test
pnpm --filter @yeisme/dsh-client-ui-creator-studio run test
pnpm --filter @yeisme/dsh-creator-studio run test
node scripts/run-local-studio-integration.mjs
node scripts/run-ui-visual-tests.mjs visual-domain-studio.spec.ts
```

集成证据由各 runner 写入 `temp/integration-test-runs/<run-id>/`。fixture 链路仅调用回环测试 provider；真实收费渠道必须取得当次明确的渠道、操作和额度授权。
