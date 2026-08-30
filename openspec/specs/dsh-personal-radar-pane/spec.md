# dsh-personal-radar-pane Specification

(merged from archived change 2026-08-30-dsh-personal-radar-pane-v1)

## Purpose
Define the Drama Radar Pane surface inside DSH: capability-gated entry with honest degradation, typed intents revalidated by the host, dual text/icon badge states, edition_build-scoped refresh, safe typed refs for Workbench handoff, draft/canonical proposal separation, keyboard-accessible panes, and an installable verifiable bundle contract.

## Requirements

### Requirement: DSH 入口 MUST capability-gated 且诚实降级
Drama Radar badge、命令与 Pane 入口 MUST 由 capability probe 驱动：Radar binary 不可达、contract version 不匹配或官方 Pane slot 缺失时，入口 MUST 禁用或隐藏并显示 reason。插件 MUST NOT 使用私有 DOM、iframe 或 fork fallback 冒充完成。

#### Scenario: Radar ready
- **WHEN** probe 发现兼容 Radar capability 与可用 Pane slot
- **THEN** badge 显示 fit/new/freshness 摘要，命令可打开同 refs 的 Pane

#### Scenario: 官方 Pane seam 不可用
- **WHEN** 当前 DSH host 缺少所需公开 slot
- **THEN** 插件显示 disabled reason（如 `seam_unavailable`），不渲染死按钮

#### Scenario: Radar 未安装
- **WHEN** 固定 binary 不可达
- **THEN** 入口禁用并显示 `needs_radar` 与安装指引，不伪造 ready

### Requirement: 命令与 Pane 动作 MUST 生成 typed intent 并由 host 重新校验
`open/save/dismiss/compare/proposal/workbench/refresh` 命令解析 MUST 只生成 typed intent；host adapter MUST 重新校验 capability、lane、scope 与 idempotency。Pane MUST NOT 直接读数据库、执行 shell 或自行推断 mutation 成功。

#### Scenario: 未注册或越 lane intent
- **WHEN** intent 不在 allowlist 或超出当前 lane/capability
- **THEN** host adapter 拒绝并返回 stable reason code，不启动子进程

#### Scenario: 从 DSH 保存机会
- **WHEN** 用户运行 `/drama radar save <ref>`
- **THEN** host 提交 curator `feedback_add`，以 owner receipt 更新 Pane；重复 intent 不重复写反馈

### Requirement: badge 与 Pane 状态 MUST 文本+图标双表达
badge 与 Pane MUST 覆盖 ready、empty、degraded、stale、offline、permission_denied、contract_mismatch、action_pending、reconcile_required，每个非 ready 状态 SHALL 给安全 next action；状态不得只靠颜色表达。

#### Scenario: offline 只读
- **WHEN** Radar offline 且存在最近安全投影
- **THEN** badge/Pane 标记 offline 与 observed_at，mutation 禁用

#### Scenario: stale Edition
- **WHEN** Edition 超过 freshness 阈值
- **THEN** Pane 保留历史只读，禁用依赖 freshness 的 proposal/build，并给出 `refresh` 指引

### Requirement: refresh MUST 只允许 edition_build
`/drama radar refresh` SHALL 只经 operator lane 调用 `edition_build`，MUST NOT 触发 collect、daily_run 或任何外部采集；超时/断线后按 run/edition ref 对账，不自动重放。

#### Scenario: refresh 确认
- **WHEN** 用户运行 `/drama radar refresh`
- **THEN** host 显示确认（active profile revision、source freshness），确认后只调用 `edition_build`

#### Scenario: build 超时
- **WHEN** build outcome unknown
- **THEN** 进入 `reconcile_required`，按 run ref 查询新 Edition，不重新提交直到用户明确决定

### Requirement: Workbench handoff MUST 只携带安全 typed refs
`/drama radar workbench <ref>` 生成的 deep-link MUST 只含 edition/opportunity/profile revision refs 与 reason/evidence refs；Workbench 目标端 MUST 重新向 owner 读取 projection 并校验 digest/freshness。完整领域 payload MUST NOT 通过 URL 或客户端缓存传递。

#### Scenario: handoff 引用 stale Profile
- **WHEN** profile revision 不再是 active revision
- **THEN** Workbench 显示历史上下文并让用户选择按旧版审查或回到最新 Edition

### Requirement: proposal MUST 保持草稿与 canonical 生产分离
`/drama radar proposal <ref>` SHALL 只创建带 profile revision、reason/evidence refs、known limitations 与 target owner 的 pending review 草稿；未经人类 accept 与目标 owner receipt，MUST NOT 创建 canonical 剧本、分镜、生成 run 或 production acceptance。

#### Scenario: stale Profile 下创建提案
- **WHEN** 创建 proposal 时 Profile/Edition 已 stale
- **THEN** proposal 要求 refresh/review，不静默更新引用

### Requirement: Pane MUST 键盘可达且焦点可恢复
Pane SHALL 提供键盘等价、可见焦点、aria/text label、焦点恢复与窄屏降级；若存在终端/TUI renderer，`update(state, event)` 与 `render(state, width, height)` MUST 可确定测试并支持固定尺寸 snapshot。

#### Scenario: 键盘打开并保存机会
- **WHEN** 用户仅键盘导航到机会并触发 save
- **THEN** 焦点顺序稳定、状态被朗读、成功后焦点回到原机会上下文

#### Scenario: 窄屏
- **WHEN** 可用宽度不足展示 compare
- **THEN** compare 降级为顺序 detail 或提示需要更宽布局，不出现不可达控件

### Requirement: bundle 合同 MUST 可安装且可校验
Drama Radar 行 SHALL 作为可安装 bundle（声明 `dsh.bundle.patch`）发布；`pnpm run check:bundles` MUST 通过，未安装 bundle 时既有 DSH 行为不变。

#### Scenario: 未安装 bundle
- **WHEN** profile 未包含 Drama Radar 行
- **THEN** 无 badge/命令/Pane 入口，既有 Director Pack 行为不变
