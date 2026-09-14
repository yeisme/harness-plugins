# Auctra 文本台实施基线

## 2026-09-09 大文档保存增量

普通保存已通过显式声明的 textBody 通道支持最多 2 MiB UTF-8；旧 values 字符串保持 16,384 字符限制，未声明的动作不接收该通道。通用 Working Copy 与剧本 text.draft.save 保持各自 owner 路由。恢复副本独立使用 2 MiB 合同，不再受普通动作字符限制。实际通用/剧本边界、长稿浏览器保存、原键恢复、SQLite 存储失败与关闭重开证据见本 change tasks.md 最新条目。下方按时间积累的“16,384 缺口”描述为历史状态；原生 IME、200% 缩放和最终全门仍未完成。

## 未提交正文恢复的 owner 存储基础

确认现有 screenplay close guard 不等同未提交正文缓冲，新增配套 [auctra-editor-recovery-drafts-v1](../../../../../cli/auctra/openspec/changes/auctra-editor-recovery-drafts-v1/tasks.md)。正文继续归 Auctra，恢复草稿独立 revision CAS 且固定来源版本，不保存到 Host 的原操作身份索引，不修改 Working Copy/候选/Canon。

owner schema 33 与 GORM repository 已完成并验证：关闭重开、过期/跨锚点冲突、身份分区、旧数据迁移保留、备份 registry 分类、领域版本表零变化。另修复实际 SQL 故障日志输出正文的问题，启用参数化日志后回归通过。完整 owner 集成证据：`cli/auctra/temp/integration-test-runs/text-working-copy-20260908T141204Z-3429944/`。

当前仅存储基础；应用服务、CLI/API、DSH 自动保留与显式恢复未接入。未提交草稿的浏览器关闭恢复仍为未完成项，不能由已提交操作的原键对账证明。

## 1.1 消费合同盘点（双向链接）

核对源：Auctra `internal/api/text_working_copy_contract.go`、`routes.go`、`studio_consumer_contract.go`、`docs/text-working-copy.md`。消费方：[本 change tasks](./tasks.md)。owner 反向链接见 `cli/auctra/docs/text-working-copy.md`。

| 能力 | owner operation / digest | DSH 状态 | 备注 |
|---|---|---|---|
| 三类结构 | `text.list.read` → chapter/text/screenplay-draft | 支持 | 未知 kind 省略、零正文 |
| 正文授权读取 | `text.working-copy.open` digest `b7f15cedede385957b1956e4841637e12f5b379a471c531eccdfada55949314f` | 支持 | explicit open；status 无正文 |
| 保存/回执 | `text.working-copy.apply` / `reconcile`；剧本 `text.draft.save` | 支持 | receipt 确认；409 保留输入 |
| 候选 create/show/content/apply/reject/list | 同族 + content digest `1780a2fa0ee082cbd3d61ce9b363e115b859e6f529b44842e10d917beec1b0e9` + list digest `9ed42760be771c1b81070cac1cf0eece686edba2e11e3c8ff8e0b7d82e93509d` | 支持 | 采用不晋级 Canon |
| 候选原键恢复 | `request_key` + [auctra-candidate-request-recovery-v1](../../../../../cli/auctra/openspec/changes/auctra-candidate-request-recovery-v1/tasks.md) | 支持（Host 身份持久化增量） | 浏览器关闭后只存原键，不存正文 |
| 候选 base fence | [auctra-candidate-base-fence-v1](../../../../../cli/auctra/openspec/changes/auctra-candidate-base-fence-v1/tasks.md) | 支持 | create 发送 expected_base_revision/digest |
| 保存原回执 | [auctra-dsh-working-copy-save-contract-v1](../../../../../cli/auctra/openspec/changes/auctra-dsh-working-copy-save-contract-v1/tasks.md) | 支持 | 剧本不走通用 PUT |
| Checkpoint | `text.working-copy.checkpoint.create/list/show` | 支持（独立动作） | 采用不触发 |
| Review submit | `text.working-copy.review.submit`（需 checkpoint_ref） | 支持（独立动作） | 不由采用触发 |
| Review accept/reject | `review.accept` / `review.reject` | 支持（独立动作） | Canon 仅走 accept |
| 固定版本导出 | `text.export` | 支持（独立动作） | 源写回是另一动作 |
| Canon | Working Copy → Checkpoint → Review accept | 支持（无独立 mutation） | 采用不得晋级 |
| 大文档 | owner 2MiB；Pane `actionValueChars`=16,384 | 缺口保留 | 不截断、不缩减验收 |

fixture 身份/admission 证据不代表生产准入。本盘点关闭 1.1 的合同核对，不关闭 4.2 真实验收。

## no-op 采用恢复与 owner 配套收口

owner 在已有幂等表新增 `candidate_noop`，事务内保存原 Working Copy 元数据与候选 adopted 状态，不创建 journal 或正文版本。原键查询验证候选、key/scope/fingerprint 和原版本，保持 no_op=true 的互斥标志；后续编辑、compaction 或真实进程重启后仍返回原结果。损坏事实失败关闭，普通保存与采用不能交叉复用同键。通用 Working Copy 空 patch 的既有零写入语义保持不变。

实际 DSH client/HTTP no-op 采用及后续编辑查询通过：`temp/integration-test-runs/auctra-owner-http-20260908T123336622Z-2275649/`。owner 六包与真实 serve（含 no-op 重启）通过：`cli/auctra/temp/integration-test-runs/text-working-copy-20260908T123538Z-2300555/`；相关 go vet、strict spec、跨操作键冲突 focused 通过。

`auctra-candidate-request-recovery-v1` 五项配套任务已按上述边界完成。DSH 文本台 2.4 及全目标仍开放：浏览器关闭后的草稿/未决请求持久恢复、完整 IME/200% 缩放和其他专业流程不能由本证据替代。

## 真实 owner 进程重启后的原键恢复

owner 集成运行 `cli/auctra/temp/integration-test-runs/text-working-copy-20260908T122618Z-2186965/` 完整通过。测试先在真实 serve 上创建并采用带外部键的候选，再终止旧进程并启动不同 PID 的新 serve，重新取得测试连接后仅按原键 reconcile；原回执 journal/ref、revision、digest、length，以及当前 revision/digest 完全一致，重启后没有再次 apply。

该证据证明 owner 持久映射脱离旧进程/连接缓存仍可恢复，不再只依靠新 service 实例测试。浏览器自身关闭后的请求键和草稿持久化、空 patch/no-op 历史事实尚未完成。

## 请求键并发与 owner 集成门

owner 新增八个独立数据库连接的同键争抢测试：恰好一个候选绑定成功，其他键冲突，重复胜出绑定可查询且不推进正文。两 service 实例同时采用不同候选时，只允许胜出候选推进 revision 一次，原键查询得到该候选回执。两项 focused 各连续三次通过。

最终 Working Copy 六包与真实 serve 集成完整通过：owner `cli/auctra/temp/integration-test-runs/text-working-copy-20260908T122215Z-2149667/`。修复的是测试入口的 status JSON 读取路径及内部/HTTP 错误名混用，并将 http_call 从两次 curl 改为一次；保留 `409 working_copy_conflict` 与拒绝后 revision/digest 不变断言，不修改业务权限。此前两次失败记录保留在 owner 同目录，不能替换为通过。

该证据覆盖 Working Copy 测试族，不等于完整文本台或其他专业 Pane 验收。请求键真实进程重启、持久 no-op 事实，以及浏览器关闭后的草稿/未决请求恢复仍开放。

