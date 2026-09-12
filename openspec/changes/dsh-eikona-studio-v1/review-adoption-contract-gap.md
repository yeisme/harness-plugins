# 候选采用合同核对

## 已补齐的增量

持久恢复链增加一次对账 HTTP 403 注入：Gateway 返回 reconcile_required，恢复列表仍保留相同原键；解除注入后，对账完成才清除行，期间没有新增采用提交。这验证消费侧恢复行为，真实 owner 凭据撤销仍需独立证据。

真实 DSH storage/json/domain 已与 Gateway 及实际 owner 测试链连接：丢弃已完成采用的响应后，原键记录落盘且不包含 values；销毁并重建 Gateway/存储实例，恢复列表保留原 lookup identity，不自动提交。显式对账确认后才清除恢复行，决定版本保持 1。这补齐本地持久存储重开链，仍不代表真实用户 profile、确认 UI 或付费生成完整闭环通过。

实际 Host 集成已改为消费实时 owner discovery 与审阅投影生成采用请求，再执行提交、重放、对账和状态刷新；采用后再次准备返回 already_decided。请求映射不再由测试直接手工拼装代替。此链仍使用本地 fixture 授权，没有替代现有 dispatch 持久身份、用户确认和恢复 UI 的验收。

普通采用准备只接受状态明确的 pending/request_revision 候选；accepted/rejected/stale 返回 already_decided，缺状态保持未确认。该限制不取消原键对账，也不删除修改或替代需求；这些能力应以对应 owner 动作呈现，不能通过再次 accept 混合后果。

实际 owner 丢响应测试已覆盖：transport 在 owner 完成后消费并丢弃一次提交响应，Host 返回 unconfirmed，随后只对账原键恢复成功。提交次数没有再次增加，决定版本保持 1。这是网络响应丢失的受控模拟，不是进程崩溃或正式恢复 UI 验收；原键仍须在现有持久恢复机制中保存后才能提交。

Host 客户端已增加固定 review:decide 提交 transport，要求显式确认、原幂等键、固定内容摘要以及互斥的首次/已有版本前置条件。Host 连接的 `reviewAdoptionApproved` 默认未启用，提交项目必须匹配受验证的单项目凭据绑定。该开关属于 Host 配置，浏览器不得填写。断线和不确定响应不重试；后续 adapter 必须消费现有 dispatch 身份/恢复机制，并在提交前重新核对 discovery、审阅与上下文。本方法未注册为直接浏览器 mutation 入口。

采用回执 normalizer 校验实际 owner schema、review action、原操作/回执形式与固定候选下一决定版本的 outcome。HTTP accepted 和 running/unknown 不等于采用；只有匹配 outcome 的 succeeded 才确认。此 parser 尚未连接提交 transport，其输入必须由受信任 Host owner 连接取得，不接受浏览器自报成功。

采用请求纯映射已实现：固定 run、候选 ID 和图片摘要；版本 0 使用首次决定条件，正版本使用既有版本 CAS。映射返回 prepared 且明确未授权执行，不产生幂等键、不提交、不创建第二动作账本。调用者接入现有 dispatch 时必须重新取得受信任 discovery/审阅、核对完整上下文与授权，不能把过期 prepared 结果当作执行票据。

Host 已分别识别首次决定与固定内容摘要 capability。它们只表示当前 owner 的实现支持，不能代替 `requires_authorization`、项目范围、候选绑定和回执恢复。动作构造需按候选 `decisionVersion` 选择首次条件或已有版本 CAS，并同时固定 `contentDigest`；缺少任一必要事实不构造可执行采用动作。

资产行审阅的真实 owner 浏览器测试桥已验证：显式点击读取一次，显示匹配图片摘要与决定版本 0，不触发图片读取或采用；360/560px 无横向溢出并保存截图。该桥直接连接 Gateway，尚不代表正式 Typert 传输或完整采用闭环通过。

资产行已提供显式“读取审阅”，展示该候选决定版本与图片摘要绑定状态。整次 run 的 owner decision 不用于标记单张候选已采用；没有候选或版本时明确显示未知/缺失。关闭和项目切换依赖既有 scope remount 与 controller 隔离，尚待真实浏览器和迟到组件专门验证。本切片不提供无 owner 回执支撑的采用按钮。

客户端 controller 已加入审阅读取，等待响应后重新核验 generation/context，拒绝错误 run 结果；不在共享 store 保留领域审阅正文、不自动重试。测试覆盖 reset 后迟到结果及请求/结果 run 不匹配。Pane 展示和采用仍是后续任务。

