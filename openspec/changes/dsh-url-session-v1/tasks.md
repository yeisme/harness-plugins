## 1. P0 契约冻结与文档

- [x] 1.1 [Owner: Harness Plugins；Scope: `openspec/changes/dsh-url-session-v1/`；Dependencies: none；Lane: design] 冻结 split-owner、`/s/<id>` 主形式、`?s=` 别名、path 优先、URL 不含 secret、P4 不进本切片。Acceptance: proposal/design/三份 ADDED spec/本任务账本齐全，必需能力无静默降级；Validation: `openspec validate dsh-url-session-v1 --strict --no-interactive`；Expected: `Change 'dsh-url-session-v1' is valid`；失败复查: 先修 capability 名称、Requirement/Scenario 四级标题和 ledger，不进入实现。
- [x] 1.2 [Owner: Harness Plugins；Scope: `docs/protocols/dsh-url-session.md`、`docs/README.md`、`docs/runtime/dsh-workbench.md`；Dependencies: 1.1；Lane: docs] 把 URL 契约写成仓内真源：canonical path、query 别名、生命周期、安全警示、`dsh-session:` 与 Web path 的关系、回滚。Acceptance: 人类文档中文、命令/路径/flag 英文；零凭证示例；Validation: 文档交叉引用 OpenSpec change，无 agent-only wrapper；Expected: 入口可从 `docs/README.md` 点到契约；失败复查: 删除未验证承诺与 OS 协议注册。
- [x] 1.3 [Owner: Harness Plugins；Scope: evolutionary-change 记录；Dependencies: 1.1；Lane: design] 固定兼容分类：HTTP `/s/<id>`、query `s`、web `--resume`、`--agent session.url` 均为 additive 新面；禁止重命名既有键。Acceptance: design 含 rollback（卸插件 + 关 historyFallback）；Validation: `openspec validate dsh-url-session-v1 --strict --no-interactive`；Expected: valid；失败复查: 若需删除/改语义，停写代码并补迁移窗口。

## 2. P1 Route codec（可与文档并行于 1.1 之后）

- [x] 2.1 [Owner: Harness Plugins；Scope: `packages/client/ui-url-session/`；Dependencies: 1.1；Lane: codec] 初始化 `@yeisme/dsh-client-ui-url-session` 的 package、exports、tsdown/tsc/Vitest 与中文 README。Acceptance: codec 从独立子路径导出，无 DSH 私有 import；Validation: `pnpm --filter @yeisme/dsh-client-ui-url-session run typecheck`；Expected: exit 0；失败复查: 检查 ESM/peer，不改根外无关 package。 | evidence: packages/client/ui-url-session 已建：package.json（exports `.` no-op host face + `./codec` 子路径，无 DSH 私有 import）、tsconfig/tsdown（双单 entry ESM）/vitest、中文 README；typecheck exit 0、build exit 0（lib/index.js + lib/codec.js + lib/types）。
- [x] 2.2 [Owner: Harness Plugins；Scope: codec 纯函数；Dependencies: 2.1；Lane: codec] 实现 `parseLocation` / `sessionUrl` / mention URI 抽 id：path 优于 query、空/非法 id → null、`file:` 可用、生成 URL 无 secret。Acceptance: 表驱动覆盖 design 全部 codec 场景；Validation: `pnpm --filter @yeisme/dsh-client-ui-url-session run test`；Expected: codec cases 全绿；失败复查: 禁止在 codec 读 `window` 或 Cordis。复杂解析不变量 SHALL 写中文注释。 | evidence: parseSessionLocation/sessionUrl/mentionSessionId 表驱动 33/33：path 优于 query（不一致取 path、非法 path 不回退 query）、`/s/`、尾斜杠、多段、空/非法/超长/percent-encoded id、`?s=` 混排参数、file:// 别名、URL 实例 + `#msg-` 保留锚、file:// 空 host 归一、origin userinfo/非法 id 抛 TypeError、mention 抽 id。复杂解析不变量中文注释固化于 src/codec.ts；codec 零 window/Cordis 访问。

## 3. P1 URL ↔ runtime 同步与空态