## DSH 未知采用原键对账已接通

可信 Host 的独立 `candidateRequestRecovery: v1alpha1` 准入通过后，采用发送原请求键给 owner；snapshot 仅在该能力可用时发布采用动作。对账使用 owner 持久请求键映射，移除原先按内存候选/当前正文 digest 合成回执的临时恢复路径。旧无键 client 调用仍兼容，新带键调用未准入零 I/O，提交后准入丢失保持 unconfirmed。

通过证据：`temp/integration-test-runs/auctra-owner-http-20260908T121057475Z-2029082/`。浏览器采用已提交后响应丢失，执行按钮保持禁用；重建 Host adapter 后点击原操作对账恢复 completed，采用 POST 计数仍为一次，未保存编辑保留，owner 正式版本/审阅/检查点计数未变。Host focused 另覆盖新 adapter 对较新正文下的原版本回执恢复、独立准入与撤销准入。

这证明 fixture 身份及 Host 选择桥下的真实 owner/browser 原键恢复。浏览器关闭后未决请求本身的持久恢复、真实 owner 进程重启、并发键绑定、no-op 历史事实、生产准入仍分别开放；本轮不据此收口完整文本台。

## 采用请求键 API / CLI 已接入

Auctra candidate apply API 新增可选 `request_key`，CLI 新增 `--request-key`，生成 OpenAPI/TypeScript 已通过 owner CLI 更新和 drift 检查；旧空对象调用保持。owner API/CLI focused 验证原键查询 journal/digest 一致、保留键拒绝及输出无正文。

真实 HTTP 证据：`temp/integration-test-runs/auctra-owner-http-20260908T120314294Z-1936176/`。测试提交带 request_key 的采用后主动丢弃响应体，再用既有 DSH reconcile client 查询原键恢复回执；未执行第二次 apply。当前由 HTTP fixture 注入该字段，DSH adapter 与浏览器 unknown 恢复仍未接入，不据此宣称端到端完成。

## 外部采用请求键 owner 配套实现

新增双向配套 [auctra-candidate-request-recovery-v1](../../../../../cli/auctra/openspec/changes/auctra-candidate-request-recovery-v1/tasks.md)。owner 复用既有 Working Copy 幂等表，以 `candidate_request` 操作类型在采用前持久绑定外部请求键与候选引用；同键换候选或 operation 冲突拒绝。reconcile 解析该绑定后只读取 canonical 原采用回执，映射本身不证明提交，不发起 apply。

owner application focused 已覆盖新 service 实例查询、后续编辑与 compaction、同键换候选零改动、未提交映射无 last_receipt、非法/保留键拒绝。当前“重启”只验证新 service 实例，不等于真实进程重启。旧无 request_key HTTP 路径回归通过：`temp/integration-test-runs/auctra-owner-http-20260908T115725674Z-1846847/`；不能将此证据解释为新字段 HTTP 已通过。

配套任务 1.1/1.2 已按上述范围完成；并发绑定、真实进程恢复、持久 no-op、API/CLI/生成合同和 DSH 原键接入仍开放。DSH 当前 unknown 采用行为未改变，不宣称端到端恢复完成。

## DSH 未知采用只读对账与同进程草稿恢复

Host adapter 在 adopt 丢失回执时按原 `idempotencyKey` 记住候选身份。reconcile 只 `showCandidate` + `open`：候选仍 pending 则保持 unknown 且不再 POST apply；仅当候选已 `applied_to_working_copy` 且当前 Working Copy digest 与候选 result digest 一致时才完成。同进程同 project/session/version 的 Auctra 编辑草稿在 workspace remount 后恢复，换 session 不带回。

Host focused：`tests/auctra-working-copy-adapter.spec.ts` 含未知采用对账。客户端：`tests/artifact-workspace.spec.tsx` 同 scope remount 恢复。跨 Host 重启的 DSH 请求键→owner canonical 候选键、以及跨进程草稿仍未完成，2.4 保持开放。

## 未知采用恢复前置：owner 原回执

发现并修复 Auctra 已采用候选回放的版本漂移：旧实现把原 journal digest 与当前 Working Copy revision/length 拼在一起，压缩后还可能丢失原回执。owner 现复用已有不可变幂等结果，并复核候选版本、digest、长度和 journal；缺失/损坏/错 journal 失败关闭。代码和回归位于 `cli/auctra/internal/app/text_working_copy_candidate.go` 与 `text_working_copy_candidate_receipt_test.go`，规格归 owner `auctra-dsh-working-copy-save-contract-v1`。

真实 HTTP 通过证据：`temp/integration-test-runs/auctra-owner-http-20260908T114806590Z-1737353/`。先采用、再人工编辑、回放候选及按 canonical `candidate:<ref>` 查询，原回执版本与长度保持，当前正文继续为更新版本。owner focused 覆盖压缩以及缺失/损坏/错 journal，修复前明确复现 revision 漂移，修复后全部候选测试通过。

本轮未把已确认采用的 replay 用作 UI unknown 自动重试。现有 DSH reconcile 仅携带原请求 idempotencyKey，尚不能从随机 DSH 请求键恢复 owner canonical 候选键；该映射与空 patch 的持久 no-op 事实仍待补齐，未知采用保持 unknown，2.4 不收口。

## 分页中英、实际 Pane 宽度与键盘验收

实际 owner 联合浏览器运行新增 360/560/960px × zh/en 六组分页路径：键盘 Enter 加载首页，Tab 保持可预期焦点进入下一页，Enter 翻页，末页禁用下一页；断言当前条数、实际 Pane 宽度及整页无横向溢出。每组仍消费真实 Auctra 分页，未以静态候选列表代替。测试桥仅增加 locale query，并将 fixture 容器从固定 560px 改为随窗口宽度铺开。

通过证据：`temp/integration-test-runs/auctra-owner-http-20260908T114135695Z-1660839/`，截图 `artifacts/auctra-history-{360,560,960}-{zh,en}.png`；已检查 360px 英文与 960px 中文。前次 `auctra-owner-http-20260908T114039319Z-1648083/` 通过的是窗口尺寸变化，固定容器导致其 960px 结果不足以证明 960px Pane，以上最终运行补充真实宽度断言。

本轮仅补充测试桥和验收，不代表正式 DSH 安装或整套 Auctra UI 的双语完成；owner 英文描述、200% 缩放、完整中文输入法、草稿持久恢复和未知采用结果对账仍须分别验证。

## 候选分页控件与第二页采用

最终客户端 focused 通过：`temp/integration-test-runs/creative-workspace-client-2026-09-08T11-38-43-097Z-1622265/`。此前 `creative-workspace-client-2026-09-08T11-36-45-306Z-1593273/` 的新增工作区测试使用未配置的 `toHaveValue` matcher 失败；当前测试改用原生 select.value 断言后通过，失败记录保留。

比较区已接入「加载历史 / 刷新首页」「下一页」、加载状态及当前页条数。仅在 owner 列表准入通过、ArtifactRef 带 `candidate.history.read` 时显示。每次成功替换 50 项的当前页；失败保留旧页和候选选择，手动重试，不自动执行；重复点击合并，组件卸载后丢弃结果，领域动作未决时禁止翻页。分页元数据不包含正文，采用继续由 owner 复核所选候选版本和源版本。