审阅读取增量 Remote 为 `readEikonaReview@1`，请求仅含固定 run ID，结果限定安全项目、候选、图片绑定、决定版本与权限投影。Gateway 在等待 adapter 后重新核验上下文与 directory generation，拒绝目标 run 不符或候选绑定不一致。实际 owner HTTP→Gateway 已验证候选一致；controller、Pane 和采用仍未接通，不将描述注册等同于真实用户路径。

真实 owner HTTP 验证已接入现有 Go fixture：通过 runstore 写入 assessment 和 manifest，挂载实际 Review handler，Host 读取到两份匹配图片摘要、项目与决定版本 0；异项目和非法 run 被拒绝。首次验证发现空候选被切片复制转换成 null，修复后重跑通过。该证据仍不覆盖 Remote/Pane 审阅、采用写入或真实 provider 生成。

Host 新增 `readReview` 与有界审阅投影：要求返回 run/project 与 Host 绑定一致，候选唯一，图片 URI 与候选对应，URI/digest 成对出现。保留缺失决定版本为未知，权限与采用事实分别呈现，丢弃未消费的机器建议等 metadata。当前只有 Host 读取方法与 normalizer，尚未接通 Remote/Pane 或实际 owner HTTP 验收。

owner 已新增 `require_no_decision`，并以 `eikona.review.require_no_decision.v1` capability 声明实际 adapter 支持；锁内首次检查、并发竞争、直接 HTTP 和 SDK 字段已有独立验证。Host discovery 只从受信任摘要中的 matching mutation capability 得出 `supportsRequireNoDecision`，不把它当作授权。下文关于旧零值、原始候选投影的核对仍解释兼容边界；候选图片绑定及双文件恢复未完成，采用入口继续待接。

## 当前事实

源码核对范围为 `cli/eikona/internal/ownerreview/canonical_review.go`、`internal/ownerprovider/requests.go`、`internal/reviewdecision/types.go` 与 `service.go`。

| Owner 字段 | 当前实际含义 | DSH 不得替代为 |
|---|---|---|
| `asset_ref` | canonical adapter 传入 `DecisionRequest.RunID` | 图片 artifact URI |
| `review_version` | canonical adapter 传入 `DecisionRequest.CandidateID` | 图片 SHA256 或审阅 revision |
| `expected_version` | 解析为候选决策的整数 `ObservedVersion` | 内容摘要、时间戳或列表顺序 |
| `decision` | accept/reject/request_revision/supersede | 浏览器选中或比较模式 |

现有 `GET /runs/{run_id}/review` 返回候选 ID、审阅提示、权限和整体决定；候选没有明确 artifact URI、内容摘要或候选决策 revision。`ProjectID` 虽在结构中可选声明，当前 `Service.Review` 未填充。资产列表与审阅候选之间不能靠名称或 ID 截取建立可信映射。

决策服务当前把 `ExpectedVersion == 0` 作为不校验；已有决定不存在时，非零 expected version 也不会由当前条件拒绝。该语义不能直接充当 DSH 首次采用的严格 CAS。`Review` 忽略候选评估和决定列表读取错误，读取失败也可能形成看似空的投影；Host 必须区分未知与确实没有决定。

## Owner 配套交付

沿用 `cli/eikona/openspec/changes/eikona-dsh-owner-runtime-binding-v1`，以增量合同补齐：

1. owner 核验的 project/run/candidate/artifact/digest 绑定及候选当前决定版本；明确无决定状态，不以零值混合未知。
2. 显式的首次采用与已有版本 CAS 语义，保留旧请求兼容入口；读取失败不能变成无决定。
3. 同一候选并发采用、冲突决定、原键重放和未知提交对账的真实存储验证；版本校验与写入保持原子，不在 DSH 新建决定账本。

## DSH 消费与验收

任务 2.6 和 5.1 受此缺口影响。先读取 owner 绑定与权限，再提供带固定版本的 server-authored 动作；确认后沿既有 dispatch/receipt/reconcile 路径提交。成功回执更新采用事实，比较选中仍独立存在。正式采用、写回和交接分别执行。

当前图片预览与比较仍可直接使用；缺失绑定不能用永久禁用按钮代替 owner 配套交付，也不能用 fixture 的同名 candidate/artifact 宣称真实采用已接通。
