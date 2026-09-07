# Mission Brief Provider Canary Procedure（任务 9.2）

> 本文件把预注册 scorecard（`details/mission-brief-slice-scorecard.md`）链接到 canary 执行步骤。
> **当前 0.2 production-promotion-blocked：无 approved provider，canary 不可执行。**
> product/security 批准 provider（0.2 解除）+ 4.2 adapter 接好后，按本 procedure 执行。

## 前提

1. 0.2 解除：product/security 指定 approved BriefGenerator provider + contract digest。
2. 4.2 adapter 接入：authenticated TLS + endpoint allowlist + service identity。
3. allowlisted test tenant + test project 配置完成。
4. staging 环境就绪（managed PostgreSQL + identity provider）。

## 执行步骤

```bash
# 在 staging 执行 canary（需 approved provider + managed session）
task release:canary SCENARIO=mission-brief ENV=staging
```

## 预注册指标（来自 0.5 scorecard）

### Safety gate（硬零容忍；任一 > 0 即停止）

| 指标 | 阈值 | 来源 |
| --- | --- | --- |
| 未经授权 action | 0 | 5.4 accept gate |
| 不可见 basis 被接受 | 0 | 2.6 validator |
| 跨 tenant 泄漏 | 0 | 3.2 repository |
| 直接 Owner mutation | 0 | registry dispatch |
| 重复 unknown_accept 重发 | 0 | 5.4 reconcile |
| raw prompt/output/token 泄漏 | 0 | 5.6 redaction |

### Outcome（≥60% vs Action Inbox baseline；14 天 ≥100 accepted item）

| 指标 | 阈值 |
| --- | --- |
| item-linked Task 推进率 | ≥60% |
| blocker/approval/delivery resolution | ≥baseline×1.2 |
| 有效 rescue（unknown→resolved 不重发） | ≥90% |

### Efficiency（time-to-first-safe-decision ≤ baseline p50）

| 指标 | 阈值 |
| --- | --- |
| time-to-first-safe-decision | ≤ baseline p50 |
| unresolved high-priority age | ≤ baseline ×0.7 |

### Quality（不用模型自评分）

| 指标 | 阈值 |
| --- | --- |
| invalid+duplicate rate | ≤10% |
| stale rate | ≤20% |

### Trust（≥80% 问卷正确）

| 指标 | 阈值 |
| --- | --- |
| 能解释"为什么现在处理" | ≥80% |
| 能发现 stale/degraded 标记 | ≥80% |
| accepted ≠ succeeded 区分 | ≥90% |

## Failure 停止条件

- 用户被迫 accept（无 free-form choice）
- 看完结果后改阈值（scorecard 预注册不可后改）
- fallback rules-only 样本混入 AI 样本（对照组污染）
- tenant/ref 高基数 metric label
- 无真实 Owner/Task 下游结果（fixture 替代）

## 当前状态

- **不可执行**：0.2 production-promotion-blocked（无 approved provider）。
- scorecard 已预注册（0.5 ✓），canary harness 文档就绪。
- product/security 批准 provider 后，按本 procedure + scorecard 执行 canary。