实际 owner 浏览器验证创建 52 个新候选（加已有历史超过一页），重建 Host adapter 后加载首页，模拟一次下一页读取失败，确认当前选择保留，再手动重试、比较第二页精确正文并采用。owner 的正式版本、审阅、检查点计数保持不变。通过证据：`temp/integration-test-runs/auctra-owner-http-20260908T113346070Z-1558509/`，截图 `artifacts/auctra-browser-historical-adoption.png` 已检查。前次 `auctra-owner-http-20260908T113245611Z-1545163/` 浏览器步骤已通过，但旧的逐项分页验证仅允许 20 次而被新数据量截断；改成最多 128 次，并用有界 100 项读取定位历史测试候选后通过，仍要求游标遍历终止、无重复。

固定保存编辑器视觉回归中英 360/560/960 六项通过：`temp/integration-test-runs/ui-visual-2026-09-08T11-35-27-897Z-1578663/`。`check:surfaces`、`check:plugins` 通过，插件报告 `temp/toolchain-runs/2026-09-08T113403327Z-toolchain/`。客户端 build 在 scope helper 类型声明允许其已支持的显式 undefined、分页投影省略未定义可选字段后通过。后者工作区已有并行修复，按最终文件核验，不覆盖其他改动。

分页当前真实浏览器覆盖 560px 中文，其他宽度和键盘专项仍待补齐；正式 DSH 安装、未保存草稿重启持久化及未知采用结果对账仍未完成，2.4 保持开放。

## shipped adapter 历史比较与采用

无 pending 的 `createAuctraWorkingCopyAdapter` 从 owner 历史列表恢复多项候选。比较走既有 `readArtifactContent`（源 Working Copy + 候选 ArtifactRef），snapshot 不含正文且不触发 apply。`sourceVersion` 与当前版本失配时拒绝，acceptedVersion 不变、零 apply。采用非首项 ready 候选只更新 Working Copy；mutation 请求不含 checkpoint/review/canon。

Host focused：`pnpm --filter @yeisme/dsh-creator-studio-host exec vitest run tests/auctra-working-copy-candidate.spec.ts tests/auctra-working-copy-adapter.spec.ts` 通过 10 项。

## 候选分页 Remote 与客户端边界

新增可选 `creatorStudio.readCandidatePage@1`，采用独立 query/page alpha schema；旧快照、正文读取和动作接口保持不变。Host 校验 1–100 的页大小、完整引用、游标与元数据，await 后复核当前上下文、目录 generation 和 adapter；Auctra adapter 校验当前选中对象及版本，并沿用独立列表准入。客户端 Remote/runtime/controller 已接线，初始化前不请求，reset 后丢弃迟到页。比较视图在 `candidate.history.read` 能力下渲染 `CandidateHistory`：加载首页、下一页、失败保留已加载页、显式刷新首页；工作区下拉框同步当前页候选。

实际 owner/Gateway 遍历、无效游标、超限页、过期与移除选择的拒绝，以及候选 schema 测试通过：`temp/integration-test-runs/auctra-owner-http-20260908T112615153Z-1475797/`。客户端 focused：`tests/candidate-history.spec.tsx` 与 `tests/artifact-workspace.spec.tsx` 分页路径。`pnpm --filter @yeisme/dsh-client-ui-creator-studio run build` 通过；`auctraStudioScopeKey` 不再向 optional 字段传入显式 `undefined`。草稿跨重启恢复与未知采用持久对账仍开放。

## 浏览器重开与历史候选选择

`node scripts/run-auctra-owner-http-integration.mjs --browser` 新增真实浏览器历史路径：owner 创建同一基线的两个候选 → dispose 原 adapter 并注册无 pending 内存的新 adapter → reload 编辑页面 → 在候选下拉框选中非首项 → 比较 owner 的源正文与候选正文 → 采用 → 复读 Working Copy。请求中的候选 ref 必须等于下拉框选择，采用后的正文必须等于该候选；owner 正式版本、审阅与检查点计数保持不变。

通过证据：`temp/integration-test-runs/auctra-owner-http-20260908T111927042Z-1404994/`，截图 `artifacts/auctra-browser-historical-adoption.png` 已检查。该证据证明实际共享编辑器、Gateway、新 adapter 与真实 Auctra HTTP/存储的历史选择路径；身份、准入和 Host 选择桥仍是可丢弃 fixture，未启动正式 DSH 安装。截图中的 owner 英文动作/摘要仍需双语设计收口，不能以这条中文页面测试宣称全量中英验收完成。该路径不验证未保存草稿跨重启持久化，分页控件和未知采用结果对账也继续开放。

## 历史候选非首项采用验证补充

采用/撤销动作改为绑定当前 Working Copy，使共享选择器可提交非首项候选；执行时核对精确字段、owner 候选身份、候选版本及源版本。过期候选不再抢占可采用入口，没有写权限时不发布采用绑定。真实 owner 测试创建同一基线的两个候选，重建无 pending 缓存的 adapter，拒绝错误版本后采用历史列表第二项，并复读正文与回执输出版本一致。

通过：`temp/integration-test-runs/auctra-owner-http-20260908T111553720Z-1365223/`；浏览器回归通过：`temp/integration-test-runs/auctra-owner-http-20260908T111656320Z-1377860/`，入口 `node scripts/run-auctra-owner-http-integration.mjs --browser`。后者覆盖真实编辑器保存、未知结果对账、比较、采用与过期拒绝；非首项选择本轮以实际 owner/adapter 验证，尚未单独覆盖浏览器重开后的非首项点击。分页控件、正式 Host 重启恢复及未知采用结果的持久对账仍待，2.4 不收口。

初次运行 `auctra-owner-http-20260908T111514217Z-1356522/` 在新增历史测试中误将说明文字中的 Checkpoint 当成正式版本写入而失败；改为检查实际 mutation 请求不含 checkpoint/review/canon 路由后通过。此检查仅是协议边界证据，正式状态不变的浏览器验证另查 owner fixture 的版本/审阅/检查点计数。

## 候选历史分页错误验证补充

DSH `listCandidates` 仅将候选列表 HTTP 400、有效 `auctra.api.envelope.v1` failed envelope 中的 `patch_invalid` 或 `invalid_request` 转换为 `invalid_input`。未知错误码、错误 envelope 和损坏 JSON 保持 `unconfirmed`；继续复核请求上下文与独立列表准入，不自动重试。现有已加载列表如何保留、游标失效后的刷新入口及分页控件仍属于 2.4 的未完成 UI 工作。

验证入口：`node scripts/run-auctra-owner-http-integration.mjs`。通过证据：`temp/integration-test-runs/auctra-owner-http-20260908T111214717Z-1325855/`，包含五类错误的 focused 测试及真实 Auctra HTTP 无效游标转换。前次运行 `auctra-owner-http-20260908T111043868Z-1308068/` 因新测试构造的 ArtifactRef 缺少必填字段而失败；测试改用现有 owner normalizer 生成完整引用后通过，失败证据保留。

分类为split-owner：DSH拥有文本台交互与安全投影，Auctra继续拥有正文、Working Copy、候选、Checkpoint、Review、Canon和导出。owner已有实现，不应新建编辑/候选/保存API或第二份正文store；DSH adapter与四个专业工作页尚未完成。

## 已核对的合同

