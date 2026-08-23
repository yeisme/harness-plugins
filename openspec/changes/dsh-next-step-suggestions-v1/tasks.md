## 1. 设计冻结与 OpenSpec

- [x] 1.1 [Owner: Harness Plugins；Scope: `openspec/changes/dsh-next-step-suggestions-v1/`；Dependencies: none] 评审并冻结 `NextStepSuggestionV1` 契约、composer dock 渲染与“点击只填草稿”交互。Acceptance: proposal/design/spec 一致且无必需能力被删除；Validation: `openspec validate dsh-next-step-suggestions-v1 --strict --no-interactive`；失败复查: 缺能力先修正 proposal/spec。
- [x] 1.2 [Owner: Harness Plugins；Scope: `specs/next-step-suggestions/spec.md`；Dependencies: 1.1] 编写 requirement spec，覆盖渲染、点击不提交、多选、并行组合、plan-options 来源与安全边界。Acceptance: spec 可通过 strict validation；Validation: `openspec validate dsh-next-step-suggestions-v1 --strict --no-interactive`。

## 2. Client 插件骨架

- [x] 2.1 [Owner: Harness Plugins；Scope: `packages/client/ui-next-step-suggestions/`；Dependencies: 1.1] 初始化 `@yeisme/dsh-client-ui-next-step-suggestions@0.1.0-rc.1`，配置 client exports、scripts、README 与测试。Acceptance: `pnpm --filter @yeisme/dsh-client-ui-next-step-suggestions run build` 通过；Validation: package build。
- [x] 2.2 [Owner: Harness Plugins；Scope: `src/client/types.ts`；Dependencies: 2.1] 定义 `NextStepSuggestionV1`、`SuggestionSource` 与本地 `PlanOptionsProjectionValue` 类型。Acceptance: 类型可编译；Validation: `pnpm --filter @yeisme/dsh-client-ui-next-step-suggestions run typecheck`。
- [x] 2.3 [Owner: Harness Plugins；Scope: `src/client/suggestion-composer.ts`；Dependencies: 2.2] 实现 append/applySelected/composeParallelPrompt 纯函数。Acceptance: unit tests 全绿；Validation: `pnpm --filter @yeisme/dsh-client-ui-next-step-suggestions run test`。

## 3. UI 组件

- [x] 3.1 [Owner: Harness Plugins；Scope: `src/client/SuggestionChip.tsx`；Dependencies: 2.3] 实现单个 chip：单选/多选、推荐徽标、来源 tooltip、键盘。Acceptance: component tests 全绿；Validation: `pnpm --filter @yeisme/dsh-client-ui-next-step-suggestions run test`。
- [x] 3.2 [Owner: Harness Plugins；Scope: `src/client/SuggestionDock.tsx`；Dependencies: 3.1] 实现 dock：读取 sources、多选状态、`应用到输入框`/`并行执行`、空态隐藏。Acceptance: component tests 全绿；Validation: `pnpm --filter @yeisme/dsh-client-ui-next-step-suggestions run test`。
- [x] 3.3 [Owner: Harness Plugins；Scope: `src/client/index.ts`；Dependencies: 3.2] 注册 `conversation.input.dock` 并接入 `inputActions.setDraft`；注册 locales。Acceptance: 注册 effect-scoped 且可 dispose；Validation: `pnpm --filter @yeisme/dsh-client-ui-next-step-suggestions run typecheck`。

## 4. plan-options 来源

- [x] 4.1 [Owner: Harness Plugins；Scope: `src/client/plan-options-source.ts`；Dependencies: 2.2] 实现 `planOptionsToSuggestions()`：读取 `plan-options` projection 并转换为 suggestions。Acceptance: unit tests 覆盖缺失/推荐/parallelSafe；Validation: `pnpm --filter @yeisme/dsh-client-ui-next-step-suggestions run test`。
- [x] 4.2 [Owner: Harness Plugins；Scope: `src/client/sources.ts`；Dependencies: 4.1] 实现 client source registry：`registerSource`、合并、去重、排序。Acceptance: unit tests 全绿；Validation: `pnpm --filter @yeisme/dsh-client-ui-next-step-suggestions run test`。

## 5. Bundle 与文档

