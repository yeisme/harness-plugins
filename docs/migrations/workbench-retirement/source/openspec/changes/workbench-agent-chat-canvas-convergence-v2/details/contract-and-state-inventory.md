# Contract and State Inventory

## State ownership

| State | Owner | Workbench Web stores | Forbidden duplicate |
| --- | --- | --- | --- |
| visible conversation content | Conversation Runtime | selected-session query cache | localStorage/Task DB copy |
| session Profile/grant/budget | Conversation Runtime + Workbench approval projection | active safe refs/revision/expiry | Browser-authored permission |
| Task/gate/attempt/receipt | TaskService/ProposalAuthority/Owner | query cache | content owner lifecycle |
| Canvas camera/selection | Spatial Web state / view preference owner | current session layout/view state | conversation content DB |
| pending selection | Workbench layout reducer | per-session/per-draft refs | automatic Context Pack |
| attached Context Pack | Context service | safe ref/revision + visible chips | latest-selection substitution |
| Pane/Canvas document layout | Workbench layout reducer | browser memory; future SavedView | Owner/business state |
| canonical Board change | Spatial owner via ProposalAuthority/TaskService | preview/query cache | browser Draft/DOM mutation |
| canonical Agent memory | Pinax | safe projection/ref | conversation summary promotion |

## Additive client surfaces

`WorkbenchClient.agent.conversation` 增加独立 client，不修改现有 `WorkbenchAgentClient` 方法签名。首批类型：

- `ConversationRuntimeProfileV1alpha1`
- `ConversationSessionProfileV1alpha1`
- `ConversationSessionGrantV1alpha1`
- `ConversationSessionProjectionV1alpha1`
- `ConversationTurnIntentV1alpha1`
- `ConversationMessageBlockV1alpha1`
- `ConversationContentEventV1alpha1`
- `ConversationContentReceiptV1alpha1`
- `PendingContextSelectionV1`
- `AgentWorkbenchLayoutV2`

所有 unknown major、unknown critical Block/event、缺 required safe ref 或 oversize content fail closed。Optional minor fields允许旧 consumer 忽略。

## Compatibility inventory

| Existing surface | v2 handling |
| --- | --- |
| `workbench.agent.turn.submit.v1` | 保留；input 继续是 safe ref，仅新增绑定 grant/profile refs 的可选字段或新 sealed ref 格式 |
| `WorkbenchAgentClient.submitTurn` | 保留签名兼容；新 real flow 通过 additive option/model 或新 helper 进入，旧 caller 仍可使用 reference/dev fixture |
| Task event codes | 保留；content event 使用独立 contract，不把 token/Block 塞入旧 Task event |
| `AgentPresentationIntentV1` / `AgentSpatialIntentV1` | 保留；新增 attempt/block correlation 使用 optional fields 或新 minor contract |
| Pane registry/layout v1 | 保留 document identity；Canvas adapter additive；旧 mode state 迁移为 initial preference |
| `?view=conversation|split|spatial-focus` | 永久兼容 alias，不删除、不报错 |
| reference adapter | 保留 explicit dev flag，不计 real readiness、不自动 fallback |

## Failure mapping

| Source | Canonical state/code | UI behavior |
| --- | --- | --- |
| Conversation content | `partial` | 保留 Blocks，显示 Retry |
| Conversation content | `content_cursor_gap` | last-confirmed + bounded refetch |
| encryption | `content_key_unavailable` | 内容不可读，Task refs 仍可读；禁止 plaintext fallback |
| grant | `expired/revoked/scope_mismatch` | Composer blocked，重新确认 Profile |
| selection | `stale/revoked/revision_conflict` | tray 阻止附加，Refresh/Remove |
| Task | `unknown_accept` | 原 attempt reconcile-only |
| runtime | `unavailable/incompatible` | 显式 Profile switch；无 auto fallback |
| change-set | `revision_conflict` | 整包不落地，Refresh/Request Changes |