| 能力 | owner源码/合同 | DSH消费边界 |
|---|---|---|
| 三类文本 | `internal/app/text_working_copy_service.go`、`docs/text-working-copy.md` | 原service解析chapter:/text:/screenplay-draft:；剧本沿用既有draft兼容投影，不建立重复active copy |
| 正文读取 | `internal/api/text_working_copy_api.go` open分支 | 仅认证explicit open返回body；status/events不含正文。Host须剥离文件系统project_ref，不直接传到浏览器 |
| 编辑与恢复 | `internal/api/text_working_copy_contract.go`及生成TS/OpenAPI | open/status/apply/diff/watch/reconcile，major=1、base revision/digest与UTF-16 edits；事件用于失效后重读 |
| 候选 | 同族candidate create/show/apply/reject | 采用仅更新Working Copy；不能当作Checkpoint、Review或Canon，stale base必须拒绝 |
| 检查点与原子操作 | checkpoint create/list/show、review.submit、change-set show/apply/reconcile | 显式动作分离；结构与正文组合使用owner事务，不在UI拼接事务 |
| 正式审阅与导出 | `internal/api/routes.go`、`studio_consumer_contract.go` | review.accept/reject和text.export已有路由；完整文本类型/版本/权限映射尚需核验 |

工作副本族共17个operation；生成合同schema_version为`auctra.text_working_copy_loopback.v1alpha1`，当前schema_digest为`b7f15cedede385957b1956e4841637e12f5b379a471c531eccdfada55949314f`。owner限制128 edits、正文2MiB。DSH共享正文接口为256Ki字符，不能视作相同单位/上限，也不能截断后宣称保存成功。

## 准入与兼容

原manifest仍声明needs_contract，blockers包括schema/event digest、consumer canary、三场景和安全检查。`internal/adapter/workbench_bridge.go`及其测试令旧Workbench bridge保持default-disabled；HTTP实现则通过认证、major与operation校验进入原服务。二者是不同入口，HTTP测试通过不代表旧bridge获得批准；不得把旧Workbench标识改解释为DSH。

DSH需建立自己的schema/上下文校验和consumer证明，保留旧合同及准入状态。缺少canary首先进入本change验证任务，不重复造API；只有确认新增操作/准入合同确实缺失时才在owner创建具体配套任务。原实现任务见[owner归档change](../../../../../cli/auctra/openspec/changes/archive/2026-09-05-auctra-text-working-copy-v1/tasks.md)。

## 当前实测

### Host explicit-open HTTP客户端

新增AuctraWorkingCopyClient，固定调用loopback `/api/v1/projects/current/text-working-copies/open?major=1`。可信Host连接解析器提供完整Creator scope、私有owner project binding和DSH消费准入；缺少准入、digest不符或旧workbench consumer标志时返回needs_contract，不请求正文。源码中的准入字段只是消费门，不生成或替代owner批准；当前没有真实安装配置被晋级。

连接限制loopback、拒绝URL凭据/path/query/fragment和重定向；显式open只发送typed unit_ref，不读取connection file或执行CLI。15秒超时、16MiB有界JSON读取（含2MiB正文转义开销），结果交原normalizer校验。请求途中作用域、owner项目或准入变化会丢弃结果；拒绝/未知结果不自动重试，原始owner错误不进入输出。

`pnpm --filter @yeisme/dsh-creator-studio-host exec vitest run tests/auctra-working-copy.spec.ts tests/auctra-working-copy-client.spec.ts`通过29项unit测试（注入fetch）；Host typecheck/build通过。包含major/路径、默认不准入、旧consumer不能替代DSH、项目/主体隔离、异步准入撤回、401/403、正文摘要/版本拒绝。本次尚未实际连接Auctra进程或挂载Creator adapter，不能据此关闭2.2或消费canary。

### DSH正文normalizer增量

新增`normalizeAuctraWorkingCopyOpen`，仅处理已授权explicit open的owner响应，不承担连接、凭据、readiness或写权限批准。按私有owner project binding和openRef核对目标，读取UTF-8字节数与SHA-256，保留BOM/CRLF/emoji/空文本，拒绝不匹配摘要、错误版本、恢复状态与孤立surrogate。

普通chapter/text匹配unit_ref，screenplay-draft则匹配其兼容working_copy_ref，不把bare canonical unit ID误当draft ID。输出只含CreatorArtifactContent，不透传project_ref或owner附加字段；DSH新引用加入项目根摘要命名空间，保留working copy identity，避免跨项目同名draft冲突。这不是重命名owner对象或旧Workbench标识。版本由working_revision和content_digest组成，正文与ArtifactRef元数据分离。

`pnpm --filter @yeisme/dsh-creator-studio-host exec vitest run tests/auctra-working-copy.spec.ts`通过12项unit测试，host typecheck/build通过。该证据验证映射函数，不是实际HTTP/鉴权或DSH完整浏览器路径。owner正文2MiB上限与现有256Ki字符编辑器限制仍需协商；不得截断后当完整内容。

在Auctra运行`CGO_ENABLED=0 bash scripts/test_text_working_copy_integration.sh`通过，证据`cli/auctra/temp/integration-test-runs/text-working-copy-20260908T070124Z-1831342/`。五个Go包实际运行；实际auctra serve loopback记录了认证/major/route/method负例和open、apply、重放、status、checkpoint、reconcile正链。

已核对candidate adoption对content versions/review items/checkpoints前后数量不变的断言，以及apply不创建Canon、stale candidate、atomic multi-document、journal/snapshot损坏恢复测试入口。不把runner静态proof文字或总status当作DSH验收。本次没有DSH正文/选区/候选浏览器路径，也没有生成provider调用。

1.1仍需完整结构导航与正式Review/Canon/导出映射；后续优先复用本合同实现DSH normalizer和consumer canary。
# 实际 owner HTTP 读取验证补充

候选分页恢复错误修复：非法/跨scope cursor和服务层无效限额现在使用既有patch_invalid请求错误，避免被映射为500。app/API/CLI focused通过，实际服务 `temp/integration-test-runs/auctra-owner-http-20260908T110317753Z-1206937/` 验证非法cursor为400/patch_invalid；不自动重新请求首页。分页UI的错误提示和完整恢复仍待接入，本项不代表用户路径已完成。

pending候选的上下文隔离修复已验证：`temp/integration-test-runs/auctra-owner-http-20260908T110044634Z-1157235/`。完整context随候选绑定，跨session/membership不能借相同artifact复用采用/撤销动作，也不会在snapshot时擦除原context绑定；回到原scope动作仍可用。Host build与集成检查通过；之前运行的可选值类型错误已修正，失败证据保留。该改动解决权限隔离，不代替历史分页UI和持久化恢复。

无pending内存的adapter恢复验证通过：`temp/integration-test-runs/auctra-owner-http-20260908T105559549Z-1088839/`。fresh adapter从实际owner历史首页找到既有候选，读取正文与原候选digest/version一致，snapshot无正文。当前首页限50并明确更多页提示；历史候选内容读取不再依赖pending，但分页控件与历史采用动作尚未完成，正式Host安装/重启恢复仍待验收。

DSH候选历史客户端listCandidates与page normalizer已接实际owner，运行 `temp/integration-test-runs/auctra-owner-http-20260908T105255551Z-1048612/` 通过。独立candidateListDigest缺失拒绝；授权后limit1读取第一/第二页且候选不重复。页面校验覆盖无正文、去重、限额、cursor格式和副本绑定，Host typecheck/build通过。尚未挂载历史分页UI或替代adapter内存pending，不能宣称刷新/重启恢复完成。

有界候选列表已接HTTP与catalog：GET candidates（major/limit/cursor）使用同一owner CandidatePage，19项operation和生成镜像更新；旧Workbench不新增权限。API/operation/adapter focused全通过。实际HTTP服务证据 `temp/integration-test-runs/auctra-owner-http-20260908T104901698Z-1004437/` 通过，limit1逐页终止、已知候选齐全无重复、无正文metadata、no-store及无身份401均验证。当前catalog digest为 `9ed42760be771c1b81070cac1cf0eece686edba2e11e3c8ff8e0b7d82e93509d`；DSH列表client/分页UI/历史恢复与独立准入尚未接入，保持未完成。

