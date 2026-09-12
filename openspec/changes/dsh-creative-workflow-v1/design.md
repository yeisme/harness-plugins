## Context

依据 2026-09-07 创作台程序 §3。Ordo 托管工作文档与既有 dsh-ordo-agent-ops 是跨领域执行的唯一通道；画布 document 由 canvas change 拥有。

## Goals / Non-Goals

目标：画布上可编辑执行连接、预览将执行的范围、显式确认并观察运行，重开可恢复观察。

不做执行循环、调度器、审批账本、隐式类型转换、静默扩大范围，或把画布草案当执行账本。

## Decisions

1. Owner-fit：split-owner。本仓拥有执行边/草案编辑与预览呈现；Ordo 拥有跨领域计划、调度、预算与恢复；领域 owner 拥有单领域 workflow。
2. 执行边带输出版本与输入用途；参考边不参与执行。连接不兼容保留草案并显示原因，禁止隐式转换。
3. 分支范围=从选定节点沿执行边可达的下游；执行图有向无环，迭代通过新运行或复制分支表达。
4. 范围外输入必须已有可用固定版本，否则列为阻塞；确认预览冻结输入/参数/版本/计划摘要。
5. 预算 unknown 显示 unknown 并要求显式确认；owner 可因预算合同不满足拒绝。运行中编辑只影响下一份草案。
6. 运行观察复用 Ordo 投影订阅；unknown 只对账原 operation；关闭 Pane 不取消运行，刷新/恢复不重放命令。
7. 上游修改标记受影响节点并保留已采用结果；重跑只产生新候选，用户比较采用后才推进。

## UI Contract

- Surface classification: embed（画布节点/边内嵌）+ adopted inspector（运行预览/观察）
- Surface kind: workspace（预览与观察 Pane）
- First / second / third visual priority: 将执行的节点与范围 / 确认动作 / 阻塞与版本证据
- Existing components reused: 画布 renderer（canvas change）、ui-visual-kit token、Ordo 面板组件
- Cards that earn existence: 运行观察卡（状态/进度/阻塞）；无进度卡片墙
- Primary scroll owner: 范围列表/运行观察；参数独立滚动

### State Matrix

| Feature | Loading | Empty | Error | Success | Partial/Stale | Disabled |
|---|---|---|---|---|---|---|
| 执行图编辑 | — | 无节点说明 | 校验错误 | 草案保存 | 不兼容草案保留 | 无权限节点 |
| 范围预览 | 解析中 | 未选择说明 | 图错误 | 范围+阻塞清单 | 范围外输入未固定 | 阻塞不可确认 |
| 运行观察 | 订阅中 | 无运行 | owner 错误 | 状态/进度 | gap 重读 | 未确认禁用 |

### Responsive

| <=420px | 421–720px | >720px |
|---|---|---|
| 单栏+返回；范围折叠 | 导航/内容切换 | 画布+预览/观察并列 |

### Accessibility

- Keyboard path: 选节点→选范围→预览→确认全程键盘；Escape 回发起节点
- Focus owner/return: 发起节点；完成后回节点或观察卡
- Visible labels and accessible names: 范围/阻塞/预算态文本化
- Reduced motion and coarse pointer: 动画可关；触控 ≥44px

## Validation

focused reducer/适配测试先行；稳定后全门禁。真实跨领域运行在 Ordo staging 验证并标注 fixture/real。证据写 `temp/integration-test-runs/<run-id>/`，脱敏 owner payload。

## 创建入口、页面与任务边界

[工作流页面](../../../docs/design/dsh-creative-workflow.md)定义模板、手动连线和Agent草案三种入口；均编辑画布change拥有的同一document，不创建额外图模型。模板不携带旧权限，Agent修改给出摘要与撤销，执行另确认。

运行预览由节点/范围列表、固定输入、已知费用和未知项、缺口、人工审阅点组成。确认前草案revision变化即失效。单领域步骤和内部workflow直接进入领域owner；只有跨领域计划由Ordo执行，缺适配任务归agent/ordo，不阻塞专业Pane。第4组验收依赖新增5.1–5.4。

单owner返回多个候选而下游要求一个输入时，必须在流程设计中放人工选择或owner支持的显式选择规则；没有选择时暂停，不自动以最新结果继续。范围扩展和预算变化重新确认；人工审阅只解锁计划中已授权的范围。

视觉例外：无。完整组件复用、内容与control分离、版本迁移、关入口仍可恢复和证据规则见[公共合同](../../../docs/interfaces/dsh-creative-studio-contracts.md)。默认关闭新跨领域执行入口；原单领域运行继续可见且可对账。新schema additive，不重解释既有Ordo plan/grant或Workbench标识。
## 原操作查询身份的持久恢复索引

分类 fit：Host 可保存原请求键、安全目标引用与上下文，帮助用户重开界面后找到原操作；执行事实仍由领域 owner/Ordo 提供。新增 `yeisme_creator_recovery_v1` storage domain，只存版本化 `creator.operation-recovery.v1alpha1` 原查询身份、目标版本和 descriptorRef，不保存正文、values、receipt、运行状态、预算或任务调度信息。旧画布存储和既有 API 不改变。

