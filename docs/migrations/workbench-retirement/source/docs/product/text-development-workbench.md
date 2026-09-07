# Text Development Workbench 产品定义

> 状态：`active proposal`
> OpenSpec：`workbench-text-development-studio-v1`
> 首批用户：个人创作者
> 首批成熟度：Novel local Beta；Screenplay first-support candidate；Self-media exploratory

## 1. 产品任务

Text Development Workbench 让创作者在一个持续挂载的 `/agent` 工作环境中完成：人工写作、选区问询、Agent 候选改写、结构化知识编辑、Team Plan、Checkpoint、Review 和版本晋级。

它不是 Auctra GUI 的复制品。Workbench 负责体验组合，Auctra 负责正文和版本，Conversation Runtime 负责 Pi 会话、全文检索与联网，Ordo 负责 Team execution。

核心用户行为：

```text
打开项目和当前文本
  -> 连续编辑并自动恢复
  -> 选中文本向 Agent 提问或请求候选
  -> 比较并接受到 Working Copy
  -> 创建 Checkpoint
  -> 提交 ReviewItem
  -> 人工接受为 Canon
```

## 2. 外部参考与结构修正

[OpenFic](https://github.com/syrizelink/OpenFic) 的公开 README 可直接证明其产品强调小说写作编辑器、可配置 Agent/Prompt/工作流、本地持久化、百万字级语义检索和响应式 UI。Workbench 只把这些作为用户问题参考，不照搬其实现，也不把未在公开说明中确认的具体权限、diff 或 revision 机制写成事实。

Text Development 在此基础上做三项结构修正：

1. Agent 不依赖页面或临时 editor state识别“当前文档”；所有动作绑定 exact Working Copy ref、revision、digest和selection anchor。
2. Agent 不直接保存正文；它只能产生 candidate，接受后也只进入 Working Copy。
3. 不固定成永远等宽的三栏；同一 Shell 使用 `Create` / `Collaborate` 两种姿态，区域身份不变。

Workbench 的差异点是 owner-safe composition：provider、全文检索、正文持久化、Team 调度和 Canon 晋级分别留在 Conversation Runtime、Auctra 与 Ordo；Web 只消费 typed projection/action/receipt。

## 3. 场景矩阵

| Scenario | Target user | Job | Required artifacts | Gate | Evidence | Export/handoff | Maturity |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `novel-authoring` | 长篇小说作者 | 连续章节写作与一致性维护 | Working Copy、Checkpoint、Timeline、Foreshadowing、ReviewItem | 格式、引用、连续性 findings | 60 分钟 proof + 500 章 fixture | Auctra version/export | first-support beta |
| `screenplay-authoring` | 编剧 | Scene/Beat、双时间线、对白与状态变化 | Fountain/Markdown draft、Scene Card、Story Time、ReviewItem | screenplay profile checks | Screenplay Room roundtrip | Auctra/Scaena handoff | first-support candidate |
| `self-media-authoring` | 自媒体作者 | 从 Brief 到 claims/source/channel variant | Brief、Claims、Sources、Channel Checks、variants | claim/source和渠道检查 | 多平台 fixtures | Auctra export | exploratory |

三类场景共享 Document、Outline、Entities、Materials、Review、Version、Context 和 Agent，不创建三套产品栈。

## 4. 核心对象

- `Working Copy`：Auctra-owned 可变编辑态，autosave 只推进 working revision。
- `Checkpoint`：用户显式创建的私有不可变快照。
- `ReviewItem`：绑定 Checkpoint 的待审项。
- `Canon`：只有 Auctra 人工 review authority 可晋级的正式版本。
- `Selection Anchor`：绑定当前 Working Copy revision/digest 与 UTF-16 range。
- `Candidate`：Agent/Team 生成的 inline patch、document candidate 或 atomic change-set。
- `Working Set`：本轮 Agent 必须优先使用的显式对象集合。
- `Project-full grant`：Runtime 可按需检索和外发的项目级最大范围。
- `Style Profile`：用户维护的 Auctra 风格资产，不等同 Prompt 模板。
- `Team Plan`：Ordo-owned、一次批准、不可变的角色/DAG/预算/writer proposal。

## 5. Agent 交互原则

选区是最快入口：默认显示 `Ask`、`Rewrite`、`Polish`、`Add to context`。复杂任务升级为持续 Conversation；跨文档或结构工作升级为 Team Plan。

角色、模式、模型和权限分开：

- Role 说明职责，如 Writer、Researcher、Reviewer。
- Mode 决定行为边界；`plan` 强制只读。
- Model 只引用 server-authored profile。
- Permission 使用 `allow / ask / deny` 和 user→project→session narrowing。

项目默认允许 Pi runtime 在 project-full scope内使用正文和web search；Working Set仍用于表达本轮重点。Workbench展示实际 egress/usage receipt，不展示raw provider payload。

## 6. Agent Team

主 Agent 先生成 Team Plan，用户一次批准 exact plan revision后由Ordo执行。首批模板：

- `solo-assist`
- `novel-sprint`
- `screenplay-pass`
- `self-media-pack`

默认每个target只有一个writer。Simulation只验证DAG、权限、预算、runtime readiness和writer冲突；real canary必须显式启用真实key，最多主Agent加两个Team角色，无递归team，无commit/push/publish。

## 7. 成功标准

Novel local Beta 必须让用户连续工作60分钟，完成：

- 在100万字、约500章、数千实体fixture中打开和切换章节；
- 中文IME、撤销重做、autosave和重启恢复零丢稿；
- selection-first Agent问询与candidate接受；
- 创建Checkpoint并提交ReviewItem；
- 查看project-full context使用与egress receipt；
- 配置并完成一次Team simulation；
- 在桌面完整创作，在手机完成只读、diff和decision。

使用体验按三个时间尺度验收：

| 时间尺度 | 用户必须感知到什么 | 验收信号 |
| --- | --- | --- |
| 前 5 秒 | 当前文档、是否安全保存、当前阻塞和一个下一动作 | 标题/Working Copy 状态/primary action 无需展开即可识别 |
| 前 5 分钟 | 编辑、选区问询、候选比较、恢复和 Context 使用不需要学习第二套术语 | 完成一个 selection→candidate→accept→Checkpoint 流程，零歧义动作 |
| 连续 60 分钟 | 安静、稳定、可恢复，不因切姿态、重启、Team simulation 或长项目规模丢上下文 | 零丢稿、无重复提交、无持续状态闪烁，evidence 可追溯 |

Beta 不是“页面完成”。Auctra Working Copy、Conversation Runtime/Pi、Ordo simulation 和 Workbench consumer 必须分别报告 maturity；任一 owner 未 ready 时，对应能力保持 `needs_contract` 或 `blocked`。

## 8. 非目标

- 多人实时协作或CRDT。
- 多个并发writer修改同一target。
- Agent自动Checkpoint、Review accept或Canon。
- Workbench内建provider/search crawler或Ordo scheduler。
- 任意自由图、任意脚本、owner iframe。
- 手机完整编辑和高密度结构拖拽。