owner 历史候选 CLI 已接通 CandidatePage：candidate list 支持 --limit/--cursor，输出仅候选元数据与续页cursor。真实Cobra focused TestTextWorkingCopyCLICandidateListPages通过：两页无重复、尾页结束、正文不泄漏、非法cursor拒绝。HTTP/catalog/生成类型和DSH历史分页尚未实现，当前adapter的单候选内存不能据此宣称已恢复；配套owner 2.2保持开放。

历史恢复列表的owner基础新增 CandidatePage：GORM按不可变candidate ID有界查询（默认50/最大100，limit+1），游标绑定私有项目摘要与副本。focused TestTextWorkingCopyCandidatePageBoundedAndScoped通过：5候选分页完整无重复、无正文/路径、跨项目cursor拒绝与超限拒绝。旧ListCandidates不改语义；新分页尚未挂HTTP/CLI与DSH历史列表，不能宣称刷新恢复已实现。分页不承诺并发快照，新候选可能需刷新第一页发现，见owner候选内容change设计。

过期候选的浏览器负向路径已通过：`temp/integration-test-runs/auctra-owner-http-20260908T103758203Z-876904/`。浏览器创建固定base候选后，另一客户端真实保存新正文，再点击采用；采用未完成且owner仍保留竞争写入的新正文/digest/revision，本地候选草稿与dirty保护不变，ContentVersion/Review/Checkpoint计数不增加。这证明旧候选不会覆盖新版本，不代表冲突后的重读/重新生成/另存恢复交互已完成；后者继续在2.5/5.4跟踪。

浏览器候选采用联合验证通过：`temp/integration-test-runs/auctra-owner-http-20260908T103526248Z-844011/`。用户在真实编辑器比较后显式采用，Gateway调用实际owner，Working Copy重读为候选正文；未保存草稿仍保留。一次性owner helper的认证测试诊断读取GORM中的ContentVersion/ReviewItem/Checkpoint计数，采用前后完全相同，未发生正式版本或审阅晋级。该诊断仅存在于opt-in测试helper，不增加生产API。完整Checkpoint/Review/Canon/导出、采用后原操作持久恢复与历史候选列表仍有待办；不将本切片晋级为整个文本台完成。

浏览器候选比较已接通实际owner：`temp/integration-test-runs/auctra-owner-http-20260908T103154346Z-800153/` 完整联合运行通过，创建候选后刷新工作区，before为owner原正文，after为固定候选正文；源Working Copy不变，未保存草稿保留，比较没有新增PUT或自动采用。截图在该run的 `artifacts/auctra-browser-candidate-compare.png`。先前run因测试读取准入未复位导致后续负向检查失败，已修正测试隔离，保留失败证据。

客户端组件/controller证据 `temp/integration-test-runs/creative-workspace-client-2026-09-08T10-30-03-518Z-775690/` 通过；Surface/插件检查通过。客户端整体build当前失败于并行 `views.tsx:276` 的exactOptionalPropertyTypes错误，不归本次比较组件修改，未标绿或覆盖该并行路径。候选采用的浏览器路径、持久恢复、正式Host准入仍未完成。

工作区候选引用→Gateway→实际owner内容已打通，证据 `temp/integration-test-runs/auctra-owner-http-20260908T102658938Z-742155/`。通过Gateway创建候选后，snapshot投影的候选ArtifactRef与正文读取结果ref/version完全一致；缺少独立内容准入返回null，测试授权后读取固定正文，错误版本及移除选择拒绝。99项Host测试通过。候选不继承源正文capability，snapshot不携带正文；浏览器Diff/采用、历史候选与持久恢复仍待验收。

候选正文客户端已实现并连接实际 owner：`temp/integration-test-runs/auctra-owner-http-20260908T102317725Z-697401/` 通过。新增 normalizer 校验候选/副本/固定版本/digest/UTF-8长度，引用按私有项目摘要隔离，正文仅在显式读取返回。独立 candidateContentDigest 未提供时 needs_contract；提供测试准入后实际HTTP正文与候选版本一致且不泄漏私有路径。七项normalizer单测通过，Host typecheck/build通过。当前未接工作区候选列表/Diff/采用；仅新增读取能力，不晋级完整文本台。

候选内容实际 HTTP 检查现已执行通过：`temp/integration-test-runs/auctra-owner-http-20260908T101908181Z-637933/`。新建固定base文档候选后，授权GET返回精确正文/no-store，无身份401、错digest409，候选摘要无正文且Working Copy版本/正文不变。并行adapter类型问题已在当前树解决；保存测试按明确actionId选择，不再假设只有一个动作。修正候选摘要字节单位及泄漏测试对普通“edits”词的误判。

DSH createCandidate 已发送 expected_base_revision/digest，验证本地base digest及响应sourceVersion/result digest，拒绝重绑定到较新base的结果且不自动重试。当前尚未接入候选正文client/Diff/历史列表；新的catalog准入与候选创建丢响应后的持久对账仍待完成，不以此晋级完整候选工作流。

候选内容最终六包复核：owner `temp/integration-test-runs/text-working-copy-20260908T101110Z-555115/` 中 app/store/cli/api/operation/adapter 全部通过；整体命令仍失败于既有剧本 `http-sp-generic-readonly`（当前返回400，缺少期望错误码），不记为完整集成通过。

联合脚本已补新候选路由检查：真实 candidate create 后按 fixed digest 读取内容，核对 no-store、无身份拒绝、错误digest拒绝以及 Working Copy 不变。但本次 `temp/integration-test-runs/auctra-owner-http-20260908T101205429Z-564472/` 在 Host build 阶段失败，检查尚未执行：并行扩展的 adapter 返回 needs_contract，不符合 PaneStatus。没有修改或覆盖并行 adapter；该 run 不能当作候选真实服务验收。下一轮需先核对并行状态，再运行新增路由检查。

候选正文 HTTP/catalog 已局部接通：新增候选 content GET（major=1、expected_digest），复用 bearer 授权，响应 no-store/nosniff，普通 show/list 无正文。18 项 operation 清单与生成 manifest/OpenAPI/TS 已更新，HTTP 正文/错误digest/未授权测试通过。catalog digest 变为 `1780a2fa0ee082cbd3d61ce9b363e115b859e6f529b44842e10d917beec1b0e9`，DSH 旧准入暂未升级。

本次整体集成 `cli/auctra/temp/integration-test-runs/text-working-copy-20260908T100655Z-510949/` 失败于旧桥测试硬编码17项；后续修正测试为18项且明确新增content不进入旧Workbench allowlist/discovery，adapter focused通过，未扩大旧权限。API/operation及生成一致性focused亦通过；尚未重跑最终全六包和新路由真实serve路径，owner 2.1继续开放。

候选正文已有显式 CLI 出口：`auctra text working-copy candidate content <working-copy-ref> <candidate-ref> --expected-digest <digest> --to <new-file> --project <project>` 复用 owner ReadCandidateContent，只写新文件，stdout 仅摘要。真实 Cobra focused 测试验证固定正文完整、已有目标不覆盖、错误 digest 不生成文件及正文/路径不进入 stdout。operation catalog、HTTP counterpart、生成合同和全门禁尚未补齐，候选内容 change 的 2.1 保持开放；DSH 仍不得通过直接读取 owner 文件替代 API。

