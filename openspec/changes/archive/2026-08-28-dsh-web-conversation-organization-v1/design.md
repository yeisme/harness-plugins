## Context

现有 `sessionTags` 已提供按 SessionId 持久化的文本标签与行级 CAS，Client 已能通过 experimental grouping provider 在原生 Browser 中选择“按标签”。`ui-desktop-workbench` 也有会话列表，但依赖尚未真实化的 `SessionManagerHostV1`。本变更必须复用这些资产，同时保持 DSH 对 Workspace、Session 日志、搜索索引和生命周期 mutation 的唯一所有权。

公开面采用 additive 演进：旧 `sessionTags` Remote、`yeisme_session_tags_v1`、包名和 Web props 均不改变。新能力通过独立 `sessionOrganization` Remote 和 sidecar 加入。

## Goals / Non-Goals

**Goals:**

- 在 Workspace 内建立单功能类型、多标签的稳定组织模型。
- 提供自动分类、规则、批量预览/执行/撤销和临时管理员删除门。
- 保留原生侧栏，并提供独立的密集型管理页。
- 所有生命周期 mutation 以 DSH owner receipt 为成功依据。

**Non-Goals:**

- 不迁移会话 Workspace/cwd，不复制 Session 日志或全文索引。
- 不增加标签树、向量检索、团队角色系统或规则自动永久删除。
- 不把 prompt、完整对话、推理或 provider payload 写入组织 sidecar。

## Decisions

### 1. 新组织合同与旧 tags 合同并存

新增 `sessionOrganization` specVersion `1.0`，公开功能目录、assignment、标签目录元数据、规则和批次。`sessionTags.list/set` 保持原样；新服务需要标签材料时调用既有 sidecar，而不是复制每 Session 的标签真相。

新 domain `yeisme_session_organization_v1` 使用独立表保存：`functionTypes`、`assignments`、`tagCatalog`、`rules`、`batchRuns`。所有表都是 additive；卸载 bundle 不删除数据。

### 2. Assignment 以行级 CAS 和字段锁保护人工值

每个 Session assignment 包含 `functionTypeId`、`functionSource`、`functionLocked`、`tagsLocked`、`classificationStatus`、`confidence`、`version` 和更新时间。人工设置功能或标签后锁定对应字段；自动分类和自动规则不得覆盖锁定字段，显式批处理可在预览后覆盖。

### 3. 分类器是可注入 Host seam

Host 接收一个结构化 classifier port；生产适配器复用 DSH 已配置文本模型，测试使用纯 fake。输入只包含安全标题和用户消息，输出限定为已知功能 ID、候选标签和 `0..1` confidence。默认阈值为 `0.8`，自动创建新标签最多 3 个；不保存输入、raw output 或解释文本。

### 4. 规则与批次共享 plan/decisionRef

规则只生成分类、标签和归档意图。自动执行仅允许分类/标签；归档进入待确认 plan，永久删除没有规则 action。规则按 order 升序运行，功能字段首个写入胜出，标签动作顺序折叠。

`batch.plan` 返回不可变 target 版本、摘要和 `decisionRef`；`batch.execute` 必须带同一 ref，任一目标材料变化时拒绝 stale 项并返回 partial receipt。`batch.undo` 仅在当前版本仍等于批次写后版本时恢复 before snapshot。

### 5. 管理员门只保护永久删除

管理员解锁属于浏览器内存态，15 分钟或 reload 后失效。批量 purge 必须重新 plan、输入包含目标数量的确认短语，并等待 DSH owner 对每一项返回 terminal receipt；组织服务不自行删除 Session。

### 6. Web 使用现有两个 Client owner

`ui-session-tags` 增加功能分组 projection 和 assignment 快捷编辑。`ui-desktop-workbench` 新增 `ConversationManager` 表格/筛选/批次页面，通过显式 Host props 消费组织 Remote 与 DSH owner adapter；旧 `SessionSidebar` 和 `SessionManagerHostV1` 保持兼容。

原生 grouping alpha 合同仅增加可选 `parentId`、`color` 字段。旧 provider 不填写即可保持原行为；新 provider 用 Workspace 父组和功能子组表达两级结构。seam 缺失时不替换整块 sidebar。

### 7. 搜索只消费 DSH history owner

管理页的 content query 通过既有 `history.*` handoff 获取标题、元数据、用户/助手可见文本和 deep link。组织 Client 只合并安全结果与 organization snapshot，不创建前端索引。

## Risks / Trade-offs

- [DSH grouping/history seam 未发布] → 管理页保持可用，侧栏退回 Workspace 分组，正文搜索显示 capability reason。
- [跨表标签重命名部分完成] → 使用 durable batch 与 alias 投影，旧标签行通过后续 reconcile 收敛。
- [分类器错误或成本过高] → 单次触发、阈值门、人工锁和按 Workspace 回填；模型不可用时保留手工编辑。
- [批次中部分目标变化] → per-item stale receipt，不覆盖并发人工写入，用户重新预览。
- [管理员误操作] → 临时解锁、数量确认、owner preview 和 terminal receipt；purge 无撤销并明确标记。

## Migration Plan

1. 先发布 additive Host domain/Remote 和兼容测试，旧 bundle 行为不变。
2. Client 接入 organization snapshot；首次观察旧标签时按需建立 tag catalog metadata，不改 tags 行格式。
3. 接入管理页和侧栏功能 provider；上游 seam 未到位时 capability-probe 降级。
4. 近期活跃 Session 按用户配置回填；归档 Session 仅在显式批次中处理。
5. 回滚时移除组织 Client/Host bundle 行；旧 tags、Workspace Browser 与 Session 日志继续工作，新 domain 保留供重装恢复。

## Open Questions

无阻塞实现决策。完整 DSH history 搜索和生产模型适配仍按各自 owner handoff 交付；本仓实现可测试的 typed seam 与诚实降级。