- [ ] 3.1 [Owner: Harness Plugins；Scope: Client sync controller；Dependencies: 2.2；Lane: client] 实现 boot 完成后读 URL、`session-query` 解析、cwd→workspace、`sessions.open`、generation token。Acceptance: 无 `s` 不改选择；过期应答丢弃；缺 seam 不注册、不抛；Validation: `pnpm --filter @yeisme/dsh-client-ui-url-session run test`；Expected: sync/probe cases 全绿；失败复查: 禁止 DOM 选会话或改 boot 协议。
- [ ] 3.2 [Owner: Harness Plugins；Scope: History API；Dependencies: 3.1；Lane: client] 选择成功 `pushState` canonical `/s/<id>`；同 id `replaceState`；`popstate` 反向选会话。Acceptance: 不整页 reload；无 History 时仅内部状态；Validation: 同上 focused History 夹具；Expected: push/pop/replace 全绿；失败复查: 检查循环同步（URL→select→push→再 select）。
- [ ] 3.3 [Owner: Harness Plugins；Scope: 缺失会话空态；Dependencies: 3.1；Lane: client] 未知/已清理 id 在会话主视图内空态「会话不存在或已被清理」+ 返回列表。Acceptance: boot 仍 ACTIVE、无白屏、不伪造会话；Validation: component 测试含返回列表后 URL 不再声称该 id；Expected: empty/error 态全绿；失败复查: 空态必须 embed 进既有 conversation，不新开 pane。
- [ ] 3.4 [Owner: Harness Plugins；Scope: 复制/新标签入口；Dependencies: 3.2, 3.3；Lane: client] 侧栏会话项菜单 + 会话头部 slot：「复制会话链接」「在新标签页打开」；无会话 disabled+原因。Acceptance: clipboard 无 token；新标签不自动发送；中英 locale；键盘/焦点/触控符合 UI Contract；Validation: `pnpm --filter @yeisme/dsh-client-ui-url-session run test`；Expected: a11y/menu cases 全绿；失败复查: 复用官方 Button/Menu 与 `--vk-*` token，禁止硬编码色。
- [ ] 3.5 [Owner: Harness Plugins；Scope: `?s=` 兼容硬门槛；Dependencies: 3.2；Lane: client] 夹具覆盖纯上游 location（无 fallback）、仅 query、`file://`。Acceptance: 这些夹具不依赖 `/s/` 的 200；Validation: codec+sync 测试显式命名 `query-alias-without-fallback`；Expected: 全绿；失败复查: 不得把 P1 验收改成必须硬刷新 `/s/<id>`。

## 4. P1 Bundle 与 profile

- [ ] 4.1 [Owner: Harness Plugins；Scope: `packages/bundle/dsh-url-session/`；Dependencies: 3.4, 3.5；Lane: bundle] 创建 `@yeisme/dsh-url-session`：`cordis.patch.yml` insert、host 空 `apply`、`./client` 转发、peer 锚定当前 DSH。Acceptance: `check:bundles` 无残留 `@yeisme/*` require；declaration-lint 过；Validation: `pnpm --filter @yeisme/dsh-url-session run typecheck && pnpm --filter @yeisme/dsh-url-session run build && pnpm --filter @yeisme/dsh-url-session run test`；Expected: exit 0；失败复查: 禁止把实现复制进 bundle src。
- [ ] 4.2 [Owner: Harness Plugins；Scope: web profile 安装说明；Dependencies: 4.1；Lane: docs] README 写 `dsh plugin --profile web add`、卸载回滚、`?s=` 用法、安全警示。Acceptance: 真实可运行命令；Validation: 文档无本地 wrapper、无 token；Expected: 与契约文档一致。

## 5. P2 SPA historyFallback

- [ ] 5.1 [Owner: Harness Plugins upstream staging；Scope: `upstream-prs/frontend-static-history-fallback/`；Dependencies: 1.3；Lane: upstream] 建立 changes.patch、new-files、apply.sh、README：`historyFallback` 默认 false；命中走 `renderIndex`+`tapIndex`。Acceptance: 干净 checkout 幂等 apply；Validation: `upstream-prs/frontend-static-history-fallback/apply.sh <clean-dsh-checkout>`；Expected: 首次应用成功，第二次拒绝或 no-op；失败复查: 对照上游当前 frontend-static 重生成，禁止抢第二 fallback 席位。
- [ ] 5.2 [Owner: DSH upstream staging；Scope: 判定矩阵；Dependencies: 5.1；Lane: upstream] 表驱动：GET/HEAD × 无扩展名 `/s/<id>` × Accept html → index；POST → 405；越界 → 403；带扩展名缺失文件 → 原 404。Acceptance: 既有 web-server 单测全绿；Validation: staging checkout 内 frontend-static/webserver focused tests；Expected: 全绿；失败复查: 任何放宽 405/403 的改动必须回退。
- [ ] 5.3 [Owner: Harness Plugins；Scope: Yeisme web profile patch 打开开关；Dependencies: 5.1, 4.1；Lane: bundle] profile/`cordis.patch.yml` 仅设 `historyFallback: true`，不复制静态服务器。Acceptance: 未装本 bundle 的上游 profile 默认仍 404 path 深链；Validation: bundle 声明测试断言开关存在且默认不污染其他 profile；Expected: exit 0。
- [ ] 5.4 [Owner: Harness Plugins；Scope: 上游提案说明；Dependencies: 5.2；Lane: docs] README 记录 base commit、判定矩阵、compare 分支意图。Acceptance: 不向 `deepseek-ai/deepseek-harness` 开官方 PR；完成门不是合入；Validation: 对照 `docs/plugin-host-protocol.md`；Expected: 状态 `fork-ready` 或 patch-ready，无「等合入再勾」。