新 inline 候选已在创建时通过 owner snapshot writer 固定结果正文，复用现有字段，不改变候选 ref/采用规则。应用测试验证上游编辑并 compaction 后仍读取原结果、损坏快照拒绝。owner 本次运行证据为 `temp/integration-test-runs/text-working-copy-20260908T095754Z-409417/`：app/store/cli/api/operation/adapter 六包通过，但整体集成失败于并行新增 `http-sp-generic-readonly`（期待 working_copy_compatibility_read_only，实际 draft_version_conflict）；不得把该 run 宣称通过。邻近的其他 run 不属于本次执行，不用于替代证据。候选内容 change 的 HTTP/CLI、旧记录补全与消费者比较仍未完成。

候选比较发现新的 owner 缺口：show/list 只有无正文摘要，未提供显式内容读取。已建立 [候选内容 change](../../../../../cli/auctra/openspec/changes/auctra-candidate-content-read-v1/design.md)，新增应用服务 ReadCandidateContent，按副本/候选/expected digest 校验 document snapshot 或 inline verified base，返回前验证结果 digest/长度；focused app 测试通过，读取不修改 Working Copy。HTTP/CLI 授权出口、生成合同、损坏恢复证据和 DSH adapter 尚未接入。inline 候选的历史 base 不可验证时暂时拒绝；结果快照持久化已列 owner 1.2，不能把临时限制当作历史比较已交付。

候选请求镜像已补：Auctra 通过既有生成 CLI 输出 candidate.create OpenAPI requestBody 与 TypeScript TextWorkingCopyCandidateCreateRequest，表达成对 expected_base_revision/digest 和 legacy 省略分支。生成一致性、CLI/API/app 条件测试及六包/serve 集成通过：owner `temp/integration-test-runs/text-working-copy-20260908T095011Z-282288/`。配套候选 base change 的 1.1/1.2 已完成，DSH 2.1 接入仍开放。注意旧 manifest digest 来自 operation catalog，不涵盖新增请求字段；不能据此沿用读取准入开放候选写入，consumer 必须额外验证 base-fence 合同。下方“请求镜像仍未完成”的历史记录由本段更新。

候选 base 条件的 CLI/API parity 已有运行证据：Auctra `temp/integration-test-runs/text-working-copy-20260908T094515Z-212197/` 六包及既有 serve 集成通过。新增真实 Cobra request-file 测试验证错误 base 冲突、合法 revision 0 保留；实际 HTTP handler 测试验证半条件拒绝、错误 base 冲突及合法条件返回正确 candidate base。CLI request-file 与 HTTP 使用相同字段，旧调用仍兼容。当前 OpenAPI 生成器仅有路由/响应说明，未包含请求字段 schema；配套 owner 1.2 的字段镜像部分继续开放，不能凭生成文件无变化宣称合同完整。DSH candidate.create 尚未开放。

候选合同新增缺口与局部修复：Auctra candidate.create 过去仅绑定 current head，不能校验 Agent 生成所依据的旧 base。配套 [候选 base change](../../../../../cli/auctra/openspec/changes/auctra-candidate-base-fence-v1/design.md) 已建立，应用服务与 HTTP request 增量接受成对 expected_base_revision/digest；重建后、文件与候选登记前检查。focused Go 测试验证旧 base 冲突、半条件拒绝、零候选写入和旧调用兼容。生成合同镜像、CLI parity、HTTP 集成证据尚未完成，不更新消费准入或宣称 DSH 候选页面可用。

浏览器断线恢复联合验证已通过：`temp/integration-test-runs/auctra-owner-http-20260908T093737497Z-52762/`。模拟 PUT 提交成功后响应丢失，界面显示 unknown、禁止再次执行但可核对原操作；用户继续输入后对账，owner 已提交内容正确，新输入仍为未保存草稿，PUT 总数保持七次（包含此前测试中的明确冲突请求），没有对账导致的新增提交。

首次用例发现执行按钮仍可用，已通过共享 action composer 的 executionBlocked 与提交守卫修复。客户端 70 项测试通过：`temp/integration-test-runs/creative-workspace-client-2026-09-08T09-36-51-312Z-39111/`；build、Surface、插件门通过。中间 owner 并行编辑曾暂时导致缺失方法构建失败，证据 `temp/integration-test-runs/auctra-owner-http-20260908T093633304Z-32303/` 保留，未修改该并行实现；重新核对方法存在后联合运行通过。测试使用实际 owner 和浏览器、测试身份与 Host RPC 桥，不代表正式安装或跨重启原键恢复完成。

真实 owner 与浏览器联合验证已形成一条通用文本保存路径。运行 `node scripts/run-auctra-owner-http-integration.mjs --browser`，最新证据 `temp/integration-test-runs/auctra-owner-http-20260908T092641889Z-4074907/`：69 项 Host focused 测试和九组检查通过。浏览器实际输入、Gateway dispatch、Auctra HTTP/app/storage 写入、按新版本重读和清理对应草稿在同一运行内完成；测试 Host 确认选中版本后，再次编辑保存成功，累计 PUT 数量与预期一致。截图保留在该 run 的 `artifacts/auctra-browser-save.png`。

此运行使用一次性正文和测试身份，Host RPC/项目选择更新由 scope 固定的测试桥提供；不是正式 DSH profile 安装验收，也不代表专业文本台全流程完成。它更新下方旧记录中“浏览器与实际 owner 尚未联合”的描述；生产 Host 选择更新、小说/剧本、候选/Checkpoint/Review/Canon、大文档和持久化恢复仍有明确缺口。

返回相同 context 的回退缺陷已复现并修复：A→B→A 后，旧保存确认曾把 `second saved` 覆盖为 `first saved`。现在每次进入 context 使用独立访问标识，读取、提交和确认均校验本次访问；旧读取不再占住新读取槽，也不能清除另一请求的槽。回归还验证旧正文读取未结束时可重新进入并获得新正文。

最新客户端 70 项通过：`temp/integration-test-runs/creative-workspace-client-2026-09-08T09-16-41-870Z-3858946/`；六项中英文浏览器续接回归通过：`temp/integration-test-runs/ui-visual-2026-09-08T09-18-52-408Z-3966946/`；build、Surface、插件与 diff 检查通过。仍是共享编辑器的 scoped component/browser fixture 验证，不宣称真实 Auctra 全流程或跨重启恢复完成。

项目隔离增量：切换 Creator context 时移除旧项目生命周期 UI 锁与动作面板，不取消 owner 操作；迟到保存回执必须同时匹配原调用、pending 与当前 context epoch。组件回归覆盖新项目尚无保存、以及已开始同名保存两种情况，旧回执均不读取新项目正文、不改变当前输入、不替新 pending 完成确认。最新客户端 68 项通过：`temp/integration-test-runs/creative-workspace-client-2026-09-08T09-07-15-724Z-3559979/`；六项浏览器续接回归：`temp/integration-test-runs/ui-visual-2026-09-08T09-09-29-190Z-3583158/`。类型、Surface 和插件检查通过。此证据证明 UI 隔离，不能替代跨项目草稿/原键持久化或关闭重启恢复验收。

当前共享 UI 续接已实现：新版本回执唯一匹配并显式重读确认后，正文缓存与保存期间新增的草稿一起迁到新版本；不把新正文填入旧引用缓存，不沿用旧 action/provenance，不晋级 Canon。owner 投影尚未更新时保留输入并停用旧保存动作；匹配新投影到达后恢复操作。无 outputs 的既有可变引用保存仍兼容；含糊回执、错引用及重读版本不符时不清草稿。

