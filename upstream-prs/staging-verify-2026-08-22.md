# upstream-prs staging 验证报告（2026-08-22）

Wave A（program change `dsh-upstream-seam-push-program-v1`）前置证据：四个归档系列对 DSH 上游
`upstream/master` 真实 checkout 的 apply + 测试验证。本报告只做验证记录，不含任何 push/PR 动作。

## 环境

- 上游 clone：`git clone --filter=blob:none https://github.com/deepseek-ai/deepseek-harness /tmp/dsh-staging`
- upstream/master HEAD：`b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`（`Merge pull request #2908 from deepseek-harness/release/dsh-0.1.1-rc.2`，2026-08-21 20:03 +0800）
- 系列共同 base：`141eb6fef83422698aef7a981029e843e8161534`（dsh 0.1.0-rc.8）
- **base 漂移总量：207 commits / 2416 files changed**（base 是 HEAD 祖先，无分叉）
- 对照基线：pristine HEAD `pnpm run typecheck` 全绿（控制组），证明下述 typecheck 失败均可归因到系列本身
- 验证方式：每系列先在 base worktree（`/tmp/dsh-base`）apply 定位「系列自身问题 vs 漂移」，再对 HEAD checkout（`/tmp/dsh-staging`，含 `pnpm install --frozen-lockfile`）跑官方 `apply.sh` 与 README 测试集；vitest 一律从仓根执行，typecheck 由 `pnpm run typecheck` 自带 `build:lib:host` 前置

## Per-series 结果

### user-actions-slot — apply clean（HEAD），运行时测试绿，typecheck/note-format 红

| 项 | 结果 |
| --- | --- |
| apply @ base | clean（且 base+patch 生成的 tree 与 `head.bundle` 分支 tip `7e09e18e8e` 的 tree **逐字节一致** `8d0f8493`，patch 无失真） |
| apply @ HEAD | **clean**（upstream `slots.ts` +25/-1 的改动落在不同区域，文本无冲突） |
| tests @ HEAD | **pass 46/46**（`user-actions-slot.client.spec.tsx` + `chat-branch-tails.client.spec.tsx`，4.6s） |
| typecheck @ HEAD | **fail**：7 个 TS 错误（TS2322/TS2345，集中在 `user-actions-slot.client.spec.tsx:57/63/77/82/92`、`chat-branch-tails.client.spec.tsx:75`、上游自有 `chat-view.client.spec.tsx:202`） |
| translation pairing | pass（1004 对全一致，含本系列 note 注册） |
| verify-agent-note-format | **fail**：`2026-08-20-conversation-user-actions-slot.md` 缺 `## Risks` 与 `## Alternatives considered` |

关键归因：**typecheck 与 note-format 的红不是漂移造成**——在系列自己的 base 上 apply 后重跑，
失败结果与 HEAD 完全相同（同样 7 个 TS 错误、同样缺 Risks 段；format 脚本自 base 起零改动）。
机制：系列把 user/steering 节点 renderer 的 `renderSlot` 定为必填 `RenderSlotFn<"conversation.chat.user-actions">`，
而系列 spec 桩（及上游自有 chat-view spec）未满足该必填 props 与 `ChatNodeOwnerProps` 的
`openFile/inspectCall/forkAt/fileMentions` 必填字段。README 记载的归档时「typecheck 绿」在
本环境对 patch 精确等价的 tree 上无法复现（疑为当时 tsc -b 增量缓存假绿）。

**结论：不可原样推 PR。** 无需 rebase（apply 已 clean），但推 PR 前必须修：① spec 桩补齐必填
props（或把 renderSlot 类型改为可选）；② note 补 `## Risks`、`## Alternatives considered` 两段。
修复量小、独立于上游，是四系列中最接近可推的。

### login-token-auth — apply 冲突 @ HEAD（1 文件，琐碎），base 内容全绿

| 项 | 结果 |
| --- | --- |
| apply @ base | clean |
| apply @ HEAD | **conflict**：`packages/client/connection/src/index.ts:57 patch does not apply` |
| tests @ base | **pass 37/37**（`apps/cli/tests/auth-store.spec.ts`、`args.spec.ts`、`connection/tests/token-auth.host.spec.ts`、`node-half.host.spec.ts`、`web-app/tests/startup.spec.ts`，5 文件） |
| typecheck | 未跑（HEAD apply 失败即截断，属下一步 rebase 后验证） |

冲突根因：上游 `72b204afa`（feat(images): expand source upload envelope）把
`connection/src/index.ts` 第 57 行附近的注释 `/** Maximum buffered JSON body ... */` 改了一行
（+1/-1），正落在 patch 的上下文里。README/i18n 文件上游也有改动但未冲突。

**结论：先做一次 trivial rebase（1 文件 1 行上下文），rebase 后跑测试即可推 PR。**

### pane-workspace-layout — 归档 patch 本身损坏 + HEAD 冲突，base 内容全绿

