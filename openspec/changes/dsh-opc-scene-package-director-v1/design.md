# DSH OPC 场景生产导演入口设计

## 1. Owner boundary

DSH 是异常优先的导航、摘要和动作入口；Scaena 仍拥有 package、ProductionGraph、readiness、review、SkillPlan、receipt、manifest、grant 和 mutation。DSH 只保留 UI selection、pane 展开、last-known safe projection 和 transport receipt index。

~~~mermaid
flowchart LR
  S[Scaena OPC summary] --> H[DSH typed host adapter]
  H --> D[/drama context]
  D --> R[/drama review]
  D --> E[/drama evidence]
  D --> V[/drama delivery]
  D --> F[/drama handoff]
  D --> A[server-authored action]
  A --> S
  S --> W[Workbench deep link]
~~~

## 2. DSH view model

DSH-local DramaScenePackageExceptionView 只投影：

~~~text
show/episode/scene/package refs
package version and freshness
current stage and readiness
primary blocker
primary action identity
human gate summary
role labels
partial/unknown/offline/stale state
evidence/receipt/reconcile refs
Workbench deep link
~~~

禁止内嵌 raw prompt、完整剧本、provider payload、credential、signed URL、绝对路径或完整思维链。Skill 主界面只显示 director、continuity、producer、edit/sound 等角色；name/version/digest 进入详情或审计面板。

## 3. Interaction and pane contract

/drama 必须先回答四个问题：当前是什么、卡在哪里、为什么卡、下一步是什么。只有异常触发时才增加 Exception card；没有异常时显示三个正常人类门的状态和一个 primary action。

- /drama review：结构审阅、visual foundation、direction gate 和 action detail。
- /drama evidence：查询/投影 evidence refs、digest、counts、reason codes、receipt/reconcile identity。
- /drama delivery：partial/formal package、manifest/checksum、production_ready、export receipt 与 grant 状态。
- /drama handoff：Workbench 深链、复制命令/API 详情和 owner contact-free handoff facts。

按钮必须来自 Scaena ActionDescriptor。点击后由 typed host adapter 提交，收到成功、冲突、超时或 unknown 都要重新读取 owner projection。DSH 不以 HTTP 2xx、动画结束或本地缓存变更宣称成功。

## 4. State and recovery

~~~mermaid
stateDiagram-v2
  [*] --> loading
  loading --> clear: no blocker
  loading --> exception: blocker known
  loading --> stale: digest/version drift
  loading --> offline: owner unavailable
  loading --> partial: partial package
  loading --> contract_mismatch: invalid projection
  clear --> action_pending: submit approved action
  exception --> action_pending: submit owner action
  action_pending --> loading: receipt/refetch
  action_pending --> reconcile_required: unknown/timeout
  reconcile_required --> loading: reconcile-only
  stale --> loading: refetch
  offline --> loading: owner recovers
  partial --> loading: bounded repair receipt
~~~

unknown、partial、stale、offline 和 contract mismatch 必须显示原因并禁用依赖缺失事实的 mutation。DSH 不自动 retry、换模型、扩预算、改变画幅或升级 cinematic。owner offline 时保留 last-known safe refs/version/evidence，但所有依赖 owner 的写动作均 disabled。

## 5. Cross-entry semantics

对同一 package revision，DSH 与 Workbench 必须匹配：

~~~text
action id
target ref
expected version
side-effect class
confirmation and idempotency requirement
receipt identity
reconcile identity
~~~

允许不同的摘要密度、异常排序和深链文案，但不允许语义漂移。DSH 可以提供 copyable CLI/API details，但不得解析 human CLI output 或拼接任意 shell。

## 6. Delivery and accessibility

DSH 只消费 Scaena export receipt 和 short-lived grant refs；不组装 ZIP/PDF/CSV、不改 manifest、不保存 artifact blob。partial package 必须显式展示 partial 与 production_ready=false。grant 过期只重新获取 grant。

命令入口、异常卡、动作详情和 handoff 深链必须键盘可达，状态使用文本与非颜色信号，焦点在面板关闭后返回触发控件；减少动画偏好下不播放非必要过渡。

## 7. Compatibility and rollback

既有 /drama、Review、Evidence、Delivery、Handoff 行为保持可读。新字段全部 additive，feature flag/profile 关闭时回到现有 summary。回滚只隐藏新入口与清理 DSH-local view cache，不删除 Scaena package、receipt、manifest、evidence 或 grant。