## 6. P3 CLI 与跨工具入口

- [ ] 6.1 [Owner: Harness Plugins / DSH CLI staging；Scope: `dsh web --resume`；Dependencies: 2.2, 4.1；Lane: cli] web 入口接受 `--resume <session-id>`：有 fallback 打开 `/s/<id>`，否则 `/?s=<id>`；`--no-open` 打印完整 URL 行。Acceptance: 不改 tui `--resume`；URL 无 token；Validation: focused CLI 测试；Expected: 目标 path/query 与 codec 一致；失败复查: 上游无 flag 时走 staging patch 或 command contribution，禁止静默改其他命令。
- [ ] 6.2 [Owner: Harness Plugins；Scope: `/url` 命令；Dependencies: 3.2, 6.1；Lane: cli] 会话内 `/url` 打印/复制当前链接；`--agent` 增加 `session.url`；`--json` envelope additive。Acceptance: 无会话失败投影不发明 id；既有 agent 键不改名；Validation: command 输出合同测试 + `ai-native-cli-output-contract` 抽样；Expected: `session.url` 与同步后地址栏一致；失败复查: 对照 envelope 顶层字段，禁止把 URL 塞进人类 prose 当唯一机器面。
- [ ] 6.3 [Owner: Harness Plugins；Scope: handoff 只读字段；Dependencies: 2.2；Lane: integration] 安全 handoff descriptor 允许可选会话 URL；旧消费者缺字段仍可解析。Acceptance: URL 不授权 mutation；Validation: descriptor fixture 有/无字段各一条；Expected: 全绿；失败复查: 不把字段标 required。

## 7. 验证、视觉与收口

- [ ] 7.1 [Owner: Harness Plugins；Scope: 所属包 focused tests；Dependencies: 4.1, 3.5, 6.2；Lane: verify] 跑 Client/Bundle focused test 与 typecheck/build。Acceptance: 无新增失败；Validation: `pnpm --filter @yeisme/dsh-client-ui-url-session run test && pnpm --filter @yeisme/dsh-url-session run test && pnpm --filter @yeisme/dsh-client-ui-url-session run typecheck && pnpm --filter @yeisme/dsh-url-session run typecheck`；Expected: exit 0；失败复查: 先分类 introduced/pre-existing/environmental。
- [ ] 7.2 [Owner: Harness Plugins；Scope: 仓门；Dependencies: 7.1, 5.3；Lane: final] 代码稳定后 `pnpm run check:bundles`、`pnpm run check:plugins`、`pnpm run check:surfaces`；若 UI 变更 `pnpm run test:visual` **只比对指纹，不跑 update-snapshots**。Acceptance: 基线仅人工确认差异后才更新；Validation: 记录 exit code；Expected: 插件协议门绿；失败复查: 禁止为清并行红灯改无关业务。
- [ ] 7.3 [Owner: Harness Plugins；Scope: 可选 host 集成；Dependencies: 7.1；Lane: optional-host] 若本机 staging `dsh web` 可用，用现有 Playwright/浏览器入口断言 `?s=` 切会话、切会话同步、刷新（query 或 path）、前进后退；证据写入 `temp/integration-test-runs/<run-id>/` 六件套。Acceptance: 环境缺失或官方 seam 不足时 **保持本项未勾**，不撤销 7.1/7.2；Validation: 真实命令，token 脱敏；Expected: 有证据才勾；失败复查: 不把 mock 当 live。
- [ ] 7.4 [Owner: Harness Plugins；Scope: OpenSpec + diff；Dependencies: 7.2, 1.2, 4.2, 5.4；Lane: final] `openspec validate dsh-url-session-v1 --strict --no-interactive` 与 `git diff --check`；确认 P4（锚点、mention 内跳、prefill）未混进完成声明。Acceptance: 能力账本 required 项均有任务；Validation: strict valid；Expected: valid 且 diff 无空白错误；失败复查: 不 archive、不 push。

P4（`#msg-<seq>`、`@session` 点击内跳、`?prompt=` 预填、多标签并发语义深化）不在本 change 勾选范围，保留在 proposal ledger 为 retain-next。
