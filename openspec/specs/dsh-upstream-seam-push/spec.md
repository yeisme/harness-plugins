# dsh-upstream-seam-push Specification

## Purpose
TBD - created by archiving change dsh-upstream-seam-push-program-v1. Update Purpose after archive.
## Requirements
### Requirement: seam 系列生命周期
每个 `upstream-prs/<slug>/` 系列 SHALL 按固定生命周期推进：patch 就绪 → staging worktree 内 apply 并通过 dsh 仓对应测试 → 推 `yeisme/deepseek-harness` 的 `pr/<slug>` → 登记 compare URL。本 program 的验收止于分支 + compare；MUST NOT 向 `deepseek-ai/deepseek-harness` 开官方 PR，MUST NOT 在 fork `master` 上开审查 PR。插件侧在发布版 DSH 上 MUST 继续 capability probe；只有探测到 seam 才直连，未探测到时保持禁用+原因。系列 README 在分支登记后标记 `fork-ready`，官方合入后才改为 `merged`。

#### Scenario: staging 验证不通过则不推送
- **WHEN** 系列在 staging worktree apply 后 dsh 仓测试失败
- **THEN** 该系列不得推 fork 分支，须先修复 patch

#### Scenario: 分支 + compare 即完成推送验收
- **WHEN** 系列已 rebase 到当前 upstream/master、staging 测试绿、且 `yeisme/deepseek-harness` 上存在 `pr/<slug>`
- **THEN** 该系列的推送任务 SHALL 可勾选
- **AND** README MUST 登记分支名与 `deepseek-ai/deepseek-harness` compare URL
- **AND** MUST NOT 在 fork `master` 上开审查 PR

#### Scenario: 发布版未合入时保持 probe
- **WHEN** 发布版 DSH 尚未包含该 seam
- **THEN** 对应插件 MUST 继续 probe 并诚实降级，MUST NOT 假设官方已合入

### Requirement: 推送波次按解锁价值排序
seam 推送 SHALL 优先解锁差异化 lane 的插件任务（user-actions、cookieJars、forkBeforeMessage、previewResource），commodity-parked 的 Terminal seam 排后。

#### Scenario: 排序决策可追溯
- **WHEN** 波次顺序被质疑
- **THEN** 以本 change tasks 的 Wave 分组与 proposal 映射表作为依据

### Requirement: 自动化激活先行
Wave A 开始前，ci.yml / upstream-canary.yml / pr-rebase.yml SHALL 已在远端真实运行过至少一次且结果闭环（绿或红灯 issue 处理完成）。

#### Scenario: 自动化从未运行时不得开始推 PR
- **WHEN** workflow 无任何 run 记录
- **THEN** Wave A 任务不得勾选

### Requirement: 插件完成与 host 推送分离
插件 change 的完成验收 SHALL 只包含本仓库协议探测、包测试与 bundle 合同。MUST NOT 把官方 DSH 合入、官方 `dsh web`、真实 profile Playwright、fork `master` 审查 PR 或 host 几何实现列为插件 SHALL。fork `master` SHALL 跟踪上游 `master`。

#### Scenario: 官方未合入仍可完成插件任务
- **WHEN** `pr/<slug>` 已推送、compare URL 已登记且插件 probe 测试通过
- **THEN** 对应插件解锁任务 SHALL 可勾选
- **AND** MUST NOT 等待 `deepseek-ai/deepseek-harness` merge

#### Scenario: OpenSpec 不得 MODIFIED 不存在的主 spec
- **WHEN** 目标 `openspec/specs/<capability>/spec.md` 不存在
- **THEN** 该 change 的 delta SHALL 只使用 `ADDED`
- **AND** `openspec archive` MUST NOT 因 MODIFIED 不存在的 spec 而成为插件完成阻塞