最新验证：66 项客户端组件/controller 测试通过，证据 `temp/integration-test-runs/creative-workspace-client-2026-09-08T08-57-43-779Z-3462762/`；中英文 × 360/560/960px 的六个真实编辑器浏览器 fixture 通过，证据 `temp/integration-test-runs/ui-visual-2026-09-08T08-57-49-480Z-3466741/`；原六个 workspace/creator 基线通过，证据 `temp/integration-test-runs/ui-visual-2026-09-08T08-58-40-947Z-3476070/`。客户端 build、Surface 与插件门通过。窄 Pane 截图已检查，并补统一 vk-btn fallback，避免无宿主样式时按钮文字不可读。

浏览器 fixture 直接复用编辑器与媒体渲染源码，owner 回执为 synthetic；修复测试 bundle 对 CJS ModuleLoader 入口的引用和 ReactDOM flushSync 桥，不改生产媒体入口。先前失败证据保留。上述浏览器结果不可与独立 HTTP canary 合并宣称真实 Auctra 端到端；Host 的新版本选择更新、真实联合路径、大文档和重启恢复仍待完成。下方旧阶段记录中“新版本迁移未实现”的表述已由本段更新。

共享 UI 候选保护修复：createCandidate 的 completed 回执不再执行 saveDraft 的正文确认逻辑；新增组件回归证明源草稿、未保存提示与当前输入仍保留，不发起第二次源正文读取。客户端证据：`temp/integration-test-runs/creative-workspace-client-2026-09-08T08-35-33-558Z-3223224/`；六项 workspace/creator 窄/中/宽视觉检查：`temp/integration-test-runs/ui-visual-2026-09-08T08-35-39-296Z-3227195/`。Surface 与插件检查通过。以上是共享组件/视觉证据，不是实际 Auctra 候选生成或完整保存 UI 验收；新版本选择与缓存迁移仍未实现。

最新 Gateway 保存接入证据：`temp/integration-test-runs/auctra-owner-http-20260908T082952493Z-3164357/` 中 69 项 focused 测试与八组实际 HTTP 检查通过。工作区 `saveDraft` 绑定到 owner-backed `working-copy.save`；body-free status 查询建立 freshness，旧版本/无写入权限不发布动作。真实 Gateway 保存返回新固定版本，显式读取可获得已保存正文，旧选择不变且其保存动作变为不可用；关闭选择后依靠 Host 原引用解析仍可对账，PUT 数量不增加。跨项目、错 base revision 和超协议长度在 owner PUT 前被拒绝。

首次 Gateway 验证曾因 snapshot freshness=unknown 被正确拒绝，失败证据 `temp/integration-test-runs/auctra-owner-http-20260908T082707061Z-3125314/` 保留。修复通过真实无正文 status 确认新鲜度，没有弱化 Gateway 的 freshness gate。当前尚未修复编辑器重读旧 ArtifactRef 的行为，也未接入生产 bundle 的项目选择与原引用解析；不宣称端到端 UI 保存完成。

当前写回进展：`AuctraWorkingCopyClient.save/reconcileSave` 已实现并实际调用 Auctra。最新证据 `temp/integration-test-runs/auctra-owner-http-20260908T082102465Z-3064679/`：69 项 focused 测试与七组实际 HTTP 检查通过。客户端保存 Unicode/CRLF，模拟第二次 PUT 提交后丢失响应，再通过原键对账找到结果，期间没有额外 PUT；原操作回执不被后来版本替代；旧 base 冲突后当前正文不变。测试使用一次性项目和 fixture-only 写入准入，不修改生产授权。

客户端方法已取代前一阶段测试直接构造 PUT 的路径。仍未实现保存 action、UI、自动保存恢复或剧本写回 adapter，因而下文较早记录中的“client 保存未实现”仅描述旧阶段，正式写作路径仍未通过验收。

最新保存消费基础：`normalizeAuctraWorkingCopyReceipt` 将授权后的 apply/reconcile 回执转换为 body-free ArtifactRef、原提交版本、字节长度与 outcome；不更新选中对象，不把 reconcile 当前 head 当作 last_receipt。10 项新增单测覆盖原/当前版本分离、旧式混合回执、长度/项目/journal 错配、互斥状态与缺失对账事实。最新 DSH 证据 `temp/integration-test-runs/auctra-owner-http-20260908T081318473Z-2979098/`：56 项 focused 测试、六组实际 owner HTTP 检查通过，包括直接调用 owner 保存两次后，DSH normalizer 保留第一次结果、缺失键保持无法确认。这里的 PUT 由测试驱动发出；生产 client 的保存方法、动作描述与浏览器交互仍未实现。

同键并发缺口已补：Auctra `TestTextWorkingCopySameKeyAcrossConnections` 使用八次独立 `store.Open` 连接，同键同 payload 竞争只提交一次；删除已压缩 journal 后仍可读取原结果，revision 不增长。focused 连续三次通过；最终六包及 serve 集成证据为 owner `temp/integration-test-runs/text-working-copy-20260908T081109Z-2955626/`。此前段落中的同键竞争待办已由此覆盖，完整质量门与 DSH 保存 UI 仍待完成。

原回执修复最终验证：Auctra `temp/integration-test-runs/text-working-copy-20260908T080237Z-2726390/` 中 app/store/cli/api/operation/adapter 六个包和真实 serve 路径全部通过。新增检查覆盖原回执在后续编辑与压缩后保持版本、digest 和长度，reconcile 当前状态与 last_receipt 分离，旧库增量迁移、结果损坏或错副本时失败关闭。owner 配套任务 1.1、1.2 已完成；同键多连接竞争、完整质量门及 DSH 保存消费仍保留明确任务。

写回合同核对发现并已在 owner 修复原幂等回执漂移：第一次保存后再编辑，旧实现回放返回第二次 revision/length 搭配第一次 digest；compaction 还会删除原回执依赖的 journal。Auctra 新增 schema v32 的 body-free 原提交结果持久化，配套 [owner change](../../../../../cli/auctra/openspec/changes/auctra-dsh-working-copy-save-contract-v1/design.md) 独立维护迁移、恢复和证据。旧记录缺乏历史事实时保持无法确认，不自动重试。剧本兼容投影只读，写回需沿用 `text.draft.save`；不能把通用 Working Copy apply 当作三类正文的统一可用写入入口。DSH 保存按钮与回执消费尚待接入。

最新接入：`createAuctraWorkingCopyAdapter` 已注册到测试中的真实 Creator directory/Gateway，并使用实际 Auctra HTTP service 读取。运行 `node scripts/run-auctra-owner-http-integration.mjs` 的证据为 `temp/integration-test-runs/auctra-owner-http-20260908T075057721Z-2353995/`：46 项 focused 测试与五组 owner HTTP 检查通过，Host build 通过。快照只含固定版本引用；显式读取后校验选择仍有效；伪造引用、MIME 或移除选择均不能取得正文。Gateway 另覆盖项目、membership 与 adapter 在读取期间变化时丢弃结果，正常读取仍成功。

当前 adapter 是读取切片，尚未接入正式 bundle 的项目选择流程和浏览器验收，也没有写入、候选、Checkpoint、Review 或 Canon 操作。旧段落中的“未挂载 adapter”描述之前阶段；当前测试已挂载，但不等于正式产品路径完成。

运行 `node scripts/run-auctra-owner-http-integration.mjs` 已通过四组检查，证据位于 `temp/integration-test-runs/auctra-owner-http-20260908T074608991Z-2294743/`。测试使用实际 Auctra HTTP handler、application service 和临时项目存储；DSH 调用新 `AuctraWorkingCopyClient`，不读取用户连接文件或凭据。

