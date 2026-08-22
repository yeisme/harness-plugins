## ADDED Requirements

### Requirement: seam 系列生命周期
每个 `upstream-prs/<slug>/` 系列 SHALL 按固定生命周期推进：patch 就绪 → PR staging worktree 内 apply 并通过 dsh 仓对应测试 → 推 `yeisme/deepseek-harness` 分支 → 向 `deepseek-ai/deepseek-harness` 提 PR → 合入后插件侧摘降级并在系列 README 登记 merged 状态。任何系列 MUST NOT 在未合入状态下被插件侧直接依赖。

#### Scenario: staging 验证不通过则不推送
- **WHEN** 系列在 staging worktree apply 后 dsh 仓测试失败
- **THEN** 该系列不得推上游 PR，须先修复 patch

#### Scenario: 合入后摘降级
- **WHEN** 上游发布含该 seam 的版本且 canary 绿
- **THEN** 对应插件将 probe 降级路径替换为正式 slot 接线，并在 owner change 勾选解锁任务

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
