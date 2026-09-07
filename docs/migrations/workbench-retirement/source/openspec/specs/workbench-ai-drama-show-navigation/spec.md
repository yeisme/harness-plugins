# workbench-ai-drama-show-navigation Specification

## Purpose
TBD - created by archiving change workbench-ai-drama-show-control-room-v1. Update Purpose after archive.
## Requirements
### Requirement: Create Show 必须使用 proposal

Create Show SHALL 把用户输入转换为 typed proposal 并进入 Proposal authority/TaskService。Workbench MUST NOT 直接写 Auctra、Eikona、Sonora 或 Scaena canonical state。

#### Scenario: 部分 owner 不可用

- **WHEN** Create Show proposal 被部分 owner 接受而其他 owner needs_contract
- **THEN** Workbench SHALL 显示 owner-by-owner readiness
- **AND** MUST NOT 宣称整部剧已经创建完成

### Requirement: Create Show 三入口与 DSH handoff 必须 fail-closed

Create Show SHALL 提供 Agent 对话、项目页与 DSH Director Pack 三个统一入口。DSH handoff SHALL 只携带 `workbench.harness.dsh_bridge.v1alpha1` 的 closed 字段（safe refs、来源 surface、嵌入模式与 handoff nonce），MUST NOT 携带 session token、credential、raw prompt、provider payload、private path 或 artifact bytes。目标端 server SHALL 重新验证 handoff 引用的 context 与 revision；在 Create Show proposal contract 注册前，所有入口 SHALL 显示 needs_contract 且 SHALL NOT 渲染可提交的向导。

#### Scenario: Server 合同未注册

- **WHEN** 用户从任一入口打开 Create Show 而 Create Show proposal Operation 尚未注册
- **THEN** Workbench SHALL 显示 needs_contract 与入口来源
- **AND** SHALL 禁用向导提交，不渲染伪造的创建控件

#### Scenario: DSH handoff 携带不安全字段

- **WHEN** DSH handoff payload 包含未知字段、raw URL、credential/token 字段名或非法 mode
- **THEN** Workbench SHALL 整体拒绝该 handoff 并显示 contract_mismatch
- **AND** MUST NOT 部分解析或打开任何目标

#### Scenario: Handoff context 需要重验

- **WHEN** DSH handoff 通过结构校验但 server 无法重新验证其 context revision
- **THEN** Workbench SHALL 进入 reconcile_required
- **AND** MUST NOT 依据 handoff 自带 revision 定位 show 或 episode

### Requirement: Creative production MUST open as a Spatial Lens
Show、Episode、Series Bible、Asset、Review、Run/Evidence、Delivery and Next Episode navigation MUST resolve to the `/agent` Creative Production Lens with validated safe refs and current owner projection. Workbench MUST not mount an independent Show application shell.

#### Scenario: DSH opens an existing Episode
- **WHEN** a valid DSH handoff is revalidated by the server
- **THEN** `/agent` MUST open the Creative Production Lens focused on the authorized show/episode refs
- **AND** the Lens MUST reread owner projection rather than trusting the handoff revision