- [x] 5.1 [Owner: Harness Plugins；Scope: `packages/bundle/dsh-next-step-suggestions/`；Dependencies: 3.x, 4.x] 创建 `@yeisme/dsh-next-step-suggestions` bundle，组合 client 插件行与 `cordis.patch.yml`。Acceptance: `pnpm --filter @yeisme/dsh-next-step-suggestions run build` 通过；Validation: package build。
- [x] 5.2 [Owner: Harness Plugins；Scope: `packages/bundle/dsh-next-step-suggestions/README.md`；Dependencies: 5.1] 编写安装/启用/回滚/限制说明。Acceptance: 使用真实 `dsh plugin add`/profile 命令；Validation: `pnpm --filter @yeisme/dsh-next-step-suggestions run build`。
- [x] 5.3 [Owner: Harness Plugins；Scope: `packages/client/ui-next-step-suggestions/README.md`；Dependencies: 3.x] 编写 client 包 README（中英或中文为主）。Acceptance: 文档说明点击不发送、多选/并行语义；Validation: doc build。

## 6. 后续推进目标（retain-next）

- [x] 6.1 [Owner: Harness Plugins + DSH Host；Scope: `packages/host/next-step-suggestions/`；Dependencies: 4.2] 裁决 host 侧 `ctx.nextStepSuggestions` registry 与 `next-step-suggestions` projection 的 V1 范围（原任务为实现，冻结决策改为范围裁决）。Acceptance: 裁决与 proposal Required Capability Ledger（optional/retain-next）和 design 一致并记录证据；Validation: `openspec validate dsh-next-step-suggestions-v1 --strict --no-interactive`。（retain-next: V1 使用 client-local source registry）
  - Evidence: 冻结结论为 V1 不实现 host 侧 registry/projection（design「不实现 host 侧跨插件 registry/projection（retain-next）」）。deliver-now 范围已由 `src/client/sources.ts` 的 client-local source registry 交付（`registerSource`/合并/去重/排序，unit tests 覆盖，见 4.2）；host 侧跨 profile/跨进程贡献待真实多插件需求出现后另立 change，本 change 不预留半成品 seam。
- [x] 6.2 [Owner: Harness Plugins；Scope: `src/client/`；Dependencies: 3.2] 裁决助手消息尾部（`conversation.chat.turnTail`）建议入口的 V1 范围（原任务为实现，因上游 seam 缺席改为范围裁决）。Acceptance: 裁决记录上游 seam 依赖与后续实现通道，无 DOM patch/死入口；Validation: `openspec validate dsh-next-step-suggestions-v1 --strict --no-interactive`。（retain-next: 需要上游 turnTail seam 或额外 slot）
  - Evidence: 冻结结论为 V1 建议入口只落在 composer dock（`conversation.input.dock`，见 3.2/3.3）。turnTail 入口依赖上游 `conversation.chat.turnTail` seam 或额外官方 slot，当前均不存在；按 Upstream Seam Channel 规则须经 `upstream-prs/<slug>/` 另立 seam change 后再实现。点击填草稿主路径已由 dock + `inputActions.setDraft` 覆盖。
- [x] 6.3 [Owner: Harness Plugins；Scope: `src/client/suggestion-composer.ts`；Dependencies: 3.2] 增加“替换/追加”用户偏好。Acceptance: 设置可切换；Validation: component tests。（retain-next: 当前默认追加）
  - Evidence: `suggestion-composer.ts` 新增 `SuggestionApplyPreference`('append'|'replace') 与 `applyPrompt(current, prompt, preference)`（replace 模式写入 trim 后的 prompt，append 保持既有空草稿替换/非空换行追加语义）、`applySelected(..., preference)`（replace 模式以选中 prompt 按序拼接整体替换草稿）。`SuggestionDock` 控制行新增「替换草稿」切换（locale zh/en），偏好经可注入 `SuggestionStorage` seam 持久化（默认安全访问 window.localStorage，不可用时退化为进程内状态；只存枚举值），chip 点击与多选 apply 均走偏好。Validation: `pnpm --filter @yeisme/dsh-client-ui-next-step-suggestions run test` 23/23（含 3 个新 dock 组件用例：切换后 chip 替换、跨 remount 持久化、多选 apply 替换）＋ typecheck/build 绿。默认仍为追加（retain-next 注记保持不变，6.1/6.2 未动）。