- 通过 owner application service 创建正文，再由 HTTP 打开；中文、emoji、CRLF 完整保留，投影不泄漏私有项目路径。
- 固定版本读取可重复，过期版本不返回正文。
- 实际 HTTP 身份校验与客户端项目绑定校验分别拒绝未授权或错误项目读取。
- 默认无 DSH admission 时零 owner 请求。

测试 helper 位于 Auctra `internal/integrationtest/workingcopyfixture/main.go`，需要显式 fixture 环境开关，通过 stdin 关闭服务并清除一次性项目。正文、身份与 consumer admission 都是测试配置；本次未批准生产 admission，也未验证浏览器、正文修改、候选采用、Checkpoint、Canon 或导出。对应父任务继续保持未完成。

## 未提交恢复草稿：Host 读取接入增量

Auctra owner 的 `auctra-editor-recovery-drafts-v1` 已交付独立 CLI/HTTP/OpenAPI/TypeScript。Host 新增 `listRecoveryDrafts` 与 `readRecoveryDraft`，复用现有 loopback transport；必须额外匹配恢复 OpenAPI 文件 SHA-256 `ddfbdad2f8a6ab7e87ae0f08ef318052c5f2b467d4f4cc2bdf972f4d4d02aede`，旧 Working Copy 准入不自动启用此能力。该摘要针对生成文件原始字节，不是 Working Copy catalog digest。

client_ref 从可信 tenant/workspace/project/principal 派生，跨 session 稳定；不是浏览器可填的授权字段。列表只产生 opaque ref、固定基线、独立 revision、digest/长度/更新时间，不含 owner 路径和正文。显式读取按发现时固定草稿 revision/digest 复核正文，草稿已更新则拒绝把新内容冒充旧版本；来源变化只给提示，不提交或采用。请求前核对 owner 项目 hash，返回后复查身份与独立准入。

当前证据限 Host client/normalizer 的请求与响应测试，包括身份分区、未准入零请求、正文/摘要/版本损坏和返回途中撤销准入；复用原 owner HTTP runner 纳入测试。恢复保存方法、Gateway/Remote、编辑器重开选择和真实 owner 恢复交接尚未接入，不宣称浏览器未提交输入已可恢复。

### 恢复草稿真实 owner HTTP 保存闭环

Host `saveRecoveryDraft` 复用既有 transport 的项目绑定、writeApproved 和请求后准入复查，另要求恢复合同 digest。来源输入固定版本且验证原文 SHA-256；新正文按 UTF-8 2 MiB owner 上限检查，既有草稿更新必须匹配 unit/base 和独立 revision。回执只含安全元数据，绝不返回 `documentSaved` 或替换 Working Copy 来源版本。结果未知不重试；先通过列表发现 owner 事实。

真实 owner HTTP 证据：`temp/integration-test-runs/auctra-owner-http-20260908T150353030Z-405474/`。测试由 Host client 请求实际 Auctra 服务完成创建→列表→读取，并模拟 owner 更新提交后响应丢失；新 client 发现 revision 2，旧 revision 更新返回 conflict，换 session 后读回完整未提交正文。断言三次显式 POST 没有隐式重发，整个过程 Working Copy 内容和版本不变，安全回执不含 owner 路径及正文。此证据已超过上节仅响应 fixture 的读取证明，但尚未涉及 Gateway/Remote 和浏览器关闭恢复。

### 编辑器控制器桥接

CreatorStudioController 增加可选 `listAuctraRecoveryDrafts` / `readAuctraRecoveryDraft` 远程能力。控制器只转发 owner 已验证的结果，不把草稿正文写入 snapshot、operation recovery index 或 lastReceipt；remote 未提供能力时返回 `unavailable`，不发请求。该桥接让 Pane 可以显式触发恢复发现/读取，尚未改变现有 AuctraWritingStudioPages 的默认编辑流程。

Host/Client typecheck 均通过。为避免把正文读操作混入普通 artifact API，恢复能力保持独立 remote 方法；后续页面接入需增加用户明确的“恢复此草稿”操作，并在读取后作为未提交输入填充本地编辑状态，禁止自动 save/submit。

### 恢复草稿 UI 组件

`AuctraRecoveryDrafts` 是元数据优先的独立 UI 组件，可嵌入 Auctra Writing Studio：列表不带正文；用户点击“读取草稿”后才调用 `onRead`；来源变更可见；用户再次点击“恢复为未提交输入”才调用 `onRestore`。读取失败显示可重试提示，组件不会自行 save/submit，也不会把内容写入全局 snapshot。

组件测试覆盖空列表、显式读取、来源变化提示、恢复回调及读取失败边界；Auctra Writing Studio 原有键盘页面测试、Client 与 Host typecheck 均通过。当前页面尚未由真实 CreatorStudio runtime 传入 recovery rows/read/restore 回调，因此 5.4 真实关闭重开与 IME/200% 验收仍未完成；组件测试不替代真实页面证据。

### 页面插槽接入

`CreatorStudioView` 与 `AuctraWritingStudioPages` 现在接受可选 `recovery` ReactNode 插槽，并只在 Auctra 文本台渲染。上层 runtime 可将 owner-backed `AuctraRecoveryDrafts` 传入，不会让其他 owner 或普通工作区看到恢复正文。插槽本身不创建 remote，不执行读取，真实数据仍由上层显式注入；这保持页面壳与 owner transport 分离。

页面组件与原有四页键盘导航测试通过，Client/Host typecheck 通过。尚未把 controller 的 list/read 方法自动装配到默认 runtime，也未实现恢复后的正文编辑状态写回，因此关闭重开仍需真实浏览器路径验证。

## 2026-09-09 最终门禁修复记录

恢复及保存的实际 owner/Chromium 检查现为 54 项；通过原生 CDP IME 组合输入和 chrome.tabs 200% 缩放（倍率、DPR、CSS 视口与键盘恢复动作同时验证）。owner 六包集成包含恢复副本备份往返、CAS 与身份隔离。证据以 tasks.md 最新记录为准。

全仓 Mermaid graft 测试的固定 60ms 等待在并发负载下可能早于 React 渲染完成，失败断言还会漏掉 controller.stop 并污染后续用例。现改为等待实际 SVG/错误状态，并在 afterEach 统一 stop；不改变渲染实现和验收断言。

视觉回归首次为 143/146；三个中文 selection 截图在定向复跑中均稳定为相同像素差异。逐一查看 360/560/960px 前后图，确认文案、几何、控件、焦点边框不变，变化为中文字形笔画。接受当前固定 Chromium/fontconfig 环境的渲染，使用原 runner 仅更新这三张截图，完整视觉回归仍单独验证；未放宽像素阈值。

全仓 test 与 visual 不应并行：后者会重建并短暂清空 ui-surface/lib，导致前者临时模块缺失。该失败归为本轮验证调度冲突，后续两个门串行运行。

## 剧本恢复锚点验收修正

最终审核发现恢复校验曾仅接受通用 `revision:digest`，使剧本 `revision:sha256:digest` 恢复被拒。已在 owner service/OpenAPI 和 DSH client/Remote schema 增量接受剧本原值，旧格式不变，未迁移或重写已存锚点。实际 owner HTTP 与新浏览器显式发现、读取、恢复剧本成功，56项回归证据为 `temp/integration-test-runs/auctra-owner-http-20260909T030145678Z-1868928/`。截图 `artifacts/auctra-screenplay-recovery.png` 已人工核对。测试服务改用临时可用端口，避免影响其他本地进程。
