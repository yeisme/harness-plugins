## ADDED Requirements

### Requirement: seam 系列生命周期
每个 `upstream-prs/<slug>/` 系列 SHALL 按固定生命周期推进：patch 就绪 → PR staging worktree 内 apply 并通过 dsh 仓对应测试 → 推 `yeisme/deepseek-harness` 分支 → 在 `yeisme/deepseek-harness` 开 fork review PR 并登记 compare URL。本 program 的验收止于 fork review PR；MUST NOT 要求向 `deepseek-ai/deepseek-harness` 开官方 PR。插件侧在发布版 DSH 上 MUST 继续 capability probe；只有探测到 seam 才直连，未探测到时保持禁用+原因。系列 README 在 fork review PR 登记后标记 `fork-ready`，官方合入后才改为 `merged`。

#### Scenario: staging 验证不通过则不推送
- **WHEN** 系列在 staging worktree apply 后 dsh 仓测试失败
- **THEN** 该系列不得推 fork 分支，须先修复 patch

#### Scenario: fork review PR 即完成推送验收
- **WHEN** 系列已 rebase 到当前 upstream/master、staging 测试绿、且 `yeisme/deepseek-harness` 上存在对应 fork review PR
- **THEN** 该系列的推送任务 SHALL 可勾选
- **AND** README MUST 同时登记 fork PR 与 `deepseek-ai/deepseek-harness` compare URL

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