每个 tenant/workspace/project/principal 下，同一 owner/action/target 只保留一个原请求。保留请求须等待 durable put，重复请求返回原记录，不能覆盖请求键；存储确认丢失也不得再次执行。一个 Host 实例拥有该 domain 的写队列。跨会话可恢复同身份项目记录，其他 principal/project 不可读；读取保留原上下文，不自行伪造新执行授权。

每项目最多 128 条未清理身份，达到上限时明确阻止新增，不淘汰旧记录。只有可信 Host 在 owner 已确认后可按完整原记录清理；删除失败保留恢复入口。回滚关闭新域消费，保留记录用于恢复，无正文迁移。

当前实现为 `OperationRecoveryStore` 与协议/真实 storage-domain 测试。尚未挂入 Gateway dispatch 的发送前持久化，也未增加浏览器恢复列表和 controller 再绑定；这些未完成时不能宣称关闭浏览器后恢复已实现。后续恢复仅提交原键对账，不自动恢复执行。
## Gateway 发送前持久化接入

Gateway 运行路径仅挂载 `OperationRecoveryStore`；旧 `OperationIdentityStore` 导出保留兼容并标记 deprecated，不在 Gateway 加载，也不删除旧域文件。dispatch 在 owner 预览校验后 reserve 原查询身份，durable put 成功且上下文/adapter 未变才发送。已有记录阻止再次执行，存储错误/容量满阻止发送。无 storage seam 的既有调用保持兼容，但不能据此宣称持久恢复能力已具备。

unknown、pending、partial、accepted 保留原身份；只在匹配 owner/action 的 completed/failed/rejected 后按完整原记录清理。对账必须提交存储中的原键，不能用新键静默替换。跨会话召回保留原键，以当前已验证上下文执行只读查询；当前上下文变化时不返回记录。恢复索引不授予旧执行权限，也不保存 owner 状态真相。

真实 HTTP 测试入口现使用实际 DSH storage-domain/JSON backend，再连接实际 Auctra 服务；浏览器断线采用和重建 adapter 原键查询复用该路径。独立 Gateway 测试覆盖 owner 调用前已有记录、落盘确认失败零发送、新 Gateway 查原键、重复键拦截、精确清理和迟到读取隔离。浏览器完整关闭后的 UI 呈现与草稿恢复继续单独验收。
## 客户端原键预检

controller 在执行前调用可选 recallOperationIdentity；存在匹配 owner/action/target 与完整当前上下文的原身份时，只进入 reconcile_required，不发送替代请求。新生成的本地键不能遮蔽 Host 原键。召回错误或非法跨身份/项目记录失败关闭；异步召回期间 generation/context 改变，不继续 dispatch 或重新绑定旧 flight。

reconcile 也可重新召回持久身份，因此新 controller 或此前被 Gateway 原记录拦截的界面都能使用原键查询，values 不随对账发送。旧 Host 未提供可选 recall 方法时保留既有调用行为，其持久恢复保证不能视作通过。此预检不是主动恢复列表 UI，浏览器完整关闭后的入口展示仍须独立实现和验证。
## 主动恢复入口 UI Contract

增量 Remote `listOperationRecoveries@1` 返回 `creator.operation-recovery-page.v1alpha1`：当前受验证上下文、最多 128 个原查询请求与目标版本；没有正文、values、receipt 或可执行 descriptor。旧 API 不改变，缺新方法时 unavailable。controller 新增只读列表及 `reconcileStoredOperation`，不构造执行预览、不调用 dispatch；同项目不同 principal 的内存 flight 也隔离。

成果工作区在有对象或空对象时均可显示「待核对的操作」，仅列当前 owner 的记录。复用统一视觉系统的 Button、SurfaceState、cs-muted 和 vk-btn；无新主壳、配色或弹窗。加载只读 Host 索引，用户点「查询上次结果」才查询 owner；显示确认完成、确认失败或仍未确认，未确认保留入口。查询中禁用重复点击，切项目卸载后丢弃迟到结果；已完成则刷新列表，不自动重跑或写回正文。所有新增文案中英齐备。

真实浏览器验收关闭整个 Chromium，清空测试端 browserRequest/browserReceipt，再启动新浏览器；恢复入口无需先点击执行，即可从 Host 文件发现原请求并查询，owner PUT 不增长。该场景恢复的是已提交但回执丢失的保存，不能替代未提交草稿的持久化验收。

## 输入变化的项目草稿标记

操作节点增量增加可选 `inputReviewRequired: true`，仅表示画布输入草案自上次确认基线后有变化，需要用户审阅。它随原 ProjectCanvasDocument 保存，并进入原撤销历史；缺省表示没有本地标记，不证明 owner 结果新鲜。该字段不是运行状态、审批或执行授权，不能清除已采用 artifact，也不能自动重跑。

正文/参数/固定引用及执行输入映射变化沿前后执行图计算受影响操作并设置标记；相机、几何、标题、参考边不设置。旧文档没有新增必填字段；旧 strict consumer 遇到新字段必须通过现有版本/能力协商升级或拒绝读取，不允许静默丢弃字段后写回。标记清除留给后续明确的 owner 输入快照确认，不新增“忽略所有”按钮。