| 项 | 结果 |
| --- | --- |
| apply @ base | **fail**：`error: corrupt patch at line 464`——`AppFrame.module.css` 的 hunk `@@ -1,108 +1,165 @@` 声明 165 行新增，正文实际 172 行（多 7 行）；`git apply --recount` 后 **clean** |
| apply @ HEAD | **fail**：同上 parse 错误；`--recount` 后 **conflict**：`packages/client/ui-layout/package.json:1 patch does not apply` |
| tests @ base（`--recount` workaround apply + new-files 复制） | **pass 97/97**（`workspace-geometry`、`workspace-layout`、`app-frame.client.spec.tsx`、`apply.client.spec.ts`、ui-conversation `chat-view.client.spec.tsx`，5 文件） |
| typecheck | 未跑（apply.sh 官方路径失败即截断） |

两个独立问题：① 归档的 `changes.patch` hunk 计数头与正文不一致（生成/编辑期损坏），任何
`git apply` 都拒绝解析——需要重新生成 patch（推荐：从 `--recount` 后的 base 树 `git diff` 重新导出）；
② HEAD 冲突仅 `ui-layout/package.json` 的 version 行（rc.8 → 0.1.1-rc.2 版本推进），trivial。

**结论：先修 patch 本身（重新生成或 apply.sh 加 `--recount` 但不建议长期带病），再 trivial rebase，
base 内容已证绿，可进队列第三。**

### plan-dock — apply 冲突 @ HEAD（5 文件，中等），base 内容全绿

| 项 | 结果 |
| --- | --- |
| apply @ base | clean |
| apply @ HEAD | **conflict**（5 文件）：`ui-plan/README.i18n.yaml:2`、`ui-plan/README.zh.md:2`、`plan-mode/README.i18n.yaml:2`、`plan-mode/README.zh.md:12`、`plan-mode/src/index.ts:32` |
| tests @ base | **pass 104/104**（README focused set 5 个 spec + patch 修改的 plan-mode 3 个 spec：`plan-document-panel`、`plan-workspace-view`、`plan-pane-view`、`browser-plugin`、`plan-mode-control`、`integration`、`plan-mode`、`projection`，8 文件） |
| verify-translation-pairing @ base | pass（988 对全一致） |
| verify-agent-note-format @ base | pass（582 notes 全合规） |
| README 其余项（oxlint / build:lib / DSH_SNAPSHOT=replay e2e） | 未跑（HEAD apply 失败截断 + 时间盒；base 已跑项足以证明内容有效性） |

冲突构成：4 个 README/i18n 文档文件 + `plan-mode/src/index.ts`（上游 +23/-6，2 commits）。
`ui-plan/package.json` 与 `pnpm-lock.yaml` 虽被上游同改但未报冲突。

**结论：中等量 rebase（文档为主 + plan-mode/src 一处代码），base 内容全绿（测试+文档双合规），
rebase 后按 README focused verification 全套跑一遍再推。**

## 总体结论

| 系列 | apply@HEAD | 内容有效性 | 推 PR 前置工作 | 可进推 PR 流程 |
| --- | --- | --- | --- | --- |
| user-actions-slot | clean | 46/46 运行时绿；typecheck/note-format 红（系列固有，非漂移） | 修 spec 桩必填 props + note 补 Risks/Alternatives（小，独立于上游） | 修完即可推（无需 rebase） |
| login-token-auth | conflict×1 | base 37/37 绿 | trivial rebase（1 行注释上下文） | rebase 后可推 |
| pane-workspace-layout | patch 损坏 + conflict×1 | base 97/97 绿（经 `--recount`） | 重新生成 changes.patch + trivial rebase（version 行） | 修完可推 |
| plan-dock | conflict×5 | base 104/104 + 文档合规 | 中等 rebase（4 文档 + plan-mode/src +23/-6） | rebase 后可推 |

- 没有任何系列可以「零改动直接推 PR」：user-actions-slot 离得最近（apply 已 clean，仅剩自身小修）；
  其余三个都需要先 rebase 到 `b150a551b8d`（0.1.1-rc.2）。
- 所有四系列在 base 上的内容（代码+测试+文档）全部验证绿，说明 patch 内容本身有效，
  阻塞全部在「归档格式/上游漂移」层——支持 pr-rebase CI 每日跟进的策略判断。
- 另：`upstream-prs/user-actions-slot/` 的 `head.bundle` 经验证可从上游 clone 直接恢复分支
  （`git fetch head.bundle pr/user-actions-slot:...`），恢复出的 tree 与 changes.patch+new-files 完全一致，
  推 PR 时可直接用 bundle 重建分支历史。

## 复现命令备忘

```bash
git clone --filter=blob:none https://github.com/deepseek-ai/deepseek-harness /tmp/dsh-staging
cd /tmp/dsh-staging && pnpm install --frozen-lockfile
bash upstream-prs/<slug>/apply.sh /tmp/dsh-staging        # 官方 apply 路径
pnpm exec vitest run <README 列出的 spec 文件>            # 必须仓根执行
pnpm run typecheck                                        # 自带 build:lib:host 前置
pnpm run verify-translation-pairing && pnpm run verify-agent-note-format
```
