# Text Development Agent 与 Owner 接口

> 状态：`active proposal`
> OpenSpec：`workbench-text-development-studio-v1`

## 1. 信任链

```text
Browser
  -> Workbench BFF / WorkbenchClient
      -> Workbench TaskService / ProposalAuthority
      -> Auctra text working-copy owner
      -> Conversation Runtime content/profile owner
      -> Runtime Plane fixed adapter
      -> Ordo Team owner
```

Browser不得直连owner、读取credential或构造owner authority。Workbench只保存layout/query cache、Task/proposal metadata、safe refs和receipts。

## 2. WorkbenchClient surface

`WorkbenchClient`新增additive成员：

```ts
readonly textDevelopment: WorkbenchTextDevelopmentClient
```

该client提供：

- workspace/document：`openWorkspace`、`openWorkingCopy`、`watchWorkingCopy`
- editing：`applyHumanPatch`、`applyStructureIntent`
- version：`createCheckpoint`、`submitCheckpoint`
- candidate：`listCandidates`、`compareCandidate`、`acceptCandidate`、`rejectCandidate`
- context：`getEgressReceipt`
- team：`previewTeamPlan`、`simulateTeamPlan`、`startTeamRun`、`cancelTeamRun`、`reconcileTeamRun`

旧clients和method签名保持不变。

### 2.1 合同 identity

| 能力 | Identity / owner |
| --- | --- |
| Workbench document/Lens | `agent.text-development.v1alpha1` / Workbench |
| Selection anchor | `workbench.text_selection.v1alpha1` / Workbench presentation |
| Working Copy | `auctra.text_working_copy.v1alpha1` / Auctra |
| Conversation profile/grant/content | `conversation.*.v1alpha1` / Conversation Runtime |
| Team control | `ordo.workbench.team_control.v1alpha1` / Ordo |
| Prompt | `promptrepo://...@version` / Prompt Repository |

这些 identity 独立晋级。Workbench UI、fixture 或一个 owner 的 readiness 不得提升其它 owner。

## 3. Text selection

```ts
interface TextSelectionAnchorV1alpha1 {
  contractVersion: "workbench.text_selection.v1alpha1";
  workingCopyRef: string;
  unitRef: string;
  revision: number;
  contentDigest: string;
  fromUtf16: number;
  toUtf16: number;
  selectedDigest: string;
}
```

Anchor只表示位置和版本，不携带execution authority。实际正文通过Conversation Runtime的sealed turn intent或Auctra explicit open读取。

## 4. Candidate projection

```ts
type TextCandidateKind =
  | "inline_patch"
  | "document_candidate"
  | "atomic_change_set";

interface TextCandidateProjectionV1alpha1 {
  candidateRef: string;
  kind: TextCandidateKind;
  targetRefs: readonly string[];
  baseRevisions: readonly number[];
  baseDigests: readonly string[];
  changedRanges: readonly TextRangeSummary[];
  summary: string;
  producerRef: string;
  profileRef: string;
  contextPackRef: string;
  status: "pending" | "stale" | "applied" | "rejected" | "unknown_accept";
  allowedActions: readonly string[];
}
```

完整candidate body只由explicit compare读取。通用timeline、events和evidence只含summary/refs/digests。

## 5. Autosave request

每个patch必须携带：

- `workingCopyRef`
- `baseRevision` / `baseDigest`
- ordered UTF-16 edits
- `declaredResultDigest`
- `idempotencyKey`
- server-issued action/approval ref

Browser在750ms idle、blur和document switch时flush。成功HTTP响应不等于保存完成；只有Auctra result revision/digest/receipt可将UI置为saved。

普通 workspace/list/status/event/receipt 不返回正文或 patch insert。只有显式、已认证的 `openWorkingCopy`、candidate compare 或 snapshot export 可以取得相应 body；BFF 必须限制响应大小、content type、timeout 与跨项目 scope。

## 6. Context和egress

Session Profile支持：

```text
context_access = project_full | working_set_only
external_egress = project_content_allowed | selected_only | denied
web_search = allow | ask | deny
```

首批默认由user profile允许`project_full + project_content_allowed + web_search=allow`，project可覆盖，session只能收窄。Working Set是must-use上下文。

Egress receipt至少投影：

- session/turn/attempt refs
- project/context/profile revisions
- source refs、range/count与content class
- model/tool profile refs
- input/output token buckets、cost ref与latency bucket
- limitations/redaction status

不得投影raw prompt、provider request/response、hidden reasoning或private tool args。

## 7. Profile switch saga

```text
profile selection
  -> revoke old SessionGrant
  -> cancel current attempt
  -> known cancelled/partial
  -> confirm new Profile revision
  -> create new SessionGrant
  -> seal continuation intent from last confirmed cursor
  -> submit new turn Task
```

任何unknown acceptance、pending mutation或MCP/tool side effect都会阻断新attempt并要求reconcile。切换不会重放旧tool call。

## 8. Team control

Workbench消费`ordo.workbench.team_control.v1alpha1`。Team Plan projection包含roles、DAG、Context、model/permission profiles、budget/time、candidate outputs、risks和唯一writer。

一次批准绑定exact plan revision/digest。该批准只覆盖plan声明的read/retrieval/analysis/candidate production；external write、cost/profile upgrade和Canon decision仍单独gate。

## 9. 错误与恢复

UI至少识别：

- `needs_contract`
- `permission_required`
- `cost_required`
- `working_copy_conflict`
- `candidate_stale`
- `recovery_required`
- `runtime_unavailable`
- `grant_expired|revoked|scope_mismatch`
- `writer_conflict`
- `unknown_accept`

Known failure可提供retry/rebase；unknown只能status/reconcile。所有错误保留last-confirmed内容，不伪造成功、失败或owner state。

## 10. 兼容与回滚

新增client、types、Pane kind和actions均为`v1alpha1` additive。旧`workbench.agent.turn.submit.v1`、Agent/Pane/Layout/Proposal methods保持不变。

关闭Text Development capability后：

- palette不再开放新Lens；
- 现有`/agent`继续工作；
- Auctra Working Copy和receipts不删除；
- browser query cache/editor instance清理；
- unknown operations仍可从owner CLI/service reconcile。

## 11. Consumer 验收矩阵

| 链路 | 必证内容 | 失败姿态 |
| --- | --- | --- |
| Workbench → Auctra | open/apply/checkpoint/candidate/status/events/reconcile 的 exact digest 与 body boundary | `needs_contract|conflict|recovery_required` |
| Workbench → Conversation Runtime | project-full/Working Set、egress receipt、cancel/continuation、safe Block | `runtime_unavailable|scope_mismatch|unknown_accept` |
| Workbench → Ordo | plan preview/simulation/start/status/events/cancel/reconcile | `writer_conflict|blocked|unknown_accept` |
| Browser → BFF | same-origin、CSRF、size/timeout、redaction、无 owner endpoint/credential | fail closed，不启动 direct fallback |

每条链路分别记录 provider contract digest、consumer fixture version、capability flag、evidence run 与 rollback。Fixture 只证明 consumer 行为，不能证明真实 Pi、Auctra 或 Ordo ready。
